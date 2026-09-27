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

// Elementos Mão de 11
const modalMao11 = document.getElementById('modal-mao11');
const btnAceitarMao11 = document.getElementById('btn-aceitar-mao11');
const btnCorrerMao11 = document.getElementById('btn-correr-mao11');

// Esconder Carta
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

// Alternar Telas de Login
btnAbrirCriar.onclick = () => {
  cardEntrar.style.display = 'none';
  cardCriar.style.display = 'block';
};

btnVoltarEntrar.onclick = () => {
  cardCriar.style.display = 'none';
  cardEntrar.style.display = 'block';
};

btnEntrar.onclick = () => {
  const apelido = document.getElementById('input-apelido').value.trim();
  const nomeSala = document.getElementById('input-sala').value.trim();

  if (!apelido || !nomeSala) {
    alert('Por favor, preencha o apelido e o nome da sala!');
    return;
  }

  socket.emit('entrarSala', { apelido, nomeSala });
};

btnConfirmarCriar.onclick = () => {
  const apelido = document.getElementById('input-criar-apelido').value.trim();
  const nomeSala = document.getElementById('input-criar-sala').value.trim();
  const maxJogadores = document.getElementById('select-max-jogadores').value;

  if (!apelido || !nomeSala) {
    alert('Por favor, preencha o apelido e o nome da nova sala!');
    return;
  }

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

// AÇÕES E PEDIDOS DE TRUCO / AUMENTO
btnPedirTruco.onclick = () => {
  socket.emit('pedirTruco');
};

socket.on('solicitacaoTruco', (data) => {
  // Se quem pediu não é do meu time, exibimos a caixa de resposta
  if (data.pediuTime !== meuTime) {
    modalTruco.style.display = 'block';
    
    let rotulo = 'TRUCO!';
    if (data.valorProposto === 6) rotulo = 'SEIS!';
    if (data.valorProposto === 9) rotulo = 'NOVE!';
    if (data.valorProposto === 12) rotulo = '12!';

    textoTrucoPedido.innerText = `${data.pediuApelido} pediu ${rotulo}`;
    btnAceitarTruco.innerText = `Aceitar (${data.valorProposto} pts)`;

    // Se a aposta já for 12, a opção de aumentar mais é removida
    if (data.valorProposto >= 12) {
      btnAumentarTruco.style.display = 'none';
    } else {
      btnAumentarTruco.style.display = 'inline-block';
      let proximoRotulo = 'Pedir 6';
      if (data.valorProposto === 6) proximoRotulo = 'Pedir 9';
      if (data.valorProposto === 9) proximoRotulo = 'Pedir 12';
      btnAumentarTruco.innerText = proximoRotulo;
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

// ATUALIZAÇÃO DO BOTÃO DE TRUCO DE ACORDO COM QUEM PODE AUMENTAR
socket.on('atualizarEstadoTruco', (data) => {
  valorMaoAtual = data.valorMao;
  document.getElementById('label-valor-mao').innerText = valorMaoAtual;

  // Regra de alternância: só pode aumentar se NINGUÉM do seu time fez o último pedido
  const podeAumentar = (data.ultimoPediuTime !== meuTime) && !data.bloqueado && valorMaoAtual < 12;

  if (podeAumentar) {
    btnPedirTruco.style.display = 'inline-block';
    if (valorMaoAtual === 1) btnPedirTruco.innerText = 'TRUCO!';
    else if (valorMaoAtual === 3) btnPedirTruco.innerText = 'SEIS!';
    else if (valorMaoAtual === 6) btnPedirTruco.innerText = 'NOVE!';
    else if (valorMaoAtual === 9) btnPedirTruco.innerText = '12!';
  } else {
    btnPedirTruco.style.display = 'none'; // Desabilita/Esconde botão se foi o meu time que pediu
  }
});

// DECISÃO DA MÃO DE 11
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
    document.getElementById('status-vez').innerText = `Aguardando o Time ${data.timeNaMao11} decidir se joga a Mão de 11...`;
  }
});

// ATUALIZAR INDICADORES DE VITÓRIA NAS RODADAS
function atualizarBolinhas(historicoRodadas) {
  const bolinhasA = document.querySelectorAll('#bolinhas-a .bolinha');
  const bolinhasB = document.querySelectorAll('#bolinhas-b .bolinha');

  bolinhasA.forEach(b => b.className = 'bolinha');
  bolinhasB.forEach(b => b.className = 'bolinha');

  historicoRodadas.forEach((resultado, index) => {
    if (index >= 3) return;

    if (resultado === 'A') {
      bolinhasA[index].classList.add('vitoria');
      bolinhasB[index].classList.add('derrota');
    } else if (resultado === 'B') {
      bolinhasB[index].classList.add('vitoria');
      bolinhasA[index].classList.add('derrota');
    } else if (resultado === 'Empate') {
      bolinhasA[index].classList.add('empate');
      bolinhasB[index].classList.add('empate');
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

  // Exibe a opção de esconder carta apenas a partir da 2ª rodada
  if (numRodadaAtual >= 2) {
    containerEsconderCarta.style.display = 'inline-block';
  } else {
    containerEsconderCarta.style.display = 'none';
  }
});

socket.on('minhasCartas', (data) => {
  const container = document.getElementById('minhas-cartas');
  container.innerHTML = '';

  const cartas = data.cartas;
  const noEscuro = data.noEscuro;

  cartas.forEach((c, index) => {
    const cardEl = document.createElement('div');

    if (noEscuro) {
      cardEl.className = 'carta escuro';
      cardEl.innerText = '🂠';
    } else {
      cardEl.className = 'carta' + (c.naipe === '♦' || c.naipe === '♥' ? ' vermelho' : '');
      cardEl.innerText = `${c.valor}${c.naipe}`;
    }

    cardEl.onclick = () => {
      const esconder = chkEsconderCarta.checked && numRodadaAtual >= 2;
      socket.emit('jogarCarta', { indiceCarta: index, esconder });
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

// Efeito Visual de Manilha e Zap
socket.on('efeitoManilhaZap', (data) => {
  textoEfeitoZap.innerText = data.isZap ? '💥 ZAP! 💥' : 'MANILHA!';
  cartaZapGrande.innerText = `${data.carta.valor}${data.carta.naipe}`;

  if (data.carta.naipe === '♦' || data.carta.naipe === '♥') {
    cartaZapGrande.classList.add('vermelho');
  } else {
    cartaZapGrande.classList.remove('vermelho');
  }

  overlayZap.style.display = 'flex';

  setTimeout(() => {
    overlayZap.style.display = 'none';
  }, 1600);
});

// Eventos de Desconexão e Fim de Partida
socket.on('jogadorDesconectado', (data) => {
  textoModalDesconexao.innerText = `O jogador (${data.apelido}) caiu ou saiu da sala.\nVocê pode aguardar ele entrar de novo ou destruir a sala.`;
  modalDesconexao.style.display = 'flex';
});

btnAguardarReconexao.onclick = () => {
  modalDesconexao.style.display = 'none';
  document.getElementById('status-vez').innerText = '⏳ Aguardando jogador reconectar...';
};

btnConfirmarDesconexao.onclick = () => {
  socket.emit('destruirSalaForcado');
  modalDesconexao.style.display = 'none';
  appContainer.style.display = 'none';
  loginContainer.style.display = 'block';
};

socket.on('salaDestruida', (msg) => {
  alert(msg || 'A sala foi encerrada e excluída.');
  modalDesconexao.style.display = 'none';
  appContainer.style.display = 'none';
  loginContainer.style.display = 'block';
});

socket.on('atualizarVez', (apelido) => {
  document.getElementById('status-vez').innerText = apelido.includes('Aguardando') ? apelido : `Vez de: ${apelido}`;
});

socket.on('fimDePartida', (data) => {
  alert(`🏆 Fim de partida (12 Pts)! Vencedor: ${data.vencedor}\nA partida será reiniciada mantendo os troféus!`);
});
