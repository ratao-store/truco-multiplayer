const socket = io();

// Login
const cardEntrar = document.getElementById('card-entrar');
const cardCriar = document.getElementById('card-criar');
const btnAbrirCriar = document.getElementById('btn-abrir-criar');
const btnVoltarEntrar = document.getElementById('btn-voltar-entrar');
const btnEntrar = document.getElementById('btn-entrar');
const btnConfirmarCriar = document.getElementById('btn-confirmar-criar');

// App & Regras
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app');
const modalRegras = document.getElementById('modal-regras');
const btnAbrirRegras = document.getElementById('btn-abrir-regras');
const btnFecharRegras = document.getElementById('btn-fechar-regras');

// Truco Controles
const btnPedirTruco = document.getElementById('btn-pedir-truco');
const modalTruco = document.getElementById('modal-truco');
const textoTrucoPedido = document.getElementById('texto-truco-pedido');
const btnAceitarTruco = document.getElementById('btn-aceitar-truco');
const btnAumentarTruco = document.getElementById('btn-aumentar-truco');
const btnCorrerTruco = document.getElementById('btn-correr-truco');

// Mão de 11 Controles
const modalMao11 = document.getElementById('modal-mao11');
const btnAceitarMao11 = document.getElementById('btn-aceitar-mao11');
const btnCorrerMao11 = document.getElementById('btn-correr-mao11');

// Esconder Carta (Virada)
const containerEsconderCarta = document.getElementById('container-esconder-carta');
const chkEsconderCarta = document.getElementById('chk-esconder-carta');

// Overlays
const overlayZap = document.getElementById('overlay-zap');
const textoEfeitoZap = document.getElementById('texto-efeito-zap');
const cartaZapGrande = document.getElementById('carta-zap-grande');
const overlayEmbaralhar = document.getElementById('overlay-embaralhar');

// Modal Desconexão
const modalDesconexao = document.getElementById('modal-desconexao');
const textoModalDesconexao = document.getElementById('texto-modal-desconexao');
const btnConfirmarDesconexao = document.getElementById('btn-confirmar-desconexao');
const btnAguardarReconexao = document.getElementById('btn-aguardar-reconexao');

let meuApelido = '';
let meuTime = '';
let valorMaoAtual = 1;
let numRodadaAtual = 1;

// Alternância do Modal de Regras
btnAbrirRegras.onclick = () => modalRegras.style.display = 'flex';
btnFecharRegras.onclick = () => modalRegras.style.display = 'none';

// Navegação do Login
btnAbrirCriar.onclick = () => { cardEntrar.style.display = 'none'; cardCriar.style.display = 'block'; };
btnVoltarEntrar.onclick = () => { cardCriar.style.display = 'none'; cardEntrar.style.display = 'block'; };

btnEntrar.onclick = () => {
  const apelido = document.getElementById('input-apelido').value.trim();
  const nomeSala = document.getElementById('input-sala').value.trim();
  if (!apelido || !nomeSala) return alert('Preencha apelido e sala!');
  socket.emit('entrarSala', { apelido, nomeSala });
};

btnConfirmarCriar.onclick = () => {
  const apelido = document.getElementById('input-criar-apelido').value.trim();
  const nomeSala = document.getElementById('input-criar-sala').value.trim();
  const maxJogadores = document.getElementById('select-max-jogadores').value;
  if (!apelido || !nomeSala) return alert('Preencha apelido e nome da sala!');
  socket.emit('criarSala', { apelido, nomeSala, maxJogadores });
};

socket.on('erroEntrada', (msg) => alert(msg));

socket.on('sucessoEntrada', (data) => {
  meuApelido = data.apelido;
  meuTime = data.time;
  modalDesconexao.style.display = 'none';
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

// Ações de Pedir Truco
btnPedirTruco.onclick = () => socket.emit('pedirTruco');

socket.on('solicitacaoTruco', (data) => {
  if (data.pediuTime !== meuTime) {
    modalTruco.style.display = 'block';
    let rotulo = 'TRUCO!';
    if (data.valorProposto === 6) rotulo = 'SEIS!';
    if (data.valorProposto === 9) rotulo = 'NOVE!';
    if (data.valorProposto === 12) rotulo = '12!';

    textoTrucoPedido.innerText = `${data.pediuApelido} pediu ${rotulo}`;
    btnAceitarTruco.innerText = `Aceitar (${data.valorProposto} pts)`;

    if (data.valorProposto >= 12) {
      btnAumentarTruco.style.display = 'none';
    } else {
      btnAumentarTruco.style.display = 'inline-block';
      let prox = 'Pedir 6';
      if (data.valorProposto === 6) prox = 'Pedir 9';
      if (data.valorProposto === 9) prox = 'Pedir 12';
      btnAumentarTruco.innerText = prox;
    }
  } else {
    document.getElementById('status-vez').innerText = `Aguardando resposta do adversário (${data.valorProposto} pts)...`;
  }
});

btnAceitarTruco.onclick = () => {
  modalTruco.style.display = 'none';
  socket.emit('respostaTruco', { aceitou: true, aumentar: false });
};

btnCorrerTruco.onclick = () => {
  modalTruco.style.display = 'none';
  socket.emit('respostaTruco', { aceitou: false, aumentar: false });
};

btnAumentarTruco.onclick = () => {
  modalTruco.style.display = 'none';
  socket.emit('respostaTruco', { aceitou: true, aumentar: true });
};

// Alternância e Controle Visual do Botão
socket.on('atualizarEstadoTruco', (data) => {
  valorMaoAtual = data.valorMao;
  document.getElementById('label-valor-mao').innerText = valorMaoAtual;

  // Só pode pedir aumento se NÃO FOI seu time quem pediu por último
  const podeAumentar = (data.ultimoPediuTime !== meuTime) && !data.bloqueado && valorMaoAtual < 12;

  if (podeAumentar) {
    btnPedirTruco.style.display = 'inline-block';
    if (valorMaoAtual === 1) btnPedirTruco.innerText = 'TRUCO!';
    else if (valorMaoAtual === 3) btnPedirTruco.innerText = 'SEIS!';
    else if (valorMaoAtual === 6) btnPedirTruco.innerText = 'NOVE!';
    else if (valorMaoAtual === 9) btnPedirTruco.innerText = '12!';
  } else {
    btnPedirTruco.style.display = 'none';
  }
});

// Decisão Mão de 11
btnAceitarMao11.onclick = () => {
  modalMao11.style.display = 'none';
  socket.emit('respostaMao11', true);
};

btnCorrerMao11.onclick = () => {
  modalMao11.style.display = 'none';
  socket.emit('respostaMao11', false);
};

socket.on('decisaoMao11Pendente', (data) => {
  if (data.timeNaMao11 === meuTime) {
    modalMao11.style.display = 'block';
  } else {
    document.getElementById('status-vez').innerText = `Aguardando o Time ${data.timeNaMao11} decidir a Mão de 11...`;
  }
});

function atualizarBolinhas(historicoRodadas) {
  const bolinhasA = document.querySelectorAll('#bolinhas-a .bolinha');
  const bolinhasB = document.querySelectorAll('#bolinhas-b .bolinha');

  bolinhasA.forEach(b => b.className = 'bolinha');
  bolinhasB.forEach(b => b.className = 'bolinha');

  historicoRodadas.forEach((res, idx) => {
    if (idx >= 3) return;
    if (res === 'A') {
      bolinhasA[idx].classList.add('vitoria');
      bolinhasB[idx].classList.add('derrota');
    } else if (res === 'B') {
      bolinhasB[idx].classList.add('vitoria');
      bolinhasA[idx].classList.add('derrota');
    } else if (res === 'Empate') {
      bolinhasA[idx].classList.add('empate');
      bolinhasB[idx].classList.add('empate');
    }
  });
}

socket.on('novaMao', (data) => {
  overlayEmbaralhar.style.display = 'flex';

  setTimeout(() => {
    overlayEmbaralhar.style.display = 'none';
    valorMaoAtual = data.valorMao;
    numRodadaAtual = 1;
    chkEsconderCarta.checked = false;
    containerEsconderCarta.style.display = 'none';

    document.getElementById('label-valor-mao').innerText = valorMaoAtual;
    document.getElementById('pontos-a').innerText = data.pontosA;
    document.getElementById('pontos-b').innerText = data.pontosB;
    document.getElementById('status-vez').innerText = `Vez de: ${data.vez}`;
    document.getElementById('label-manilha').innerText = `Manilha: ${data.valorManilha || '-'}`;

    modalTruco.style.display = 'none';
    modalMao11.style.display = 'none';

    if (data.isMaoDe11 || data.maoDeFerro) {
      btnPedirTruco.style.display = 'none';
    } else {
      btnPedirTruco.style.display = 'inline-block';
      btnPedirTruco.innerText = 'TRUCO!';
    }

    atualizarBolinhas([]);

    const viraEl = document.getElementById('carta-vira');
    if (data.maoDeFerro) {
      viraEl.innerText = '🂠';
      viraEl.className = 'carta vira escuro';
    } else {
      viraEl.innerText = `${data.vira.valor}${data.vira.naipe}`;
      viraEl.className = 'carta vira' + (data.vira.naipe === '♦' || data.vira.naipe === '♥' ? ' vermelho' : '');
    }
  }, 1200);
});

socket.on('atualizarRodadasMao', (historicoRodadas) => {
  atualizarBolinhas(historicoRodadas);
  numRodadaAtual = historicoRodadas.length + 1;

  if (numRodadaAtual >= 2) {
    containerEsconderCarta.style.display = 'inline-block';
  } else {
    containerEsconderCarta.style.display = 'none';
  }
});

socket.on('minhasCartas', (data) => {
  const container = document.getElementById('minhas-cartas');
  container.innerHTML = '';

  data.cartas.forEach((c, idx) => {
    const cardEl = document.createElement('div');
    if (data.noEscuro) {
      cardEl.className = 'carta escuro';
      cardEl.innerText = '🂠';
    } else {
      cardEl.className = 'carta' + (c.naipe === '♦' || c.naipe === '♥' ? ' vermelho' : '');
      cardEl.innerText = `${c.valor}${c.naipe}`;
    }

    cardEl.onclick = () => {
      const esconder = chkEsconderCarta.checked && numRodadaAtual >= 2;
      socket.emit('jogarCarta', { indiceCarta: idx, esconder });
      chkEsconderCarta.checked = false;
    };

    container.appendChild(cardEl);
  });
});

socket.on('atualizarMesa', (cartasMesa) => {
  const container = document.getElementById('cartas-mesa');
  container.innerHTML = '';

  cartasMesa.forEach(item => {
    const cardEl = document.createElement('div');
    if (item.escondida) {
      cardEl.className = 'carta escuro';
      cardEl.innerText = '🂠';
    } else {
      cardEl.className = 'carta' + (item.carta.naipe === '♦' || item.carta.naipe === '♥' ? ' vermelho' : '');
      cardEl.innerText = `${item.carta.valor}${item.carta.naipe}`;
    }
    container.appendChild(cardEl);
  });
});

socket.on('efeitoManilhaZap', (data) => {
  textoEfeitoZap.innerText = data.isZap ? '💥 ZAP! 💥' : 'MANILHA!';
  cartaZapGrande.innerText = `${data.carta.valor}${data.carta.naipe}`;
  if (data.carta.naipe === '♦' || data.carta.naipe === '♥') cartaZapGrande.classList.add('vermelho');
  else cartaZapGrande.classList.remove('vermelho');

  overlayZap.style.display = 'flex';
  setTimeout(() => overlayZap.style.display = 'none', 1600);
});

socket.on('jogadorDesconectado', (data) => {
  textoModalDesconexao.innerText = `O jogador (${data.apelido}) caiu da sala.`;
  modalDesconexao.style.display = 'flex';
});

btnAguardarReconexao.onclick = () => {
  modalDesconexao.style.display = 'none';
  document.getElementById('status-vez').innerText = '⏳ Aguardando reconexão...';
};

btnConfirmarDesconexao.onclick = () => {
  socket.emit('destruirSalaForcado');
  modalDesconexao.style.display = 'none';
  appContainer.style.display = 'none';
  loginContainer.style.display = 'block';
};

socket.on('salaDestruida', (msg) => {
  alert(msg || 'A sala foi encerrada.');
  modalDesconexao.style.display = 'none';
  appContainer.style.display = 'none';
  loginContainer.style.display = 'block';
});

socket.on('atualizarVez', (apelido) => {
  document.getElementById('status-vez').innerText = apelido.includes('Aguardando') ? apelido : `Vez de: ${apelido}`;
});

socket.on('fimDePartida', (data) => {
  alert(`🏆 Fim de partida! Vencedor: Time ${data.vencedor}`);
});
