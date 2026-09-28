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
  osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

// Elementos DOM
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

const containerEsconderCarta = document.getElementById('container-esconder-carta');
const chkEsconderCarta = document.getElementById('chk-esconder-carta');

const overlayZap = document.getElementById('overlay-zap');
const textoEfeitoZap = document.getElementById('texto-efeito-zap');
const cartaZapGrande = document.getElementById('carta-zap-grande');
const overlayEmbaralhar = document.getElementById('overlay-embaralhar');
const overlayContagem = document.getElementById('overlay-contagem');
const numeroContagem = document.getElementById('numero-contagem');

const modalDesconexao = document.getElementById('modal-desconexao');
const textoModalDesconexao = document.getElementById('texto-modal-desconexao');
const btnConfirmarDesconexao = document.getElementById('btn-confirmar-desconexao');

const timerContainer = document.getElementById('timer-turn');
const timerSpan = document.getElementById('tempo-restante');

// Chat DOM
const btnToggleChat = document.getElementById('btn-toggle-chat');
const boxChatSlide = document.getElementById('box-chat-slide');
const btnFecharChat = document.getElementById('btn-fechar-chat');
const btnEnviarChat = document.getElementById('btn-enviar-chat');
const inputMsgChat = document.getElementById('input-msg-chat');
const mensagensChat = document.getElementById('mensagens-chat');
const badgeChatUnread = document.getElementById('badge-chat-unread');

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

// Gestão de Chat Retrátil
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
  if (texto) {
    socket.emit('enviarChat', texto);
    inputMsgChat.value = '';
  }
};

socket.on('receberChat', (data) => {
  const p = document.createElement('p');
  p.innerHTML = `<strong style="color:var(--gold-primary);">${data.apelido}:</strong> ${data.texto}`;
  mensagensChat.appendChild(p);
  mensagensChat.scrollTop = mensagensChat.scrollHeight;

  if (!chatAberto) {
    badgeChatUnread.style.display = 'flex';
  }
});

// Troca de Tema
selectTemaMesa.onchange = (e) => {
  document.body.className = e.target.value;
};

btnAbrirRegras.onclick = () => modalRegras.style.display = 'flex';
btnFecharRegras.onclick = () => modalRegras.style.display = 'none';

btnAbrirQRCode.onclick = () => {
  const link = `${window.location.origin}/?sala=${encodeURIComponent(nomeSalaAtual)}`;
  inputLinkConvite.value = link;
  document.getElementById('qrcode-container').innerHTML = '';
  new QRCode(
    document.getElementById('qrcode-container'),
    {
      text: link,
      width: 128,
      height: 128
    }
  );
  modalQRCode.style.display = 'flex';
};

btnFecharQRCode.onclick = () => modalQRCode.style.display = 'none';

btnCopiarLink.onclick = () => {
  navigator.clipboard.writeText(inputLinkConvite.value);
  alert('Link copiado!');
};

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
    document.getElementById('input-apelido').value.trim();

  const nomeSala =
    document.getElementById('input-sala').value.trim();

  const avatar =
    document.getElementById('select-avatar-login').value;

  if (!apelido || !nomeSala) {
    return alert('Preencha apelido e sala!');
  }

  meuAvatar = avatar;

  socket.emit(
    'entrarSala',
    {
      apelido,
      avatar,
      nomeSala
    }
  );
};

btnConfirmarCriar.onclick = () => {
  initAudio();

  const apelido =
    document.getElementById('input-criar-apelido').value.trim();

  const nomeSala =
    document.getElementById('input-criar-sala').value.trim();

  const avatar =
    document.getElementById('select-avatar-criar').value;

  const maxJogadores =
    document.getElementById('select-max-jogadores').value;

  if (!apelido || !nomeSala) {
    return alert('Preencha apelido e nome da sala!');
  }

  meuAvatar = avatar;

  socket.emit(
    'criarSala',
    {
      apelido,
      avatar,
      nomeSala,
      maxJogadores
    }
  );
};

socket.on('erroEntrada', (msg) => alert(msg));

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
    btnAbrirQRCode.style.display = 'inline-block';
  } else {
    btnAbrirQRCode.style.display = 'none';
  }

  document.getElementById('label-nome-sala').innerText =
    data.nomeSala;

  document.getElementById('meu-info').innerText =
    `${meuAvatar} ${meuApelido} (Time ${meuTime})`;
});

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

  document.getElementById('nome-time-a').innerText =
    timeA || 'Aguardando...';

  document.getElementById('nome-time-b').innerText =
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
      btnAdicionarBot.style.display = 'none';
      btnIniciarPartida.style.display = 'none';
    }
  } else {
    btnAdicionarBot.style.display = 'none';
    btnIniciarPartida.style.display = 'none';
  }
});

btnAdicionarBot.onclick = () =>
  socket.emit('adicionarBot');

btnIniciarPartida.onclick = () =>
  socket.emit('solicitarInicioPartida');

socket.on('iniciarContagemRegressiva', () => {
  overlayContagem.style.display = 'flex';

  let c = 5;

  numeroContagem.innerText = c;

  let t = setInterval(() => {
    c--;

    if (c > 0) {
      numeroContagem.innerText = c;
    } else {
      clearInterval(t);
      overlayContagem.style.display = 'none';
    }
  }, 1000);
});

socket.on('atualizarTrofeus', (data) => {
  document.getElementById('trofeus-a').innerText =
    `🏆 ${data.a}`;

  document.getElementById('trofeus-b').innerText =
    `🏆 ${data.b}`;
});

let trucoEmAndamento = false;

btnPedirTruco.onclick = () => {
  if (
    trucoEmAndamento ||
    btnPedirTruco.disabled
  ) {
    return;
  }

  trucoEmAndamento = true;

  btnPedirTruco.disabled = true;
  btnPedirTruco.style.display = 'none';

  socket.emit('pedirTruco');
};

btnCorrerRodada.onclick = () => {
  if (
    confirm(
      'Deseja realmente correr desta mão?'
    )
  ) {
    socket.emit('correrVoluntario');
  }
};

socket.on('solicitacaoTruco', (data) => {

  let textoVoz = 'pediu truco!';

  if (data.valorProposto === 6) {
    textoVoz = 'pediu seis!';
  } else if (data.valorProposto === 9) {
    textoVoz = 'pediu nove!';
  } else if (data.valorProposto === 12) {
    textoVoz = 'pediu doze!';
  }

  // VOZ DO PEDIDO
  falarTexto(
    `${data.pediuApelido} ${textoVoz}`
  );

  // Existe uma proposta ativa.
  trucoEmAndamento = true;

  btnPedirTruco.disabled = true;
  btnPedirTruco.style.display = 'none';

  // O ADVERSÁRIO RECEBE O MODAL
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

      btnAumentarTruco.style.display =
        'none';

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

    // Libera os botões para esta proposta.
    btnAceitarTruco.disabled = false;
    btnCorrerTruco.disabled = false;
    btnAumentarTruco.disabled = false;

  } else {

    modalTruco.style.display = 'none';

    document.getElementById('status-vez').innerText =
      'Aguardando resposta do adversário...';
  }
});

function responderTrucoUmaVez(acao) {

  if (!trucoEmAndamento) {
    return;
  }

  btnAceitarTruco.disabled = true;
  btnCorrerTruco.disabled = true;
  btnAumentarTruco.disabled = true;

  modalTruco.style.display = 'none';

  socket.emit(
    'respostaTruco',
    acao
  );
}

btnAceitarTruco.onclick = () => {
  responderTrucoUmaVez({
    aceitou: true,
    aumentar: false
  });
};

btnCorrerTruco.onclick = () => {
  responderTrucoUmaVez({
    aceitou: false,
    aumentar: false
  });
};

btnAumentarTruco.onclick = () => {
  responderTrucoUmaVez({
    aceitou: true,
    aumentar: true
  });
};

socket.on('atualizarEstadoTruco', (data) => {

  valorMaoAtual =
    data.valorMao;

  document.getElementById(
    'label-valor-mao'
  ).innerText =
    valorMaoAtual;

  const bloqueado =
    data.bloqueado === true ||
    data.bloqueio === true;

  const podeAumentar =
    data.ultimoPediuTime !== meuTime &&
    !bloqueado &&
    valorMaoAtual < 12;

  if (
    podeAumentar &&
    !data.isMaoDe11 &&
    !data.maoDeFerro
  ) {

    trucoEmAndamento = false;

    btnPedirTruco.disabled = false;

    btnPedirTruco.style.display =
      'inline-block';

    if (valorMaoAtual === 1) {
      btnPedirTruco.innerText = 'TRUCO!';
    } else if (valorMaoAtual === 3) {
      btnPedirTruco.innerText = 'SEIS!';
    } else if (valorMaoAtual === 6) {
      btnPedirTruco.innerText = 'NOVE!';
    } else if (valorMaoAtual === 9) {
      btnPedirTruco.innerText = '12!';
    }

  } else {

    btnPedirTruco.style.display =
      'none';
  }

  if (!bloqueado) {

    btnAceitarTruco.disabled = false;
    btnCorrerTruco.disabled = false;
    btnAumentarTruco.disabled = false;
  }
});

btnAceitarMao11.onclick = () => {
  modalMao11.style.display = 'none';
  socket.emit(
    'respostaMao11',
    true
  );
};

btnCorrerMao11.onclick = () => {
  modalMao11.style.display = 'none';
  socket.emit(
    'respostaMao11',
    false
  );
};

socket.on('decisaoMao11Pendente', (data) => {

  if (data.timeNaMao11 === meuTime) {

    modalMao11.style.display =
      'block';

  } else {

    document.getElementById(
      'status-vez'
    ).innerText =
      `Time ${data.timeNaMao11} decidindo Mão de 11...`;
  }
});

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

      if (idx >= 3) {
        return;
      }

      if (res === 'A') {

        bolinhasA[idx]
          .classList
          .add('vitoria');

        bolinhasB[idx]
          .classList
          .add('derrota');

      } else if (res === 'B') {

        bolinhasB[idx]
          .classList
          .add('vitoria');

        bolinhasA[idx]
          .classList
          .add('derrota');

      } else if (res === 'Empate') {

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

socket.on('novaMao', (data) => {

  trucoEmAndamento = false;

  btnPedirTruco.disabled = false;

  btnAceitarTruco.disabled = false;
  btnCorrerTruco.disabled = false;
  btnAumentarTruco.disabled = false;

  overlayEmbaralhar.style.display =
    'flex';

  setTimeout(() => {

    overlayEmbaralhar.style.display =
      'none';

    valorMaoAtual =
      data.valorMao;

    numRodadaAtual = 1;

    chkEsconderCarta.checked = false;

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

    modalTruco.style.display =
      'none';

    modalMao11.style.display =
      'none';

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

  }, 1200);
});

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

socket.on('minhasCartas', (data) => {

  const container =
    document.getElementById(
      'minhas-cartas'
    );

  container.innerHTML = '';

  data.cartas.forEach(
    (c, idx) => {

      const cardEl =
        document.createElement(
          'div'
        );

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
          bloqueioJogada
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

socket.on('atualizarMesa', (cartasMesa) => {

  const container =
    document.getElementById(
      'cartas-mesa'
    );

  container.innerHTML = '';

  cartasMesa.forEach(
    (item) => {

      const cardEl =
        document.createElement(
          'div'
        );

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

socket.on('efeitoManilhaZap', (data) => {

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

  setTimeout(
    () =>
      overlayZap.style.display =
        'none',
    1400
  );
});

// Reconexão e Notificação
socket.on('jogadorDesconectadoTemp', (data) => {

  textoModalDesconexao.innerText =
    `${data.apelido} desconectou-se. Aguardando reconexão (30s)...`;

  modalDesconexao.style.display =
    'flex';
});

socket.on(
  'jogadorReconectou',
  () =>
    modalDesconexao.style.display =
      'none'
);

socket.on('jogadorDesconectado', (data) => {

  if (intervalTimer) {
    clearInterval(
      intervalTimer
    );
  }

  timerContainer.style.display =
    'none';

  textoModalDesconexao.innerText =
    `O jogador (${data.apelido}) desconectou-se.`;

  modalDesconexao.style.display =
    'flex';
});

btnConfirmarDesconexao.onclick =
  () => location.reload();

function iniciarTimerTurno(segundos = 20) {

  if (intervalTimer) {
    clearInterval(
      intervalTimer
    );
  }

  let restante = segundos;

  timerSpan.innerText =
    restante;

  timerContainer.style.display =
    'block';

  intervalTimer =
    setInterval(() => {

      restante--;

      timerSpan.innerText =
        restante;

      if (restante <= 0) {
        clearInterval(
          intervalTimer
        );
      }

    }, 1000);
}

socket.on('atualizarVez', (apelido) => {

  bloqueioJogada = false;

  const statusEl =
    document.getElementById(
      'status-vez'
    );

  if (apelido.includes('Aguardando')) {

    statusEl.innerText =
      apelido;

    eMinhaVez = false;

    timerContainer.style.display =
      'none';

    if (intervalTimer) {
      clearInterval(
        intervalTimer
      );
    }

  } else {

    statusEl.innerText =
      `Vez de: ${apelido}`;

    eMinhaVez =
      apelido === meuApelido;

    if (eMinhaVez) {

      iniciarTimerTurno(
        20
      );

    } else {

      timerContainer.style.display =
        'none';

      if (intervalTimer) {
        clearInterval(
          intervalTimer
        );
      }
    }
  }
});

// Reações
document
  .querySelectorAll('.btn-emoji')
  .forEach(btn => {

    btn.onclick = () =>
      socket.emit(
        'enviarReacao',
        btn.getAttribute(
          'data-emoji'
        )
      );
  });

socket.on('receberReacao', (data) => {

  const container =
    document.getElementById(
      'container-reacoes-mesa'
    );

  const el =
    document.createElement(
      'div'
    );

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

socket.on('fimDePartida', (data) =>
  alert(
    `🏆 Fim de partida! Vencedor: Time ${data.vencedor}`
  )
);
