const socket = io();

let meuApelido = '';
let meuTime = '';
let minhasCartasData = [];
let cartaSelecionadaIndex = null;

const telaLogin = document.getElementById('tela-login');
const telaJogo = document.getElementById('tela-jogo');
const btnEntrar = document.getElementById('btn-entrar');
const btnCriar = document.getElementById('btn-criar');
const inputApelido = document.getElementById('input-apelido');
const inputSala = document.getElementById('input-sala');
const selectMaxJogadores = document.getElementById('select-max-jogadores');

const cartasContainer = document.getElementById('minhas-cartas');
const cartasMesaContainer = document.getElementById('cartas-mesa');
const cartaViraContainer = document.getElementById('carta-vira');
const monteBaralho = document.getElementById('monte-baralho');
const areaJogada = document.getElementById('area-jogada');

const statusVez = document.getElementById('status-vez');
const statusValorMao = document.getElementById('status-valor-mao');
const overlayEmbaralhando = document.getElementById('overlay-embaralhando');

const btnTruco = document.getElementById('btn-truco');
const modalTruco = document.getElementById('modal-truco');
const textoTruco = document.getElementById('texto-truco');
const btnAceitarTruco = document.getElementById('btn-aceitar-truco');
const btnAumentarTruco = document.getElementById('btn-aumentar-truco');
const btnCorrerTruco = document.getElementById('btn-correr-truco');

btnEntrar.addEventListener('click', () => {
  meuApelido = inputApelido.value.trim();
  const nomeSala = inputSala.value.trim();
  if (meuApelido && nomeSala) {
    socket.emit('entrarSala', { apelido: meuApelido, nomeSala });
  }
});

btnCriar.addEventListener('click', () => {
  meuApelido = inputApelido.value.trim();
  const nomeSala = inputSala.value.trim();
  const maxJogadores = selectMaxJogadores.value;
  if (meuApelido && nomeSala) {
    socket.emit('criarSala', { apelido: meuApelido, nomeSala, maxJogadores });
  }
});

socket.on('sucessoEntrada', (dados) => {
  meuApelido = dados.apelido;
  meuTime = dados.time;
  telaLogin.classList.add('hidden');
  telaJogo.classList.remove('hidden');
  document.getElementById('label-sala').innerText = `Sala: ${dados.nomeSala}`;
});

socket.on('erroEntrada', (msg) => alert(msg));

// Receber Cartas e Embaralhar por 3.5 segundos
socket.on('minhasCartas', (dados) => {
  minhasCartasData = dados.cartas;
  cartaSelecionadaIndex = null;
  atualizarIndicadoresAlvo();

  overlayEmbaralhando.classList.remove('hidden');
  setTimeout(() => {
    overlayEmbaralhando.classList.add('hidden');
    renderizarMinhasCartas();
  }, 3500);
});

function renderizarMinhasCartas() {
  cartasContainer.innerHTML = '';
  minhasCartasData.forEach((carta, index) => {
    const el = document.createElement('div');
    const isVermelho = carta.naipe === '♥' || carta.naipe === '♦';
    el.className = `carta ${isVermelho ? 'vermelho' : ''} ${cartaSelecionadaIndex === index ? 'selecionada' : ''}`;
    el.innerHTML = `<div>${carta.valor}</div><div>${carta.naipe}</div>`;
    
    // Selecionar / Desselecionar a carta
    el.addEventListener('click', () => {
      if (cartaSelecionadaIndex === index) {
        cartaSelecionadaIndex = null;
      } else {
        cartaSelecionadaIndex = index;
      }
      renderizarMinhasCartas();
      atualizarIndicadoresAlvo();
    });

    cartasContainer.appendChild(el);
  });
}

function atualizarIndicadoresAlvo() {
  if (cartaSelecionadaIndex !== null) {
    areaJogada.classList.add('aguardando-alvo');
    monteBaralho.classList.add('aguardando-alvo');
  } else {
    areaJogada.classList.remove('aguardando-alvo');
    monteBaralho.classList.remove('aguardando-alvo');
  }
}

// Clicou na Mesa -> Jogar ABERTA
areaJogada.addEventListener('click', () => {
  if (cartaSelecionadaIndex !== null) {
    socket.emit('jogarCarta', { indiceCarta: cartaSelecionadaIndex, esconder: false });
    cartaSelecionadaIndex = null;
    atualizarIndicadoresAlvo();
  }
});

// Clicou no Baralho -> Jogar ESCONDIDA
monteBaralho.addEventListener('click', () => {
  if (cartaSelecionadaIndex !== null) {
    socket.emit('jogarCarta', { indiceCarta: cartaSelecionadaIndex, esconder: true });
    cartaSelecionadaIndex = null;
    atualizarIndicadoresAlvo();
  }
});

// Atualização da Mesa
socket.on('atualizarMesa', (jogadas) => {
  cartasMesaContainer.innerHTML = '';
  jogadas.forEach(j => {
    const el = document.createElement('div');
    if (j.escondida) {
      el.className = 'carta escondida';
      el.innerHTML = `<div class="verso-copag"></div>`;
    } else {
      const isVermelho = j.carta.naipe === '♥' || j.carta.naipe === '♦';
      el.className = `carta ${isVermelho ? 'vermelho' : ''}`;
      el.innerHTML = `<div>${j.carta.valor}</div><div>${j.carta.naipe}</div>`;
    }
    cartasMesaContainer.appendChild(el);
  });
});

socket.on('novaMao', (dados) => {
  const isVermelho = dados.vira.naipe === '♥' || dados.vira.naipe === '♦';
  cartaViraContainer.className = `carta vira ${isVermelho ? 'vermelho' : ''}`;
  cartaViraContainer.innerHTML = `<div>${dados.vira.valor}</div><div>${dados.vira.naipe}</div>`;
  
  statusVez.innerText = `Vez de: ${dados.vez}`;
  document.getElementById('placar-A').innerText = `Nós: ${dados.pontosA}`;
  document.getElementById('placar-B').innerText = `Eles: ${dados.pontosB}`;
});

socket.on('atualizarVez', (apelidoVez) => {
  statusVez.innerText = `Vez de: ${apelidoVez}`;
});

btnTruco.addEventListener('click', () => socket.emit('pedirTruco'));

socket.on('solicitacaoTruco', (dados) => {
  if (dados.pediuTime !== meuTime) {
    textoTruco.innerText = `${dados.pediuApelido} pediu ${dados.valorProposto}!`;
    modalTruco.classList.remove('hidden');
  }
});

btnAceitarTruco.addEventListener('click', () => {
  socket.emit('respostaTruco', { aceitou: true, aumentar: false });
  modalTruco.classList.add('hidden');
});

btnAumentarTruco.addEventListener('click', () => {
  socket.emit('respostaTruco', { aceitou: true, aumentar: true });
  modalTruco.classList.add('hidden');
});

btnCorrerTruco.addEventListener('click', () => {
  socket.emit('respostaTruco', { aceitou: false, aumentar: false });
  modalTruco.classList.add('hidden');
});

socket.on('atualizarEstadoTruco', (dados) => {
  statusValorMao.innerText = `Valendo: ${dados.valorMao} ponto(s)`;
});

socket.on('atualizarTrofeus', (trofeus) => {
  document.getElementById('trofeus-A').innerText = `🏆 Nós: ${trofeus.A}`;
  document.getElementById('trofeus-B').innerText = `🏆 Eles: ${trofeus.B}`;
});

document.getElementById('btn-sair').addEventListener('click', () => location.reload());
