const socket = io();

// Elementos Login
const cardEntrar = document.getElementById('card-entrar');
const cardCriar = document.getElementById('card-criar');

const btnAbrirCriar = document.getElementById('btn-abrir-criar');
const btnVoltarEntrar = document.getElementById('btn-voltar-entrar');

const btnEntrar = document.getElementById('btn-entrar');
const btnConfirmarCriar = document.getElementById('btn-confirmar-criar');

// Elementos Jogo
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app');

const btnPedirTruco = document.getElementById('btn-pedir-truco');
const modalTruco = document.getElementById('modal-truco');
const textoTrucoPedido = document.getElementById('texto-truco-pedido');
const btnAceitarTruco = document.getElementById('btn-aceitar-truco');
const btnAumentarTruco = document.getElementById('btn-aumentar-truco');
const btnCorrerTruco = document.getElementById('btn-correr-truco');

let meuApelido = '';
let meuTime = '';
let valorMaoAtual = 1;
let trucoPendenteLocal = null;

// Alternar Telas Login / Criar
btnAbrirCriar.onclick = () => {
  cardEntrar.style.display = 'none';
  cardCriar.style.display = 'block';
};

btnVoltarEntrar.onclick = () => {
  cardCriar.style.display = 'none';
  cardEntrar.style.display = 'block';
};

// Ações Entrada
btnEntrar.onclick = () => {
  const apelido = document.getElementById('input-apelido').value.trim();
  const nomeSala = document.getElementById('input-sala').value.trim();

  if (!apelido) {
    alert('Por favor, digite o seu apelido!');
    return;
  }

  if (!nomeSala) {
    alert('Por favor, digite o nome da sala!');
    return;
  }

  socket.emit('entrarSala', { apelido, nomeSala });
};

btnConfirmarCriar.onclick = () => {
  const apelido = document.getElementById('input-criar-apelido').value.trim();
  const nomeSala = document.getElementById('input-criar-sala').value.trim();
  const maxJogadores = document.getElementById('select-max-jogadores').value;

  if (!apelido) {
    alert('Por favor, digite o seu apelido!');
    return;
  }

  if (!nomeSala) {
    alert('Por favor, digite um nome para a nova sala!');
    return;
  }

  socket.emit('criarSala', { apelido, nomeSala, maxJogadores });
};

socket.on('erroEntrada', (msg) => {
  alert(msg);
});

socket.on('sucessoEntrada', (data) => {
  meuApelido = data.apelido;
  meuTime = data.time;

  loginContainer.style.display = 'none';
  appContainer.style.display = 'flex';
  
  document.getElementById('label-nome-sala').innerText = data.nomeSala;
  document.getElementById('meu-info').innerText = `${meuApelido} (Time ${meuTime})`;
});

socket.on('atualizarJogadores', (jogadores) => {
  const timeA = jogadores.filter(j => j.time === 'A').map(j => j.apelido).join(' & ');
  const timeB = jogadores.filter(j => j.time === 'B').map(j => j.apelido).join(' & ');

  document.getElementById('nome-time-a').innerText = timeA || 'Aguardando...';
  document.getElementById('nome-time-b').innerText = timeB || 'Aguardando...';
});

socket.on('atualizarTrofeus', (data) => {
  document.getElementById('trofeus-a').innerText = `🏆 ${data.a}`;
  document.getElementById('trofeus-b').innerText = `🏆 ${data.b}`;
});

// Truco Controles
btnPedirTruco.onclick = () => {
  socket.emit('pedirTruco');
};

socket.on('solicitacaoTruco', (data) => {
  trucoPendenteLocal = data;
  
  if (data.pediuTime !== meuTime) {
    modalTruco.style.display = 'block';
    let rotulo = 'TRUCO!';
    if (data.valorProposto === 6) rotulo = 'SEIS!';
    if (data.valorProposto === 9) rotulo = 'NOVE!';
    if (data.valorProposto === 12) rotulo = 'DOZE!';

    textoTrucoPedido.innerText = `${data.pediuApelido} pediu ${rotulo}`;

    if (data.valorProposto >= 12) {
      btnAumentarTruco.style.display = 'none';
    } else {
      btnAumentarTruco.style.display = 'inline-block';
      let proximoRotulo = data.valorProposto === 3 ? 'Pedir 6' : (data.valorProposto === 6 ? 'Pedir 9' : 'Pedir 12');
      btnAumentarTruco.innerText = proximoRotulo;
    }
  } else {
    document.getElementById('status-vez').innerText = `Aguardando resposta do Truco...`;
  }
});

btnAceitarTruco.onclick = () => {
  modalTruco.style.display = 'none';
  socket.emit('respostaTruco', true);
};

btnCorrerTruco.onclick = () => {
  modalTruco.style.display = 'none';
  socket.emit('respostaTruco', false);
};

btnAumentarTruco.onclick = () => {
  modalTruco.style.display = 'none';
  socket.emit('respostaTruco', true);
  socket.emit('pedirTruco');
};

socket.on('trucoAceito', (data) => {
  valorMaoAtual = data.valorMao;
  document.getElementById('label-valor-mao').innerText = valorMaoAtual;
  
  let textoBtn = 'TRUCO!';
  if (valorMaoAtual === 3) textoBtn = 'SEIS!';
  if (valorMaoAtual === 6) textoBtn = 'NOVE!';
  if (valorMaoAtual === 9) textoBtn = '12!';
  btnPedirTruco.innerText = textoBtn;

  if (valorMaoAtual >= 12) {
    btnPedirTruco.style.display = 'none';
  }
});

socket.on('novaMao', (data) => {
  valorMaoAtual = data.valorMao;
  document.getElementById('label-valor-mao').innerText = valorMaoAtual;
  document.getElementById('pontos-a').innerText = data.pontosA;
  document.getElementById('pontos-b').innerText = data.pontosB;
  document.getElementById('status-vez').innerText = `Vez de: ${data.vez}`;

  modalTruco.style.display = 'none';
  btnPedirTruco.style.display = 'inline-block';
  btnPedirTruco.innerText = 'TRUCO!';

  const viraEl = document.getElementById('carta-vira');
  viraEl.innerText = `${data.vira.valor}${data.vira.naipe}`;
  if (data.vira.naipe === '♦' || data.vira.naipe === '♥') {
    viraEl.classList.add('vermelho');
  } else {
    viraEl.classList.remove('vermelho');
  }
});

socket.on('minhasCartas', (cartas) => {
  const container = document.getElementById('minhas-cartas');
  container.innerHTML = '';

  cartas.forEach((c, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'carta' + (c.naipe === '♦' || c.naipe === '♥' ? ' vermelho' : '');
    cardEl.innerText = `${c.valor}${c.naipe}`;
    cardEl.onclick = () => socket.emit('jogarCarta', index);
    container.appendChild(cardEl);
  });
});

socket.on('atualizarMesa', (cartasMesa) => {
  const container = document.getElementById('cartas-mesa');
  container.innerHTML = '';

  cartasMesa.forEach(item => {
    const cardEl = document.createElement('div');
    cardEl.className = 'carta' + (item.carta.naipe === '♦' || item.carta.naipe === '♥' ? ' vermelho' : '');
    cardEl.innerText = `${item.carta.valor}${item.carta.naipe}`;
    container.appendChild(cardEl);
  });
});

socket.on('atualizarVez', (apelido) => {
  document.getElementById('status-vez').innerText = apelido.includes('Aguardando') ? apelido : `Vez de: ${apelido}`;
});

socket.on('fimDePartida', (data) => {
  alert(`🏆 Fim de partida (12 Pts)! Vencedor: ${data.vencedor}\nA partida será reiniciada mantendo os troféus!`);
});
