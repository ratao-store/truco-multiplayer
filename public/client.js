const socket = io();

// ============================================================
// ÁUDIO E SÍNTESE DE VOZ
// ============================================================

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function falarTexto(texto) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.pitch = 1.1;
    utterance.rate = 1.1;

    window.speechSynthesis.speak(utterance);
  }
}

function tocarSom(frequencia = 300, duracao = 0.12, tipo = 'sine') {
  initAudio();

  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = tipo;
  osc.frequency.setValueAtTime(frequencia, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.01,
    audioCtx.currentTime + duracao
  );

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duracao);
}

function playSoundPlayCard() {
  tocarSom(300, 0.1, 'sine');

  setTimeout(() => {
    tocarSom(180, 0.08, 'sine');
  }, 40);
}

function playSoundTruco() {
  tocarSom(500, 0.12, 'square');

  setTimeout(() => {
    tocarSom(700, 0.14, 'square');
  }, 100);

  setTimeout(() => {
    tocarSom(900, 0.18, 'square');
  }, 220);
}

function playSoundCorreu() {
  tocarSom(250, 0.12, 'sawtooth');

  setTimeout(() => {
    tocarSom(160, 0.2, 'sawtooth');
  }, 100);
}

function playSoundUltimaCarta() {
  tocarSom(650, 0.1, 'triangle');

  setTimeout(() => {
    tocarSom(800, 0.15, 'triangle');
  }, 120);
}

function playSoundAceitou() {
  tocarSom(450, 0.1, 'sine');

  setTimeout(() => {
    tocarSom(650, 0.15, 'sine');
  }, 100);
}


// ============================================================
// ELEMENTOS DOM
// ============================================================

const cardEntrar = document.getElementById('card-entrar');
const cardCriar = document.getElementById('card-criar');
const btnAbrirCriar = document.getElementById('btn-abrir-criar');
const btnVoltarEntrar = document.getElementById('btn-voltar-entrar');
const btnEntrar = document.getElementById('btn-entrar');
const btnConfirmarCriar = document.getElementById('btn-confirmar-criar');

const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app');

const modalRegras = document.getElementById('modal-regras');
const btnAbrirRegras = document.getElementById('btn-abrir-regras');
const btnFecharRegras = document.getElementById('btn-fechar-regras');

const modalQRCode = document.getElementById('modal-qrcode');
const btnAbrirQRCode = document.getElementById('btn-abrir-qrcode');
const btnFecharQRCode = document.getElementById('btn-fechar-qrcode');
const inputLinkConvite = document.getElementById('input-link-convite');
const btnCopiarLink = document.getElementById('btn-copiar-link');

const selectTemaMesa = document.getElementById('select-tema-mesa');

const btnAdicionarBot = document.getElementById('btn-adicionar-bot');
const btnIniciarPartida = document.getElementById('btn-iniciar-partida');

const btnPedirTruco = document.getElementById('btn-pedir-truco');
const btnCorrerRodada = document.getElementById('btn-correr-rodada');

const modalTruco = document.getElementById('modal-truco');
const textoTrucoPedido = document.getElementById('texto-truco-pedido');
const btnAceitarTruco = document.getElementById('btn-aceitar-truco');
const btnAumentarTruco = document.getElementById('btn-aumentar-truco');
const btnCorrerTruco = document.getElementById('btn-correr-truco');

const modalMao11 = document.getElementById('modal-mao11');
const btnAceitarMao11 = document.getElementById('btn-aceitar-mao11');
const btnCorrerMao11 = document.getElementById('btn-correr-mao11');

const containerEsconderCarta =
  document.getElementById('container-esconder-carta');

const chkEsconderCarta =
  document.getElementById('chk-esconder-carta');

const overlayZap =
  document.getElementById('overlay-zap');

const textoEfeitoZap =
  document.getElementById('texto-efeito-zap');

const cartaZapGrande =
  document.getElementById('carta-zap-grande');

const overlayEmbaralhar =
  document.getElementById('overlay-embaralhar');

const overlayContagem =
  document.getElementById('overlay-contagem');

const numeroContagem =
  document.getElementById('numero-contagem');

const overlayCorreu =
  document.getElementById('overlay-correu');

const textoCorreu =
  document.getElementById('texto-correu');

const subtextoCorreu =
  document.getElementById('subtexto-correu');

const iconeCorreu =
  document.getElementById('icone-correu');

const overlayAposta =
  document.getElementById('overlay-aposta');

const textoAposta =
  document.getElementById('texto-aposta');

const subtextoAposta =
  document.getElementById('subtexto-aposta');

const iconeAposta =
  document.getElementById('icone-aposta');

const overlayUltimaCarta =
  document.getElementById('overlay-ultima-carta');

const textoUltimaCarta =
  document.getElementById('texto-ultima-carta');

const overlayVitoria =
  document.getElementById('overlay-vitoria');

const textoVitoria =
  document.getElementById('texto-vitoria');

const detalhesVitoria =
  document.getElementById('detalhes-vitoria');

const btnFecharVitoria =
  document.getElementById('btn-fechar-vitoria');

const modalDesconexao =
  document.getElementById('modal-desconexao');

const textoModalDesconexao =
  document.getElementById('texto-modal-desconexao');

const btnConfirmarDesconexao =
  document.getElementById('btn-confirmar-desconexao');

const timerContainer =
  document.getElementById('timer-turn');

const timerSpan =
  document.getElementById('tempo-restante');


// ============================================================
// CHAT
// ============================================================

const btnToggleChat =
  document.getElementById('btn-toggle-chat');

const boxChatSlide =
  document.getElementById('box-chat-slide');

const btnFecharChat =
  document.getElementById('btn-fechar-chat');

const btnEnviarChat =
  document.getElementById('btn-enviar-chat');

const inputMsgChat =
  document.getElementById('input-msg-chat');

const mensagensChat =
  document.getElementById('mensagens-chat');

const badgeChatUnread =
  document.getElementById('badge-chat-unread');


// ============================================================
// ESTADO DO JOGO
// ============================================================

let meuApelido = '';
let meuAvatar = '🥸';
let meuTime = '';
let nomeSalaAtual = '';

let valorMaoAtual = 1;
let numRodadaAtual = 1;

let eMinhaVez = false;
let bloqueioJogada = false;

let intervalTimer = null;
let chatAberto = false;
let souDonoSala = false;

let aguardandoDecisaoMao11 = false;

let timeoutCorreu = null;
let timeoutAposta = null;
let timeoutUltimaCarta = null;

let ultimaQuantidadeCartas = 0;


// ============================================================
// FUNÇÕES DE ANIMAÇÃO
// ============================================================

function mostrarAnimacaoCorreu(apelido = '') {

  if (!overlayCorreu) return;

  if (timeoutCorreu) {
    clearTimeout(timeoutCorreu);
  }

  initAudio();
  playSoundCorreu();

  if (textoCorreu) {
    textoCorreu.innerText = apelido
      ? `${apelido} CORREU!`
      : 'CORREU!';
  }

  if (subtextoCorreu) {
    subtextoCorreu.innerText =
      'Fugiu da mão!';
  }

  if (iconeCorreu) {
    iconeCorreu.innerText = '🏃‍♂️💨';
  }

  overlayCorreu.style.display = 'flex';

  timeoutCorreu = setTimeout(() => {
    overlayCorreu.style.display = 'none';
  }, 1800);
}


function mostrarAnimacaoAposta(valor, apelido = '') {

  if (!overlayAposta) return;

  if (timeoutAposta) {
    clearTimeout(timeoutAposta);
  }

  playSoundTruco();

  let titulo = 'TRUCO!';

  if (valor === 6) {
    titulo = 'SEIS!';
  } else if (valor === 9) {
    titulo = 'NOVE!';
  } else if (valor === 12) {
    titulo = 'DOZE!';
  }

  if (textoAposta) {
    textoAposta.innerText = titulo;
  }

  if (subtextoAposta) {
    subtextoAposta.innerText = apelido
      ? `${apelido} pediu ${titulo}`
      : 'A mão ficou mais valiosa!';
  }

  if (iconeAposta) {
    iconeAposta.innerText =
      valor >= 12 ? '💥' :
      valor >= 9 ? '🔥' :
      valor >= 6 ? '⚡' :
      '🗣️';
  }

  overlayAposta.style.display = 'flex';

  timeoutAposta = setTimeout(() => {
    overlayAposta.style.display = 'none';
  }, 1600);
}


function mostrarUltimaCarta(apelido = '') {

  if (!overlayUltimaCarta) return;

  if (timeoutUltimaCarta) {
    clearTimeout(timeoutUltimaCarta);
  }

  playSoundUltimaCarta();

  if (textoUltimaCarta) {
    textoUltimaCarta.innerText = apelido
      ? `${apelido} está com apenas uma carta!`
      : 'Você está com apenas uma carta!';
  }

  overlayUltimaCarta.style.display = 'flex';

  timeoutUltimaCarta = setTimeout(() => {
    overlayUltimaCarta.style.display = 'none';
  }, 1500);
}


// ============================================================
// CHAT RETRÁTIL
// ============================================================

btnToggleChat.onclick = () => {

  chatAberto = !chatAberto;

  if (chatAberto) {

    boxChatSlide.classList.add('aberto');

    badgeChatUnread.style.display = 'none';

  } else {

    boxChatSlide.classList.remove('aberto');

  }
};


btnFecharChat.onclick = () => {

  chatAberto = false;

  boxChatSlide.classList.remove('aberto');

};


btnEnviarChat.onclick = () => {

  const texto = inputMsgChat.value.trim();

  if (!texto) return;

  socket.emit('enviarChat', texto);

  inputMsgChat.value = '';

};


inputMsgChat.addEventListener('keydown', (event) => {

  if (event.key === 'Enter') {
    event.preventDefault();
    btnEnviarChat.click();
  }

});


socket.on('receberChat', (data) => {

  const p = document.createElement('p');

  p.innerHTML =
    `<strong style="color:var(--gold-primary);">
      ${data.apelido}:
    </strong> ${data.texto}`;

  mensagensChat.appendChild(p);

  mensagensChat.scrollTop =
    mensagensChat.scrollHeight;

  if (!chatAberto) {
    badgeChatUnread.style.display = 'flex';
  }

});


// ============================================================
// TROCA DE TEMA
// ============================================================

selectTemaMesa.onchange = (e) => {

  document.body.className =
    e.target.value;

};


// ============================================================
// REGRAS
// ============================================================

btnAbrirRegras.onclick = () => {

  modalRegras.style.display = 'flex';

};


btnFecharRegras.onclick = () => {

  modalRegras.style.display = 'none';

};


// ============================================================
// QR CODE
// ============================================================

btnAbrirQRCode.onclick = () => {

  const link =
    `${window.location.origin}/?sala=${encodeURIComponent(nomeSalaAtual)}`;

  inputLinkConvite.value = link;

  const container =
    document.getElementById('qrcode-container');

  container.innerHTML = '';

  new QRCode(container, {
    text: link,
    width: 128,
    height: 128
  });

  modalQRCode.style.display = 'flex';

};


btnFecharQRCode.onclick = () => {

  modalQRCode.style.display = 'none';

};


btnCopiarLink.onclick = () => {

  navigator.clipboard
    .writeText(inputLinkConvite.value)
    .then(() => {
      alert('Link copiado!');
    })
    .catch(() => {
      inputLinkConvite.select();
      document.execCommand('copy');
      alert('Link copiado!');
    });

};


// ============================================================
// LOGIN
// ============================================================

btnAbrirCriar.onclick = () => {

  cardEntrar.style.display = 'none';
  cardCriar.style.display = 'block';

};


btnVoltarEntrar.onclick = () => {

  cardCriar.style.display = 'none';
  cardEntrar.style.display = 'block';

};


btnEntrar.onclick = () => {

  initAudio();

  const apelido =
    document.getElementById('input-apelido')
      .value.trim();

  const nomeSala =
    document.getElementById('input-sala')
      .value.trim();

  const avatar =
    document.getElementById('select-avatar-login')
      .value;

  if (!apelido || !nomeSala) {
    return alert('Preencha apelido e sala!');
  }

  meuAvatar = avatar;

  socket.emit('entrarSala', {
    apelido,
    avatar,
    nomeSala
  });

};


btnConfirmarCriar.onclick = () => {

  initAudio();

  const apelido =
    document.getElementById('input-criar-apelido')
      .value.trim();

  const nomeSala =
    document.getElementById('input-criar-sala')
      .value.trim();

  const avatar =
    document.getElementById('select-avatar-criar')
      .value;

  const maxJogadores =
    document.getElementById('select-max-jogadores')
      .value;

  if (!apelido || !nomeSala) {
    return alert(
      'Preencha apelido e nome da sala!'
    );
  }

  meuAvatar = avatar;

  socket.emit('criarSala', {
    apelido,
    avatar,
    nomeSala,
    maxJogadores
  });

};


socket.on('erroEntrada', (msg) => {

  alert(msg);

});


socket.on('sucessoEntrada', (data) => {

  meuApelido = data.apelido;
  meuTime = data.time;
  nomeSalaAtual = data.nomeSala;
  souDonoSala = data.isDono;

  modalDesconexao.style.display = 'none';

  loginContainer.style.display = 'none';

  appContainer.style.display = 'flex';

  btnToggleChat.style.display = 'flex';

  if (souDonoSala) {

    btnAbrirQRCode.style.display =
      'inline-block';

  } else {

    btnAbrirQRCode.style.display =
      'none';

  }

  document.getElementById(
    'label-nome-sala'
  ).innerText = data.nomeSala;

  document.getElementById(
    'meu-info'
  ).innerText =
    `${meuAvatar} ${meuApelido} (Time ${meuTime})`;

});


// ============================================================
// JOGADORES DA SALA
// ============================================================

socket.on('atualizarJogadores', (data) => {

  const {
    jogadores,
    jogoIniciado
  } = data;

  const timeA =
    jogadores
      .filter(j => j.time === 'A')
      .map(j => `${j.avatar || ''} ${j.apelido}`)
      .join(' & ');

  const timeB =
    jogadores
      .filter(j => j.time === 'B')
      .map(j => `${j.avatar || ''} ${j.apelido}`)
      .join(' & ');

  document.getElementById(
    'nome-time-a'
  ).innerText =
    timeA || 'Aguardando...';

  document.getElementById(
    'nome-time-b'
  ).innerText =
    timeB || 'Aguardando...';


  if (!jogoIniciado) {

    if (souDonoSala) {

      btnAdicionarBot.style.display =
        jogadores.length < 4
          ? 'inline-block'
          : 'none';

      btnIniciarPartida.style.display =
        jogadores.length >= 2
          ? 'inline-block'
          : 'none';

    } else {

      btnAdicionarBot.style.display =
        'none';

      btnIniciarPartida.style.display =
        'none';

    }

  } else {

    btnAdicionarBot.style.display =
      'none';

    btnIniciarPartida.style.display =
      'none';

  }

});


btnAdicionarBot.onclick = () => {

  socket.emit('adicionarBot');

};


btnIniciarPartida.onclick = () => {

  socket.emit('solicitarInicioPartida');

};


// ============================================================
// CONTAGEM REGRESSIVA
// ============================================================

socket.on('iniciarContagemRegressiva', () => {

  overlayContagem.style.display =
    'flex';

  let c = 5;

  numeroContagem.innerText = c;

  let t = setInterval(() => {

    c--;

    if (c > 0) {

      numeroContagem.innerText = c;

    } else {

      clearInterval(t);

      overlayContagem.style.display =
        'none';

    }

  }, 1000);

});


// ============================================================
// TROFÉUS
// ============================================================

socket.on('atualizarTrofeus', (data) => {

  document.getElementById(
    'trofeus-a'
  ).innerText =
    `🏆 ${data.a}`;

  document.getElementById(
    'trofeus-b'
  ).innerText =
    `🏆 ${data.b}`;

});


// ============================================================
// PEDIR TRUCO
// ============================================================

btnPedirTruco.onclick = () => {

  initAudio();

  socket.emit('pedirTruco');

};


// ============================================================
// CORRER VOLUNTARIAMENTE
// ============================================================

btnCorrerRodada.onclick = () => {

  if (
    confirm(
      'Deseja realmente correr desta mão?'
    )
  ) {

    socket.emit(
      'correrVoluntario'
    );

  }

};


// ============================================================
// PEDIDO DE TRUCO / SEIS / NOVE / DOZE
// ============================================================

socket.on('solicitacaoTruco', (data) => {

  let textoVoz =
    'pediu truco!';

  if (data.valorProposto === 6) {
    textoVoz =
      'pediu seis!';
  }

  else if (data.valorProposto === 9) {
    textoVoz =
      'pediu nove!';
  }

  else if (data.valorProposto === 12) {
    textoVoz =
      'pediu doze!';
  }


  falarTexto(
    `${data.pediuApelido} ${textoVoz}`
  );


  mostrarAnimacaoAposta(
    data.valorProposto,
    data.pediuApelido
  );


  if (data.pediuTime !== meuTime) {

    modalTruco.style.display =
      'block';

    let rotulo =
      'TRUCO!';

    if (data.valorProposto === 6) {
      rotulo = 'SEIS!';
    }

    if (data.valorProposto === 9) {
      rotulo = 'NOVE!';
    }

    if (data.valorProposto === 12) {
      rotulo = '12!';
    }


    textoTrucoPedido.innerText =
      `${data.pediuApelido} pediu ${rotulo}`;


    btnAceitarTruco.innerText =
      `Aceitar (${data.valorProposto} pts)`;


    if (data.valorProposto >= 12) {

      btnAumentarTruco.style.display =
        'none';

    } else {

      btnAumentarTruco.style.display =
        'inline-block';

      let prox =
        'Pedir 6';

      if (data.valorProposto === 6) {
        prox = 'Pedir 9';
      }

      if (data.valorProposto === 9) {
        prox = 'Pedir 12';
      }

      btnAumentarTruco.innerText =
        prox;

    }

  } else {

    document.getElementById(
      'status-vez'
    ).innerText =
      'Aguardando resposta do adversário...';

  }

});


// ============================================================
// ACEITAR TRUCO
// ============================================================

btnAceitarTruco.onclick = () => {

  modalTruco.style.display =
    'none';

  socket.emit(
    'respostaTruco',
    {
      aceitou: true,
      aumentar: false
    }
  );

};


// ============================================================
// CORRER DO TRUCO
// ============================================================

btnCorrerTruco.onclick = () => {

  modalTruco.style.display =
    'none';

  socket.emit(
    'respostaTruco',
    {
      aceitou: false,
      aumentar: false
    }
  );

};


// ============================================================
// AUMENTAR TRUCO
// ============================================================

btnAumentarTruco.onclick = () => {

  modalTruco.style.display =
    'none';

  socket.emit(
    'respostaTruco',
    {
      aceitou: true,
      aumentar: true
    }
  );

};


// ============================================================
// ESTADO DO TRUCO
// ============================================================

socket.on('atualizarEstadoTruco', (data) => {

  valorMaoAtual =
    data.valorMao;

  document.getElementById(
    'label-valor-mao'
  ).innerText =
    valorMaoAtual;


  const podeAumentar =
    (data.ultimoPediuTime !== meuTime) &&
    !data.bloqueado &&
    valorMaoAtual < 12;


  if (
    podeAumentar &&
    !data.isMaoDe11 &&
    !data.maoDeFerro
  ) {

    btnPedirTruco.style.display =
      'inline-block';


    if (valorMaoAtual === 1) {

      btnPedirTruco.innerText =
        'TRUCO!';

    }

    else if (valorMaoAtual === 3) {

      btnPedirTruco.innerText =
        'SEIS!';

    }

    else if (valorMaoAtual === 6) {

      btnPedirTruco.innerText =
        'NOVE!';

    }

    else if (valorMaoAtual === 9) {

      btnPedirTruco.innerText =
        '12!';

    }

  } else {

    btnPedirTruco.style.display =
      'none';

  }

});


// ============================================================
// EVENTO DE ACEITE DE TRUCO
// ============================================================

socket.on('jogadorAceitouTruco', (data) => {

  playSoundAceitou();

  if (data && data.apelido) {

    falarTexto(
      `${data.apelido} aceitou ${data.valor}!`
    );

    mostrarAnimacaoAposta(
      data.valor,
      `${data.apelido} aceitou`
    );

  } else {

    falarTexto(
      'Truco aceito!'
    );

  }

});


// ============================================================
// MÃO DE 11
// ============================================================

btnAceitarMao11.onclick = () => {

  aguardandoDecisaoMao11 = false;

  modalMao11.style.display =
    'none';

  btnCorrerRodada.style.display =
    'inline-block';

  socket.emit(
    'respostaMao11',
    true
  );

};


btnCorrerMao11.onclick = () => {

  aguardandoDecisaoMao11 = false;

  modalMao11.style.display =
    'none';

  socket.emit(
    'respostaMao11',
    false
  );

};


socket.on('decisaoMao11Pendente', (data) => {

  if (data.timeNaMao11 === meuTime) {

    aguardandoDecisaoMao11 = true;

    btnCorrerRodada.style.display =
      'none';

    modalTruco.style.display =
      'none';

    modalMao11.style.display =
      'block';

    document.getElementById(
      'status-vez'
    ).innerText =
      'Seu time está decidindo a Mão de 11...';

  } else {

    aguardandoDecisaoMao11 = false;

    modalMao11.style.display =
      'none';

    document.getElementById(
      'status-vez'
    ).innerText =
      `Time ${data.timeNaMao11} decidindo Mão de 11...`;

  }

});


// ============================================================
// BOLINHAS DAS RODADAS
// ============================================================

function atualizarBolinhas(historicoRodadas) {

  const bolinhasA =
    document.querySelectorAll(
      '#bolinhas-a .bolinha'
    );

  const bolinhasB =
    document.querySelectorAll(
      '#bolinhas-b .bolinha'
    );


  bolinhasA.forEach(
    b => b.className = 'bolinha'
  );

  bolinhasB.forEach(
    b => b.className = 'bolinha'
  );


  historicoRodadas.forEach(
    (res, idx) => {

      if (idx >= 3) return;


      if (res === 'A') {

        bolinhasA[idx]
          .classList
          .add('vitoria');

        bolinhasB[idx]
          .classList
          .add('derrota');

      }

      else if (res === 'B') {

        bolinhasB[idx]
          .classList
          .add('vitoria');

        bolinhasA[idx]
          .classList
          .add('derrota');

      }

      else if (res === 'Empate') {

        bolinhasA[idx]
          .classList
          .add('empate');

        bolinhasB[idx]
          .classList
          .add('empate');

      }

    }
  );

}


// ============================================================
// NOVA MÃO
// ============================================================

socket.on('novaMao', (data) => {

  aguardandoDecisaoMao11 = false;

  modalTruco.style.display =
    'none';

  modalMao11.style.display =
    'none';


  // Limpa imediatamente as cartas antigas da mesa.
  const mesa =
    document.getElementById('cartas-mesa');

  if (mesa) {
    mesa.innerHTML = '';
  }


  overlayEmbaralhar.style.display =
    'flex';


  setTimeout(() => {

    overlayEmbaralhar.style.display =
      'none';


    valorMaoAtual =
      data.valorMao;

    numRodadaAtual = 1;

    bloqueioJogada = false;

    chkEsconderCarta.checked =
      false;

    containerEsconderCarta.style.display =
      'none';


    document.getElementById(
      'label-valor-mao'
    ).innerText =
      valorMaoAtual;


    document.getElementById(
      'pontos-a'
    ).innerText =
      data.pontosA;


    document.getElementById(
      'pontos-b'
    ).innerText =
      data.pontosB;


    document.getElementById(
      'status-vez'
    ).innerText =
      `Vez de: ${data.vez}`;


    document.getElementById(
      'label-manilha'
    ).innerText =
      `Manilha: ${data.valorManilha || '-'}`;


    btnCorrerRodada.style.display =
      'inline-block';


    if (
      data.isMaoDe11 ||
      data.maoDeFerro
    ) {

      btnPedirTruco.style.display =
        'none';

    } else {

      btnPedirTruco.style.display =
        'inline-block';

      btnPedirTruco.innerText =
        'TRUCO!';

    }


    atualizarBolinhas([]);


    const viraEl =
      document.getElementById(
        'carta-vira'
      );


    if (data.maoDeFerro) {

      viraEl.innerText =
        '🂠';

      viraEl.className =
        'carta vira escuro';

    } else {

      viraEl.innerText =
        `${data.vira.valor}${data.vira.naipe}`;

      viraEl.className =
        'carta vira' +
        (
          data.vira.naipe === '♦' ||
          data.vira.naipe === '♥'
            ? ' vermelho'
            : ''
        );

    }

  }, 1200);

});


// ============================================================
// RODADAS DA MÃO
// ============================================================

socket.on('atualizarRodadasMao', (historicoRodadas) => {

  atualizarBolinhas(
    historicoRodadas
  );

  numRodadaAtual =
    historicoRodadas.length + 1;


  containerEsconderCarta.style.display =
    numRodadaAtual >= 2
      ? 'inline-block'
      : 'none';

});


// ============================================================
// MINHAS CARTAS
// ============================================================

socket.on('minhasCartas', (data) => {

  const container =
    document.getElementById(
      'minhas-cartas'
    );


  container.innerHTML = '';


  const quantidadeAtual =
    data.cartas.length;


  // Alerta quando sobra somente uma carta.
  if (
    quantidadeAtual === 1 &&
    ultimaQuantidadeCartas > 1
  ) {

    mostrarUltimaCarta(
      meuApelido
    );

    falarTexto(
      'Última carta!'
    );

  }


  ultimaQuantidadeCartas =
    quantidadeAtual;


  data.cartas.forEach(
    (c, idx) => {

      const cardEl =
        document.createElement('div');


      if (data.noEscuro) {

        cardEl.className =
          'carta escuro';

        cardEl.innerText =
          '🂠';

      } else {

        cardEl.className =
          'carta' +
          (
            c.naipe === '♦' ||
            c.naipe === '♥'
              ? ' vermelho'
              : ''
          );

        cardEl.innerText =
          `${c.valor}${c.naipe}`;

      }


      cardEl.onclick = () => {

        if (
          !eMinhaVez ||
          bloqueioJogada ||
          aguardandoDecisaoMao11
        ) {
          return;
        }


        bloqueioJogada = true;


        playSoundPlayCard();


        const esconder =
          chkEsconderCarta.checked &&
          numRodadaAtual >= 2;


        socket.emit(
          'jogarCarta',
          {
            indiceCarta: idx,
            esconder
          }
        );


        chkEsconderCarta.checked =
          false;

      };


      container.appendChild(
        cardEl
      );

    }
  );

});


// ============================================================
// CARTAS DA MESA
// ============================================================

socket.on('atualizarMesa', (cartasMesa) => {

  const container =
    document.getElementById(
      'cartas-mesa'
    );


  // Limpa completamente antes de redesenhar.
  container.innerHTML = '';


  if (!Array.isArray(cartasMesa)) {
    return;
  }


  cartasMesa.forEach(
    (item) => {

      const cardEl =
        document.createElement('div');


      if (item.escondida) {

        cardEl.className =
          'carta escuro';

        cardEl.innerText =
          '🂠';

      } else {

        cardEl.className =
          'carta' +
          (
            item.carta.naipe === '♦' ||
            item.carta.naipe === '♥'
              ? ' vermelho'
              : ''
          );

        cardEl.innerText =
          `${item.carta.valor}${item.carta.naipe}`;

      }


      container.appendChild(
        cardEl
      );

    }
  );

});


// ============================================================
// EFEITO DO ZAP / MANILHA
// ============================================================

socket.on('efeitoManilhaZap', (data) => {

  if (!data || !data.carta) {
    return;
  }


  textoEfeitoZap.innerText =
    data.isZap
      ? '💥 ZAP! 💥'
      : 'MANILHA!';


  cartaZapGrande.innerText =
    `${data.carta.valor}${data.carta.naipe}`;


  if (
    data.carta.naipe === '♦' ||
    data.carta.naipe === '♥'
  ) {

    cartaZapGrande.classList.add(
      'vermelho'
    );

  } else {

    cartaZapGrande.classList.remove(
      'vermelho'
    );

  }


  overlayZap.style.display =
    'flex';


  falarTexto(
    data.isZap
      ? 'Zap!'
      : 'Manilha!'
  );


  setTimeout(() => {

    overlayZap.style.display =
      'none';

  }, 1400);

});


// ============================================================
// CORREU
// ============================================================

// O servidor envia este evento quando alguém corre.
socket.on('jogadorCorreu', (data) => {

  const apelido =
    data && data.apelido
      ? data.apelido
      : 'O jogador';


  mostrarAnimacaoCorreu(
    apelido
  );


  falarTexto(
    `${apelido} correu!`
  );

});


// ============================================================
// DESCONECTADO TEMPORARIAMENTE
// ============================================================

socket.on('jogadorDesconectadoTemp', (data) => {

  textoModalDesconexao.innerText =
    `${data.apelido} desconectou-se. Aguardando reconexão (30s)...`;


  modalDesconexao.style.display =
    'flex';

});


socket.on('jogadorReconectou', () => {

  modalDesconexao.style.display =
    'none';

});


socket.on('jogadorDesconectado', (data) => {

  if (intervalTimer) {
    clearInterval(intervalTimer);
  }

  timerContainer.style.display =
    'none';


  textoModalDesconexao.innerText =
    `O jogador (${data.apelido}) desconectou-se.`;


  modalDesconexao.style.display =
    'flex';

});


btnConfirmarDesconexao.onclick = () => {

  location.reload();

};


// ============================================================
// TIMER DE 20 SEGUNDOS
// ============================================================

function iniciarTimerTurno(segundos = 20) {

  if (intervalTimer) {
    clearInterval(intervalTimer);
  }


  let restante =
    segundos;


  timerSpan.innerText =
    restante;


  timerContainer.style.display =
    'block';


  intervalTimer =
    setInterval(() => {

      restante--;

      timerSpan.innerText =
        restante;


      // Alerta visual nos últimos 5 segundos.
      if (restante <= 5 && restante > 0) {

        timerContainer.classList.add(
          'urgente'
        );


        if (restante === 5) {
          tocarSom(700, 0.08, 'square');
        }

      }


      if (restante <= 0) {

        clearInterval(
          intervalTimer
        );

        timerContainer.classList.remove(
          'urgente'
        );

      }

    }, 1000);

}


// ============================================================
// VEZ DO JOGADOR
// ============================================================

socket.on('atualizarVez', (apelido) => {

  bloqueioJogada = false;


  const statusEl =
    document.getElementById(
      'status-vez'
    );


  if (
    apelido.includes('Aguardando')
  ) {

    statusEl.innerText =
      apelido;

    eMinhaVez =
      false;

    timerContainer.style.display =
      'none';


    if (intervalTimer) {
      clearInterval(intervalTimer);
    }


    timerContainer.classList.remove(
      'urgente'
    );


  } else {

    statusEl.innerText =
      `Vez de: ${apelido}`;


    eMinhaVez =
      (
        apelido === meuApelido
      );


    if (eMinhaVez) {

      iniciarTimerTurno(20);

    } else {

      timerContainer.style.display =
        'none';


      if (intervalTimer) {
        clearInterval(intervalTimer);
      }


      timerContainer.classList.remove(
        'urgente'
      );

    }

  }

});


// ============================================================
// REAÇÕES RÁPIDAS
// ============================================================

document
  .querySelectorAll('.btn-emoji')
  .forEach(btn => {

    btn.onclick = () => {

      initAudio();

      socket.emit(
        'enviarReacao',
        btn.getAttribute(
          'data-emoji'
        )
      );

    };

  });


socket.on('receberReacao', (data) => {

  const container =
    document.getElementById(
      'container-reacoes-mesa'
    );


  const el =
    document.createElement('div');


  el.className =
    'emoji-flutuante';


  el.innerText =
    data.emoji;


  el.style.left =
    `${Math.random() * 70 + 15}%`;


  el.style.top =
    '50%';


  container.appendChild(
    el
  );


  setTimeout(
    () => el.remove(),
    2000
  );

});


// ============================================================
// PERSONALIDADE / REAÇÕES EXTRAS
// ============================================================

// Quando o próprio jogador faz uma jogada,
// mantém o jogo silencioso para não ficar irritante.
// As reações importantes ficam por conta dos eventos
// de Truco, aceitação, corrida e Zap acima.


// ============================================================
// FIM DE PARTIDA
// ============================================================

socket.on('fimDePartida', (data) => {

  if (intervalTimer) {
    clearInterval(intervalTimer);
  }


  timerContainer.style.display =
    'none';


  timerContainer.classList.remove(
    'urgente'
  );


  eMinhaVez = false;
  bloqueioJogada = true;

  aguardandoDecisaoMao11 = false;

  modalTruco.style.display =
    'none';

  modalMao11.style.display =
    'none';


  btnPedirTruco.style.display =
    'none';

  btnCorrerRodada.style.display =
    'none';


  // Limpa as cartas da mesa.
  const mesa =
    document.getElementById(
      'cartas-mesa'
    );

  if (mesa) {
    mesa.innerHTML = '';
  }


  // Limpa as cartas do jogador.
  const minhasCartas =
    document.getElementById(
      'minhas-cartas'
    );

  if (minhasCartas) {
    minhasCartas.innerHTML = '';
  }


  ultimaQuantidadeCartas =
    0;


  // Reset visual do placar.
  if (data.pontosA !== undefined) {

    document.getElementById(
      'pontos-a'
    ).innerText =
      data.pontosA;

  } else {

    document.getElementById(
      'pontos-a'
    ).innerText =
      '0';

  }


  if (data.pontosB !== undefined) {

    document.getElementById(
      'pontos-b'
    ).innerText =
      data.pontosB;

  } else {

    document.getElementById(
      'pontos-b'
    ).innerText =
      '0';

  }


  atualizarBolinhas([]);


  // Mostra a tela de vitória, se disponível.
  if (overlayVitoria) {

    const vencedor =
      data.vencedor !== undefined
        ? data.vencedor
        : '?';


    if (textoVitoria) {

      textoVitoria.innerText =
        `Time ${vencedor} venceu a partida!`;

    }


    if (detalhesVitoria) {

      detalhesVitoria.innerText =
        '🏆 Nova partida disponível!';

    }


    overlayVitoria.style.display =
      'flex';

  } else {

    alert(
      `🏆 Fim de partida! Vencedor: Time ${data.vencedor}`
    );

  }

});


// ============================================================
// FECHAR TELA DE VITÓRIA
// ============================================================

if (btnFecharVitoria) {

  btnFecharVitoria.onclick = () => {

    overlayVitoria.style.display =
      'none';

  };

}


// ============================================================
// FECHAR MODAIS CLICANDO FORA
// ============================================================

window.addEventListener('click', (event) => {

  if (
    event.target === modalRegras
  ) {

    modalRegras.style.display =
      'none';

  }


  if (
    event.target === modalQRCode
  ) {

    modalQRCode.style.display =
      'none';

  }

});


// ============================================================
// TECLAS DE ATALHO
// ============================================================

document.addEventListener('keydown', (event) => {

  // ESC fecha alguns modais.
  if (event.key === 'Escape') {

    if (modalRegras) {
      modalRegras.style.display =
        'none';
    }

    if (modalQRCode) {
      modalQRCode.style.display =
        'none';
    }

    if (
      !aguardandoDecisaoMao11 &&
      modalTruco
    ) {
      modalTruco.style.display =
        'none';
    }

  }

});


// ============================================================
// SEGURANÇA CONTRA BOTÃO TRAVADO
// ============================================================

setInterval(() => {

  if (
    !eMinhaVez &&
    timerContainer.style.display !== 'none'
  ) {

    timerContainer.style.display =
      'none';

  }

}, 1000);
