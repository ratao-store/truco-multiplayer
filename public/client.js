const socket = io();

// Áudio e Síntese de Voz Nativa
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function falarTexto(texto) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.pitch = 1.1;
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }
}

function playSoundPlayCard() {
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    120,
    audioCtx.currentTime + 0.1
  );

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(
    0.01,
    audioCtx.currentTime + 0.1
  );

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playSoundZap() {
  initAudio();
  if (!audioCtx) return;

  const agora = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sawtooth';

  osc.frequency.setValueAtTime(180, agora);
  osc.frequency.exponentialRampToValueAtTime(
    900,
    agora + 0.08
  );
  osc.frequency.exponentialRampToValueAtTime(
    240,
    agora + 0.25
  );

  gain.gain.setValueAtTime(0.001, agora);
  gain.gain.exponentialRampToValueAtTime(
    0.35,
    agora + 0.03
  );
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    agora + 0.28
  );

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(agora);
  osc.stop(agora + 0.3);
}

function playSoundVictory() {
  initAudio();
  if (!audioCtx) return;

  const notas = [523.25, 659.25, 783.99];

  notas.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const inicio = audioCtx.currentTime + i * 0.13;

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.001, inicio);
    gain.gain.exponentialRampToValueAtTime(
      0.25,
      inicio + 0.03
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      inicio + 0.3
    );

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(inicio);
    osc.stop(inicio + 0.32);
  });
}

// Elementos DOM
const cardEntrar = document.getElementById('card-entrar');
const cardCriar = document.getElementById('card-criar');

const btnAbrirCriar = document.getElementById('btn-abrir-criar');
const btnVoltarEntrar = document.getElementById('btn-voltar-entrar');

const formEntrar = document.getElementById('form-entrar');
const formCriar = document.getElementById('form-criar');

const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');

const apelidoInput = document.getElementById('apelido');
const avatarInput = document.getElementById('avatar');
const nomeSalaInput = document.getElementById('nome-sala');
const maxJogadoresInput = document.getElementById('max-jogadores');

const btnAdicionarBot = document.getElementById('btn-adicionar-bot');
const btnIniciarPartida = document.getElementById('btn-iniciar-partida');

const btnPedirTruco = document.getElementById('btn-pedir-truco');
const btnCorrerRodada = document.getElementById('btn-correr-rodada');

const modalTruco = document.getElementById('modal-truco');
const modalMao11 = document.getElementById('modal-mao-11');

const btnAceitarTruco = document.getElementById('btn-aceitar-truco');
const btnCorrerTruco = document.getElementById('btn-correr-truco');
const btnAumentarTruco = document.getElementById('btn-aumentar-truco');

const btnAceitarMao11 = document.getElementById('btn-aceitar-mao11');
const btnCorrerMao11 = document.getElementById('btn-correr-mao11');

const textoTrucoPedido = document.getElementById('texto-truco-pedido');

const overlayContagem = document.getElementById('overlay-contagem');
const numeroContagem = document.getElementById('numero-contagem');

const overlayEmbaralhar = document.getElementById('overlay-embaralhar');

const containerCartas = document.getElementById('minhas-cartas');
const containerMesa = document.getElementById('cartas-mesa');

const containerEsconderCarta =
  document.getElementById('container-esconder-carta');

const chkEsconderCarta =
  document.getElementById('chk-esconder-carta');

const statusVez = document.getElementById('status-vez');

let meuApelido = '';
let meuAvatar = '';
let meuTime = '';

let nomeSalaAtual = '';
let souDonoSala = false;

let jogadores = [];
let jogoIniciado = false;

let minhasCartas = [];
let cartaSelecionada = null;

let valorMaoAtual = 1;
let numRodadaAtual = 1;

let aguardandoDecisaoMao11 = false;

let intervaloTimerTurno = null;
let segundosTimerTurno = 0;

// ================================
// NAVEGAÇÃO LOGIN
// ================================

if (btnAbrirCriar) {
  btnAbrirCriar.onclick = () => {
    cardEntrar.style.display = 'none';
    cardCriar.style.display = 'block';
  };
}

if (btnVoltarEntrar) {
  btnVoltarEntrar.onclick = () => {
    cardCriar.style.display = 'none';
    cardEntrar.style.display = 'block';
  };
}

// ================================
// CRIAR SALA
// ================================

if (formCriar) {
  formCriar.onsubmit = (e) => {
    e.preventDefault();

    initAudio();

    const apelido = apelidoInput.value.trim();
    const avatar = avatarInput.value || '😀';
    const nomeSala = nomeSalaInput.value.trim();
    const maxJogadores =
      parseInt(maxJogadoresInput.value, 10) || 4;

    if (!apelido || !nomeSala) {
      alert('Preencha seu apelido e o nome da sala.');
      return;
    }

    meuAvatar = avatar;

    socket.emit('criarSala', {
      apelido,
      avatar,
      nomeSala,
      maxJogadores
    });
  };
}

// ================================
// ENTRAR EM SALA
// ================================

if (formEntrar) {
  formEntrar.onsubmit = (e) => {
    e.preventDefault();

    initAudio();

    const apelido = document
      .getElementById('apelido-entrar')
      ?.value
      .trim();

    const avatar =
      document.getElementById('avatar-entrar')?.value ||
      '😀';

    const nomeSala =
      document.getElementById('nome-sala-entrar')
        ?.value
        .trim();

    if (!apelido || !nomeSala) {
      alert('Preencha seu apelido e o nome da sala.');
      return;
    }

    meuAvatar = avatar;

    socket.emit('entrarSala', {
      apelido,
      avatar,
      nomeSala
    });
  };
}

// ================================
// ERROS / SUCESSO
// ================================

socket.on('erroEntrada', (msg) => {
  alert(msg);
});

socket.on('sucessoEntrada', (data) => {
  meuApelido = data.apelido;
  meuTime = data.time;
  nomeSalaAtual = data.nomeSala;
  souDonoSala = data.isDono;

  modalTruco.style.display = 'none';
  modalMao11.style.display = 'none';

  loginContainer.style.display = 'none';
  appContainer.style.display = 'flex';

  const btnToggleChat =
    document.getElementById('btn-toggle-chat');

  if (btnToggleChat) {
    btnToggleChat.style.display = 'flex';
  }

  const btnAbrirQRCode =
    document.getElementById('btn-abrir-qrcode');

  if (btnAbrirQRCode) {
    btnAbrirQRCode.style.display =
      souDonoSala ? 'inline-block' : 'none';
  }

  const labelNomeSala =
    document.getElementById('label-nome-sala');

  if (labelNomeSala) {
    labelNomeSala.innerText = data.nomeSala;
  }

  const meuInfo =
    document.getElementById('meu-info');

  if (meuInfo) {
    meuInfo.innerText =
      `${meuAvatar} ${meuApelido} (Time ${meuTime})`;
  }
});

// ================================
// JOGADORES
// ================================

socket.on('atualizarJogadores', (data) => {
  jogadores = data.jogadores || [];
  jogoIniciado = data.jogoIniciado;

  const timeA = jogadores
    .filter(j => j.time === 'A')
    .map(j => `${j.avatar || ''} ${j.apelido}`)
    .join(' & ');

  const timeB = jogadores
    .filter(j => j.time === 'B')
    .map(j => `${j.avatar || ''} ${j.apelido}`)
    .join(' & ');

  const nomeTimeA =
    document.getElementById('nome-time-a');

  const nomeTimeB =
    document.getElementById('nome-time-b');

  if (nomeTimeA) {
    nomeTimeA.innerText = timeA || 'Aguardando...';
  }

  if (nomeTimeB) {
    nomeTimeB.innerText = timeB || 'Aguardando...';
  }

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
      btnAdicionarBot.style.display = 'none';
      btnIniciarPartida.style.display = 'none';
    }
  } else {
    btnAdicionarBot.style.display = 'none';
    btnIniciarPartida.style.display = 'none';
  }
});

btnAdicionarBot.onclick = () => {
  socket.emit('adicionarBot');
};

btnIniciarPartida.onclick = () => {
  initAudio();
  socket.emit('solicitarInicioPartida');
};

// ================================
// CONTAGEM INICIAL
// ================================

socket.on('iniciarContagemRegressiva', () => {
  overlayContagem.style.display = 'flex';

  let c = 5;

  numeroContagem.innerText = c;

  const t = setInterval(() => {
    c--;

    if (c > 0) {
      numeroContagem.innerText = c;
    } else {
      clearInterval(t);
      overlayContagem.style.display = 'none';
    }
  }, 1000);
});

// ================================
// TROFÉUS
// ================================

socket.on('atualizarTrofeus', (data) => {
  const trofeusA =
    document.getElementById('trofeus-a');

  const trofeusB =
    document.getElementById('trofeus-b');

  if (trofeusA) {
    trofeusA.innerText = `🏆 ${data.a}`;
  }

  if (trofeusB) {
    trofeusB.innerText = `🏆 ${data.b}`;
  }
});

// ================================
// BOTÕES DE JOGO
// ================================

btnPedirTruco.onclick = () => {
  initAudio();
  socket.emit('pedirTruco');
};

btnCorrerRodada.onclick = () => {
  if (
    aguardandoDecisaoMao11
  ) {
    return;
  }

  if (
    confirm(
      'Deseja realmente correr desta mão?'
    )
  ) {
    socket.emit('correrVoluntario');
  }
};

// ================================
// PEDIDO DE TRUCO
// ================================

socket.on('solicitacaoTruco', (data) => {
  let textoVoz = 'pediu truco!';

  if (data.valorProposto === 6) {
    textoVoz = 'pediu seis!';
  } else if (data.valorProposto === 9) {
    textoVoz = 'pediu nove!';
  } else if (data.valorProposto === 12) {
    textoVoz = 'pediu doze!';
  }

  falarTexto(
    `${data.pediuApelido} ${textoVoz}`
  );

  if (data.pediuTime !== meuTime) {
    modalTruco.style.display = 'block';

    let rotulo = 'TRUCO!';

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
      btnAumentarTruco.style.display = 'none';
    } else {
      btnAumentarTruco.style.display =
        'inline-block';

      let prox = 'Pedir 6';

      if (data.valorProposto === 6) {
        prox = 'Pedir 9';
      }

      if (data.valorProposto === 9) {
        prox = 'Pedir 12';
      }

      btnAumentarTruco.innerText = prox;
    }
  }
});

btnAceitarTruco.onclick = () => {
  modalTruco.style.display = 'none';

  initAudio();

  socket.emit('respostaTruco', {
    aceitou: true,
    aumentar: false
  });
};

btnCorrerTruco.onclick = () => {
  modalTruco.style.display = 'none';

  socket.emit('respostaTruco', {
    aceitou: false,
    aumentar: false
  });
};

btnAumentarTruco.onclick = () => {
  modalTruco.style.display = 'none';

  socket.emit('respostaTruco', {
    aceitou: true,
    aumentar: true
  });
};

// ================================
// VOZ - ACEITOU TRUCO
// ================================

socket.on('jogadorAceitouTruco', (data) => {
  falarTexto(
    `${data.apelido} aceitou ${data.valor}!`
  );
});

// ================================
// VOZ - CORREU
// ================================

socket.on('jogadorCorreu', (data) => {
  falarTexto(
    `${data.apelido} correu!`
  );

  mostrarAnimacaoCorre(data.apelido);
});

// ================================
// ANIMAÇÃO DE CORREU
// ================================

function mostrarAnimacaoCorre(apelido) {
  let overlay =
    document.getElementById('overlay-correu');

  if (!overlay) {
    overlay = document.createElement('div');

    overlay.id = 'overlay-correu';
    overlay.className = 'overlay-evento';

    overlay.innerHTML = `
      <div class="evento-grande correu-evento">
        <div class="evento-emoji">🏃💨</div>
        <div class="evento-titulo">CORREU!</div>
        <div class="evento-apelido"></div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  const apelidoEl =
    overlay.querySelector('.evento-apelido');

  if (apelidoEl) {
    apelidoEl.innerText = apelido;
  }

  overlay.style.display = 'flex';

  setTimeout(() => {
    overlay.style.display = 'none';
  }, 1800);
}

// ================================
// ZAP
// ================================

socket.on('efeitoZap', (data) => {
  playSoundZap();

  const overlay =
    document.getElementById('overlay-zap') ||
    criarOverlayZap();

  const texto =
    overlay.querySelector('.zap-texto');

  if (texto) {
    texto.innerText =
      `${data.apelido || 'ZAP'}!`;
  }

  overlay.style.display = 'flex';

  document.body.classList.add('efeito-tremor');

  setTimeout(() => {
    document.body.classList.remove(
      'efeito-tremor'
    );
  }, 500);

  setTimeout(() => {
    overlay.style.display = 'none';
  }, 1300);
});

function criarOverlayZap() {
  const overlay = document.createElement('div');

  overlay.id = 'overlay-zap';
  overlay.className = 'overlay-evento';

  overlay.innerHTML = `
    <div class="zap-evento">
      <div class="zap-raio">⚡</div>
      <div class="zap-texto">ZAP!</div>
      <div class="zap-raio">⚡</div>
    </div>
  `;

  document.body.appendChild(overlay);

  return overlay;
}

// ================================
// MÃO DE 11
// ================================

btnAceitarMao11.onclick = () => {
  modalMao11.style.display = 'none';

  aguardandoDecisaoMao11 = false;

  btnCorrerRodada.style.display =
    'inline-block';

  socket.emit('respostaMao11', true);
};

btnCorrerMao11.onclick = () => {
  modalMao11.style.display = 'none';

  aguardandoDecisaoMao11 = false;

  socket.emit('respostaMao11', false);
};

socket.on('decisaoMao11Pendente', (data) => {
  aguardandoDecisaoMao11 = true;

  modalTruco.style.display = 'none';

  if (data.timeNaMao11 === meuTime) {
    modalMao11.style.display = 'block';

    btnCorrerRodada.style.display = 'none';

    if (statusVez) {
      statusVez.innerText =
        '⚠️ SUA VEZ: MÃO DE 11 - ACEITA OU CORRE?';
    }
  } else {
    modalMao11.style.display = 'none';

    btnCorrerRodada.style.display = 'none';

    if (statusVez) {
      statusVez.innerText =
        `Time ${data.timeNaMao11} decidindo Mão de 11...`;
    }
  }
});

// ================================
// NOVA MÃO
// ================================

socket.on('novaMao', (data) => {
  overlayEmbaralhar.style.display = 'flex';

  containerMesa.innerHTML = '';

  const minhaMesa =
    document.getElementById('cartas-mesa');

  if (minhaMesa) {
    minhaMesa.innerHTML = '';
  }

  minhasCartas = [];
  cartaSelecionada = null;

  setTimeout(() => {
    overlayEmbaralhar.style.display = 'none';

    valorMaoAtual = data.valorMao;
    numRodadaAtual = 1;

    chkEsconderCarta.checked = false;

    containerEsconderCarta.style.display =
      'none';

    document.getElementById(
      'label-valor-mao'
    ).innerText = valorMaoAtual;

    document.getElementById(
      'pontos-a'
    ).innerText = data.pontosA;

    document.getElementById(
      'pontos-b'
    ).innerText = data.pontosB;

    statusVez.innerText =
      `Vez de: ${data.vez}`;

    document.getElementById(
      'label-manilha'
    ).innerText =
      `Manilha: ${data.valorManilha || '-'}`;

    modalTruco.style.display = 'none';

    if (!data.isMaoDe11) {
      modalMao11.style.display = 'none';
      aguardandoDecisaoMao11 = false;
    }

    btnCorrerRodada.style.display =
      data.isMaoDe11
        ? 'none'
        : 'inline-block';

    if (
      data.isMaoDe11 ||
      data.maoDeFerro
    ) {
      btnPedirTruco.style.display = 'none';
    } else {
      btnPedirTruco.style.display =
        'inline-block';

      btnPedirTruco.innerText = 'TRUCO!';
    }

    atualizarBolinhas([]);

    const viraEl =
      document.getElementById('carta-vira');

    if (data.maoDeFerro) {
      viraEl.innerText = '🂠';
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

    iniciarTimerTurnoVisual(data.tempoTurno || 20);
  }, 1200);
});

// ================================
// CARTAS DO JOGADOR
// ================================

socket.on('minhasCartas', (cartas) => {
  minhasCartas = cartas || [];

  renderizarMinhasCartas();
});

function renderizarMinhasCartas() {
  containerCartas.innerHTML = '';

  minhasCartas.forEach((carta, indice) => {
    const cartaEl =
      document.createElement('div');

    cartaEl.className =
      'carta-mao';

    cartaEl.dataset.indice = indice;

    const vermelha =
      carta.naipe === '♦' ||
      carta.naipe === '♥';

    cartaEl.innerHTML = `
      <div class="valor-carta ${vermelha ? 'vermelho' : ''}">
        ${carta.valor}
      </div>
      <div class="naipe-carta ${vermelha ? 'vermelho' : ''}">
        ${carta.naipe}
      </div>
    `;

    cartaEl.onclick = () => {
      selecionarCarta(indice);
    };

    cartaEl.onmouseenter = () => {
      cartaEl.classList.add('carta-hover');
    };

    cartaEl.onmouseleave = () => {
      cartaEl.classList.remove('carta-hover');
    };

    containerCartas.appendChild(cartaEl);
  });
}

// ================================
// CARTA SELECIONADA
// ================================

function selecionarCarta(indice) {
  document
    .querySelectorAll('.carta-mao')
    .forEach(el => {
      el.classList.remove(
        'carta-selecionada'
      );
    });

  cartaSelecionada = indice;

  const cartaEl =
    document.querySelector(
      `.carta-mao[data-indice="${indice}"]`
    );

  if (cartaEl) {
    cartaEl.classList.add(
      'carta-selecionada'
    );
  }
}

// ================================
// CLIQUE DUPLO PARA JOGAR
// ================================

containerCartas.addEventListener(
  'dblclick',
  (e) => {
    const cartaEl =
      e.target.closest('.carta-mao');

    if (!cartaEl) return;

    const indice =
      parseInt(
        cartaEl.dataset.indice,
        10
      );

    jogarCarta(indice);
  }
);

function jogarCarta(indice) {
  if (
    indice === null ||
    indice === undefined ||
    !minhasCartas[indice]
  ) {
    return;
  }

  initAudio();

  const esconder =
    chkEsconderCarta &&
    chkEsconderCarta.checked;

  playSoundPlayCard();

  socket.emit('jogarCarta', {
    indiceCarta: indice,
    esconder
  });

  cartaSelecionada = null;
}

// ================================
// MESA
// ================================

socket.on('atualizarMesa', (cartas) => {
  atualizarMesa(cartas || []);
});

function atualizarMesa(cartas) {
  containerMesa.innerHTML = '';

  cartas.forEach(carta => {
    const cartaEl =
      document.createElement('div');

    cartaEl.className = 'carta mesa-carta';

    if (carta.escondida) {
      cartaEl.innerText = '🂠';
      cartaEl.classList.add('escuro');
    } else {
      const vermelha =
        carta.naipe === '♦' ||
        carta.naipe === '♥';

      cartaEl.innerHTML = `
        <div class="valor-carta ${vermelha ? 'vermelho' : ''}">
          ${carta.valor}
        </div>
        <div class="naipe-carta ${vermelha ? 'vermelho' : ''}">
          ${carta.naipe}
        </div>
      `;
    }

    containerMesa.appendChild(cartaEl);
  });
});

// ================================
// RODADAS
// ================================

socket.on('atualizarRodadasMao', (rodadas) => {
  atualizarBolinhas(rodadas || []);
});

function atualizarBolinhas(rodadas) {
  const container =
    document.getElementById('bolinhas-rodadas');

  if (!container) return;

  container.innerHTML = '';

  for (let i = 0; i < 3; i++) {
    const bolinha =
      document.createElement('div');

    bolinha.className =
      'bolinha-rodada';

    if (rodadas[i]) {
      bolinha.classList.add(
        rodadas[i] === meuTime
          ? 'minha-equipe'
          : 'outra-equipe'
      );

      bolinha.innerText =
        rodadas[i] === meuTime
          ? '✓'
          : 'X';
    }

    container.appendChild(bolinha);
  }
});

// ================================
// VEZ DO JOGADOR
// ================================

socket.on('vezDe', (data) => {
  const minhaVez =
    data.jogadorId === socket.id;

  statusVez.innerText =
    minhaVez
      ? '🟢 SUA VEZ!'
      : `Vez de: ${data.apelido}`;

  document.body.classList.toggle(
    'minha-vez',
    minhaVez
  );

  iniciarTimerTurnoVisual(
    data.tempo || 20
  );
});

// ================================
// TIMER VISUAL
// ================================

function iniciarTimerTurnoVisual(segundos) {
  clearInterval(intervaloTimerTurno);

  segundosTimerTurno = segundos;

  atualizarTextoTimer();

  intervaloTimerTurno =
    setInterval(() => {
      segundosTimerTurno--;

      if (segundosTimerTurno <= 0) {
        segundosTimerTurno = 0;
        clearInterval(intervaloTimerTurno);
      }

      atualizarTextoTimer();
    }, 1000);
}

function atualizarTextoTimer() {
  let timer =
    document.getElementById(
      'timer-turno'
    );

  if (!timer) {
    timer = document.createElement('div');

    timer.id = 'timer-turno';
    timer.className = 'timer-turno';

    document.body.appendChild(timer);
  }

  timer.innerText =
    `⏱️ ${segundosTimerTurno}`;

  timer.classList.remove(
    'timer-normal',
    'timer-atencao',
    'timer-perigo'
  );

  if (segundosTimerTurno <= 5) {
    timer.classList.add(
      'timer-perigo'
    );
  } else if (segundosTimerTurno <= 10) {
    timer.classList.add(
      'timer-atencao'
    );
  } else {
    timer.classList.add(
      'timer-normal'
    );
  }
}

// ================================
// ESTADO DO TRUCO
// ================================

socket.on('atualizarEstadoTruco', (data) => {
  valorMaoAtual = data.valorMao;

  const label =
    document.getElementById(
      'label-valor-mao'
    );

  if (label) {
    label.innerText =
      data.valorMao;
  }

  if (
    data.isMaoDe11
  ) {
    modalMao11.style.display = 'none';

    aguardandoDecisaoMao11 = false;

    btnCorrerRodada.style.display =
      'inline-block';

    btnPedirTruco.style.display =
      'none';
  }
});

// ================================
// FIM DA PARTIDA
// ================================

socket.on('fimDePartida', (data) => {
  clearInterval(
    intervaloTimerTurno
  );

  playSoundVictory();

  document.body.classList.add(
    'tela-vitoria'
  );

  const overlay =
    document.getElementById(
      'overlay-vitoria'
    ) || criarOverlayVitoria();

  const titulo =
    overlay.querySelector(
      '.vitoria-titulo'
    );

  const subtitulo =
    overlay.querySelector(
      '.vitoria-subtitulo'
    );

  titulo.innerText =
    `🏆 TIME ${data.vencedor} VENCEU!`;

  subtitulo.innerText =
    'Partida encerrada!';

  overlay.style.display = 'flex';

  document.getElementById(
    'pontos-a'
  ).innerText = 0;

  document.getElementById(
    'pontos-b'
  ).innerText = 0;

  document.getElementById(
    'label-valor-mao'
  ).innerText = 1;

  minhasCartas = [];
  cartaSelecionada = null;

  containerCartas.innerHTML = '';
  containerMesa.innerHTML = '';

  modalTruco.style.display = 'none';
  modalMao11.style.display = 'none';

  btnPedirTruco.style.display = 'none';
  btnCorrerRodada.style.display = 'none';

  aguardandoDecisaoMao11 = false;

  atualizarBolinhas([]);

  setTimeout(() => {
    overlay.style.display = 'none';

    document.body.classList.remove(
      'tela-vitoria'
    );
  }, 5000);
});

function criarOverlayVitoria() {
  const overlay =
    document.createElement('div');

  overlay.id =
    'overlay-vitoria';

  overlay.className =
    'overlay-evento';

  overlay.innerHTML = `
    <div class="vitoria-evento">
      <div class="vitoria-trofeu">🏆</div>
      <div class="vitoria-titulo">
        TIME VENCEU!
      </div>
      <div class="vitoria-subtitulo">
        Partida encerrada!
      </div>
      <div class="vitoria-confetes">
        🎉 🎊 🎉 🎊 🎉
      </div>
    </div>
  `;

  document.body.appendChild(
    overlay
  );

  return overlay;
}

// ================================
// RANKING
// ================================

socket.on('atualizarRanking', (ranking) => {
  const container =
    document.getElementById(
      'ranking-lista'
    );

  if (!container) return;

  container.innerHTML = '';

  if (!ranking || !ranking.length) {
    container.innerHTML =
      '<div class="ranking-vazio">Nenhuma vitória registrada ainda.</div>';

    return;
  }

  ranking.forEach((jogador, indice) => {
    const item =
      document.createElement('div');

    item.className =
      'ranking-item';

    item.innerHTML = `
      <span class="ranking-posicao">
        ${indice + 1}º
      </span>

      <span class="ranking-nome">
        ${jogador.avatar || '😀'}
        ${jogador.apelido}
      </span>

      <span class="ranking-vitorias">
        🏆 ${jogador.vitorias}
      </span>
    `;

    container.appendChild(item);
  });
});

// ================================
// CHAT
// ================================

const btnEnviarChat =
  document.getElementById(
    'btn-enviar-chat'
  );

const inputChat =
  document.getElementById(
    'input-chat'
  );

const chatMensagens =
  document.getElementById(
    'chat-mensagens'
  );

if (btnEnviarChat && inputChat) {
  btnEnviarChat.onclick = () => {
    const mensagem =
      inputChat.value.trim();

    if (!mensagem) return;

    socket.emit('enviarChat', {
      mensagem
    });

    inputChat.value = '';
  };

  inputChat.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') {
        btnEnviarChat.click();
      }
    }
  );
}

socket.on('novaMensagemChat', (data) => {
  if (!chatMensagens) return;

  const mensagem =
    document.createElement('div');

  mensagem.className =
    'mensagem-chat';

  mensagem.innerHTML = `
    <strong>
      ${data.avatar || ''} ${data.apelido}:
    </strong>
    ${data.mensagem}
  `;

  chatMensagens.appendChild(
    mensagem
  );

  chatMensagens.scrollTop =
    chatMensagens.scrollHeight;
});

// ================================
// REAÇÕES
// ================================

document
  .querySelectorAll('.btn-reacao')
  .forEach(btn => {
    btn.onclick = () => {
      socket.emit(
        'reacao',
        btn.dataset.reacao
      );
    };
  });

socket.on('mostrarReacao', (data) => {
  const el =
    document.createElement('div');

  el.className =
    'reacao-flutuante';

  el.innerText =
    `${data.avatar || ''} ${data.reacao}`;

  document.body.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, 1800);
});

// ================================
// FRASES DOS BOTS
// ================================

socket.on('falaBot', (data) => {
  if (!data) return;

  const texto =
    `${data.apelido}: ${data.frase}`;

  falarTexto(texto);

  const el =
    document.createElement('div');

  el.className =
    'fala-bot';

  el.innerHTML = `
    <div class="fala-bot-avatar">
      🤖
    </div>

    <div class="fala-bot-texto">
      <strong>${data.apelido}</strong>
      <br>
      ${data.frase}
    </div>
  `;

  document.body.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, 3500);
});

// ================================
// DESCONEXÃO
// ================================

socket.on('disconnect', () => {
  console.log(
    'Desconectado do servidor.'
  );
});

socket.on('reconectado', (data) => {
  if (!data) return;

  console.log(
    'Reconectado ao servidor.'
  );
});

// ================================
// QR CODE
// ================================

const btnAbrirQRCode =
  document.getElementById(
    'btn-abrir-qrcode'
  );

const modalQRCode =
  document.getElementById(
    'modal-qrcode'
  );

const btnFecharQRCode =
  document.getElementById(
    'btn-fechar-qrcode'
  );

if (btnAbrirQRCode) {
  btnAbrirQRCode.onclick = () => {
    if (modalQRCode) {
      modalQRCode.style.display =
        'block';
    }

    socket.emit(
      'gerarQRCode',
      {
        nomeSala: nomeSalaAtual
      }
    );
  };
}

if (btnFecharQRCode) {
  btnFecharQRCode.onclick = () => {
    modalQRCode.style.display =
      'none';
  };
}

socket.on('mostrarQRCode', (data) => {
  const img =
    document.getElementById(
      'qrcode-img'
    );

  if (img) {
    img.src =
      data.qrCode;
  }
});

// ================================
// TEMA
// ================================

const selectTema =
  document.getElementById(
    'select-tema'
  );

if (selectTema) {
  selectTema.addEventListener(
    'change',
    () => {
      document.body.dataset.tema =
        selectTema.value;

      localStorage.setItem(
        'temaTruco',
        selectTema.value
      );
    }
  );

  const temaSalvo =
    localStorage.getItem(
      'temaTruco'
    );

  if (temaSalvo) {
    selectTema.value =
      temaSalvo;

    document.body.dataset.tema =
      temaSalvo;
  }
}

// ================================
// ESCONDER CARTA
// ================================

if (chkEsconderCarta) {
  chkEsconderCarta.onchange = () => {
    if (
      cartaSelecionada !== null
    ) {
      const cartaEl =
        document.querySelector(
          `.carta-mao[data-indice="${cartaSelecionada}"]`
        );

      if (cartaEl) {
        cartaEl.classList.toggle(
          'carta-marcada-escondida',
          chkEsconderCarta.checked
        );
      }
    }
  };
}

// ================================
// LIMPEZA AO CARREGAR
// ================================

window.addEventListener(
  'load',
  () => {
    document.body.classList.remove(
      'minha-vez'
    );

    if (containerMesa) {
      containerMesa.innerHTML = '';
    }

    if (containerCartas) {
      containerCartas.innerHTML = '';
    }
  }
);
