const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve ficheiros estáticos da raiz e da pasta public
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal flexível para carregar o index.html
app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');

  if (fs.existsSync(rootIndex)) {
    res.sendFile(rootIndex);
  } else if (fs.existsSync(publicIndex)) {
    res.sendFile(publicIndex);
  } else {
    res.status(404).send('Ficheiro index.html não foi encontrado na raiz nem na pasta public.');
  }
});

const NAIPES = ['♦', '♠', '♥', '♣'];
const VALORES_ORDEM = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

let salas = {};

function criarBaralho() {
  let baralho = [];

  for (let valor of VALORES_ORDEM) {
    for (let naipe of NAIPES) {
      baralho.push({ valor, naipe });
    }
  }

  return baralho.sort(() => Math.random() - 0.5);
}

function obterProximaCartaValor(valorVira) {
  let idx = VALORES_ORDEM.indexOf(valorVira);
  return VALORES_ORDEM[(idx + 1) % VALORES_ORDEM.length];
}

function calcularForcaCarta(carta, valorManilha) {
  if (carta.valor === valorManilha) {
    const forcaNaipes = {
      '♦': 101,
      '♠': 102,
      '♥': 103,
      '♣': 104
    };

    return forcaNaipes[carta.naipe];
  }

  return VALORES_ORDEM.indexOf(carta.valor);
}

function iniciarNovaMao(sala) {
  sala.baralho = criarBaralho();
  sala.vira = sala.baralho.pop();
  sala.valorManilha = obterProximaCartaValor(sala.vira.valor);

  sala.valorMao = 1;
  sala.ultimoPediuTime = null;

  // IMPORTANTE:
  // toda nova mão começa sem nenhuma proposta de Truco.
  sala.propostaTruco = null;

  sala.cartasMesa = [];
  sala.historicoRodadas = [];
  sala.processandoTurno = false;

  if (sala.timerTurno) {
    clearTimeout(sala.timerTurno);
    sala.timerTurno = null;
  }

  sala.isMaoDe11 =
    (sala.pontosA === 11 || sala.pontosB === 11) &&
    !(sala.pontosA === 11 && sala.pontosB === 11);

  sala.maoDeFerro =
    (sala.pontosA === 11 && sala.pontosB === 11);

  if (sala.isMaoDe11) {
    sala.valorMao = 3;
    sala.timeNaMao11 = sala.pontosA === 11 ? 'A' : 'B';
    sala.mao11Decidida = false;
  }

  sala.jogadores.forEach(j => {
    j.cartas = [
      sala.baralho.pop(),
      sala.baralho.pop(),
      sala.baralho.pop()
    ];
  });

  sala.indicePe =
    (sala.indicePe + 1) % sala.jogadores.length;

  sala.indiceTurno =
    (sala.indicePe + 1) % sala.jogadores.length;

  io.to(sala.nome).emit('novaMao', {
    vira: sala.vira,
    valorManilha: sala.valorManilha,
    valorMao: sala.valorMao,
    pontosA: sala.pontosA,
    pontosB: sala.pontosB,
    vez: sala.jogadores[sala.indiceTurno].apelido,
    isMaoDe11: sala.isMaoDe11,
    maoDeFerro: sala.maoDeFerro
  });

  sala.jogadores.forEach(j => {
    if (!j.isBot) {
      io.to(j.id).emit('minhasCartas', {
        cartas: j.cartas,
        noEscuro: sala.maoDeFerro
      });
    }
  });

  if (sala.isMaoDe11) {
    io.to(sala.nome).emit('decisaoMao11Pendente', {
      timeNaMao11: sala.timeNaMao11
    });

    let timeMao11Bot = sala.jogadores.find(
      j => j.time === sala.timeNaMao11 && j.isBot
    );

    if (timeMao11Bot) {
      setTimeout(() => {
        if (!salas[sala.nome]) return;

        let aceitar = Math.random() < 0.7;

        processarRespostaMao11(
          sala,
          sala.timeNaMao11,
          aceitar
        );
      }, 1500);
    }
  } else {
    iniciarTimerTurno(sala);
  }
}

function processarRespostaMao11(sala, time, aceitou) {
  if (sala.mao11Decidida) return;

  sala.mao11Decidida = true;

  let timeAdversario =
    time === 'A' ? 'B' : 'A';

  if (!aceitou) {
    sala.valorMao = 1;

    finalizarMao(
      sala,
      timeAdversario
    );
  } else {
    sala.valorMao = 3;

    io.to(sala.nome).emit(
      'atualizarEstadoTruco',
      {
        valorMao: sala.valorMao,
        isMaoDe11: true,
        bloqueio: false,
        bloqueado: false
      }
    );

    iniciarTimerTurno(sala);
  }
}

function verificarAcaoBot(sala) {
  const jogadorAtual =
    sala.jogadores[sala.indiceTurno];

  if (
    !jogadorAtual ||
    !jogadorAtual.isBot ||
    sala.processandoTurno
  ) {
    return;
  }

  // Nunca cria outra proposta se já existe uma pendente.
  if (sala.propostaTruco) return;

  let temManilhaOuCartaBoa =
    jogadorAtual.cartas.some(
      c =>
        c.valor === sala.valorManilha ||
        ['3', '2', 'A'].includes(c.valor)
    );

  let roubarBluff =
    Math.random() < 0.25;

  if (
    (temManilhaOuCartaBoa || roubarBluff) &&
    sala.ultimoPediuTime !== jogadorAtual.time &&
    !sala.isMaoDe11 &&
    !sala.maoDeFerro &&
    sala.valorMao < 12
  ) {
    let proximoValor =
      sala.valorMao === 1
        ? 3
        : sala.valorMao === 3
          ? 6
          : sala.valorMao === 6
            ? 9
            : 12;

    sala.propostaTruco = {
      pediuApelido: jogadorAtual.apelido,
      pediuTime: jogadorAtual.time,
      valorProposto: proximoValor
    };

    if (sala.timerTurno) {
      clearTimeout(sala.timerTurno);
      sala.timerTurno = null;
    }

    io.to(sala.nome).emit(
      'atualizarEstadoTruco',
      {
        valorMao: sala.valorMao,
        ultimoPediuTime: sala.ultimoPediuTime,
        bloqueio: true,
        bloqueado: true,
        isMaoDe11: sala.isMaoDe11,
        maoDeFerro: sala.maoDeFerro
      }
    );

    io.to(sala.nome).emit(
      'solicitacaoTruco',
      sala.propostaTruco
    );

    let timeAdversario =
      jogadorAtual.time === 'A'
        ? 'B'
        : 'A';

    let advBot = sala.jogadores.find(
      j =>
        j.time === timeAdversario &&
        j.isBot
    );

    if (advBot) {
      setTimeout(() => {
        responderTrucoBot(
          sala,
          advBot
        );
      }, 1500);
    }

    return;
  }

  setTimeout(() => {
    if (
      sala.jogadores.includes(jogadorAtual) &&
      jogadorAtual.cartas.length > 0 &&
      !sala.processandoTurno
    ) {
      executarJogadaCarta(
        sala,
        jogadorAtual,
        0,
        false
      );
    }
  }, 1200);
}

function responderTrucoBot(sala, bot) {
  if (!sala.propostaTruco) return;

  const proposta = sala.propostaTruco;

  let temBoa =
    bot.cartas.some(
      c =>
        c.valor === sala.valorManilha ||
        ['3', '2'].includes(c.valor)
    );

  let aceitar =
    temBoa || Math.random() < 0.65;

  // A proposta é consumida antes de qualquer resposta.
  sala.propostaTruco = null;

  if (aceitar) {
    sala.valorMao =
      proposta.valorProposto;

    sala.ultimoPediuTime =
      proposta.pediuTime;

    io.to(sala.nome).emit(
      'jogadorAceitouTruco',
      {
        apelido: bot.apelido,
        valor: sala.valorMao
      }
    );

    io.to(sala.nome).emit(
      'atualizarEstadoTruco',
      {
        valorMao: sala.valorMao,
        ultimoPediuTime:
          sala.ultimoPediuTime,
        bloqueio: false,
        bloqueado: false,
        isMaoDe11: sala.isMaoDe11,
        maoDeFerro: sala.maoDeFerro
      }
    );

    iniciarTimerTurno(sala);
  } else {
    let timeQuePediu =
      proposta.pediuTime;

    finalizarMao(
      sala,
      timeQuePediu
    );
  }
}

function iniciarTimerTurno(sala) {
  if (sala.timerTurno) {
    clearTimeout(sala.timerTurno);
    sala.timerTurno = null;
  }

  const jogadorAtual =
    sala.jogadores[sala.indiceTurno];

  if (!jogadorAtual) return;

  io.to(sala.nome).emit(
    'atualizarVez',
    jogadorAtual.apelido
  );

  if (jogadorAtual.isBot) {
    verificarAcaoBot(sala);
    return;
  }

  sala.timerTurno = setTimeout(() => {
    sala.timerTurno = null;

    if (
      sala.jogadores.length ===
        sala.maxJogadores &&
      !sala.processandoTurno
    ) {
      const jogador =
        sala.jogadores[sala.indiceTurno];

      if (
        jogador &&
        jogador.cartas.length > 0
      ) {
        executarJogadaCarta(
          sala,
          jogador,
          0,
          false
        );
      }
    }
  }, 20000);
}

function processarFimDaRodada(sala) {
  let maiorForca = -1;
  let vencedorJogada = null;
  let empate = false;

  sala.cartasMesa.forEach(item => {
    if (item.escondida) return;

    let f =
      calcularForcaCarta(
        item.carta,
        sala.valorManilha
      );

    if (f > maiorForca) {
      maiorForca = f;
      vencedorJogada = item.jogador;
      empate = false;
    } else if (f === maiorForca) {
      empate = true;
    }
  });

  let resultado;

  if (empate) {
    resultado = 'Empate';
  } else if (vencedorJogada) {
    resultado = vencedorJogada.time;
  } else {
    resultado = 'Empate';
  }

  sala.historicoRodadas.push(resultado);

  io.to(sala.nome).emit(
    'atualizarRodadasMao',
    sala.historicoRodadas
  );

  if (
    sala.historicoRodadas.filter(r => r === 'A').length >= 2
  ) {
    finalizarMao(sala, 'A');
    return;
  }

  if (
    sala.historicoRodadas.filter(r => r === 'B').length >= 2
  ) {
    finalizarMao(sala, 'B');
    return;
  }

  if (sala.historicoRodadas.length >= 3) {
    let a =
      sala.historicoRodadas.filter(
        r => r === 'A'
      ).length;

    let b =
      sala.historicoRodadas.filter(
        r => r === 'B'
      ).length;

    if (a > b) {
      finalizarMao(sala, 'A');
    } else if (b > a) {
      finalizarMao(sala, 'B');
    } else {
      iniciarNovaRodada(sala);
    }

    return;
  }

  iniciarNovaRodada(sala);
}

function iniciarNovaRodada(sala) {
  sala.cartasMesa = [];
  sala.processandoTurno = false;

  io.to(sala.nome).emit(
    'atualizarMesa',
    []
  );

  io.to(sala.nome).emit(
    'atualizarRodadasMao',
    sala.historicoRodadas
  );

  let ultimaRodada =
    sala.historicoRodadas[
      sala.historicoRodadas.length - 1
    ];

  if (ultimaRodada === 'A') {
    let jogador =
      sala.jogadores.find(
        j => j.time === 'A'
      );

    if (jogador) {
      sala.indiceTurno =
        sala.jogadores.indexOf(jogador);
    }
  } else if (ultimaRodada === 'B') {
    let jogador =
      sala.jogadores.find(
        j => j.time === 'B'
      );

    if (jogador) {
      sala.indiceTurno =
        sala.jogadores.indexOf(jogador);
    }
  }

  iniciarTimerTurno(sala);
}

function executarJogadaCarta(
  sala,
  jogador,
  indiceCarta,
  esconder
) {
  if (sala.processandoTurno) return;

  if (
    jogador.id !==
    sala.jogadores[sala.indiceTurno].id
  ) {
    return;
  }

  if (
    indiceCarta < 0 ||
    indiceCarta >= jogador.cartas.length
  ) {
    return;
  }

  sala.processandoTurno = true;

  if (sala.timerTurno) {
    clearTimeout(sala.timerTurno);
    sala.timerTurno = null;
  }

  const carta =
    jogador.cartas.splice(
      indiceCarta,
      1
    )[0];

  sala.cartasMesa.push({
    jogador: jogador,
    carta: carta,
    escondida: !!esconder
  });

  io.to(sala.nome).emit(
    'atualizarMesa',
    sala.cartasMesa.map(item => ({
      apelido: item.jogador.apelido,
      avatar: item.jogador.avatar,
      carta: item.carta,
      escondida: item.escondida
    }))
  );

  if (jogador.cartas.length === 0) {
    processarFimDaRodada(sala);
    return;
  }

  sala.indiceTurno =
    (sala.indiceTurno + 1) %
    sala.jogadores.length;

  sala.processandoTurno = false;

  iniciarTimerTurno(sala);

  sala.jogadores.forEach(j => {
    if (!j.isBot) {
      io.to(j.id).emit(
        'minhasCartas',
        {
          cartas: j.cartas,
          noEscuro: sala.maoDeFerro
        }
      );
    }
  });
}

function finalizarMao(sala, timeVencedor) {
  if (!sala) return;

  if (sala.timerTurno) {
    clearTimeout(sala.timerTurno);
    sala.timerTurno = null;
  }

  sala.processandoTurno = true;

  if (timeVencedor === 'A') {
    sala.pontosA += sala.valorMao;
  } else if (timeVencedor === 'B') {
    sala.pontosB += sala.valorMao;
  }

  // A mão terminou.
  // O próximo valor sempre começa em 1.
  sala.valorMao = 1;
  sala.ultimoPediuTime = null;
  sala.propostaTruco = null;
  sala.processandoTurno = false;

  sala.cartasMesa = [];
  sala.historicoRodadas = [];

  io.to(sala.nome).emit(
    'atualizarMesa',
    []
  );

  io.to(sala.nome).emit(
    'atualizarRodadasMao',
    []
  );

  if (
    sala.pontosA >= 12 ||
    sala.pontosB >= 12
  ) {
    let vencedor =
      sala.pontosA >= 12
        ? 'A'
        : 'B';

    sala.trofeusA =
      sala.trofeusA || 0;

    sala.trofeusB =
      sala.trofeusB || 0;

    if (vencedor === 'A') {
      sala.trofeusA++;
    } else {
      sala.trofeusB++;
    }

    const trofeusA =
      sala.trofeusA;

    const trofeusB =
      sala.trofeusB;

    sala.pontosA = 0;
    sala.pontosB = 0;

    sala.valorMao = 1;
    sala.valorManilha = null;
    sala.vira = null;
    sala.baralho = [];
    sala.cartasMesa = [];
    sala.historicoRodadas = [];
    sala.ultimoPediuTime = null;
    sala.propostaTruco = null;
    sala.isMaoDe11 = false;
    sala.maoDeFerro = false;
    sala.timeNaMao11 = null;
    sala.mao11Decidida = false;
    sala.indicePe = -1;
    sala.indiceTurno = 0;
    sala.processandoTurno = false;
    sala.jogoIniciado = false;

    sala.jogadores.forEach(j => {
      j.cartas = [];

      if (!j.isBot) {
        io.to(j.id).emit(
          'minhasCartas',
          {
            cartas: [],
            noEscuro: false
          }
        );
      }
    });

    io.to(sala.nome).emit(
      'atualizarMesa',
      []
    );

    io.to(sala.nome).emit(
      'atualizarRodadasMao',
      []
    );

    io.to(sala.nome).emit(
      'fimDePartida',
      {
        vencedor,
        pontosA: 0,
        pontosB: 0
      }
    );

    io.to(sala.nome).emit(
      'atualizarTrofeus',
      {
        a: trofeusA,
        b: trofeusB
      }
    );

    io.to(sala.nome).emit(
      'atualizarJogadores',
      {
        jogadores: sala.jogadores,
        jogoIniciado: false
      }
    );

    return;
  }

  setTimeout(() => {
    if (salas[sala.nome]) {
      iniciarNovaMao(sala);
    }
  }, 1500);
}

io.on('connection', socket => {
  socket.on(
    'criarSala',
    ({
      apelido,
      avatar,
      nomeSala,
      maxJogadores
    }) => {
      if (salas[nomeSala]) {
        socket.emit(
          'erroEntrada',
          'Essa sala já existe.'
        );
        return;
      }

      let sala = {
        nome: nomeSala,
        donoId: socket.id,
        maxJogadores:
          parseInt(maxJogadores) || 4,

        jogadores: [],

        jogoIniciado: false,

        pontosA: 0,
        pontosB: 0,

        trofeusA: 0,
        trofeusB: 0,

        valorMao: 1,
        valorManilha: null,
        vira: null,

        baralho: [],
        cartasMesa: [],
        historicoRodadas: [],

        indicePe: -1,
        indiceTurno: 0,

        ultimoPediuTime: null,
        propostaTruco: null,

        isMaoDe11: false,
        maoDeFerro: false,
        timeNaMao11: null,
        mao11Decidida: false,

        timerTurno: null,
        processandoTurno: false
      };

      salas[nomeSala] = sala;

      socket.join(nomeSala);
      socket.nomeSala = nomeSala;

      let jogador = {
        id: socket.id,
        apelido,
        avatar,
        time: 'A',
        cartas: [],
        isBot: false,
        pronto: true
      };

      sala.jogadores.push(jogador);

      socket.emit(
        'sucessoEntrada',
        {
          apelido,
          time: 'A',
          nomeSala,
          isDono: true
        }
      );

      io.to(nomeSala).emit(
        'atualizarJogadores',
        {
          jogadores: sala.jogadores,
          jogoIniciado: false
        }
      );
    }
  );

  socket.on(
    'entrarSala',
    ({
      apelido,
      avatar,
      nomeSala
    }) => {
      let sala = salas[nomeSala];

      if (!sala) {
        socket.emit(
          'erroEntrada',
          'Sala não encontrada.'
        );
        return;
      }

      if (
        sala.jogadores.length >=
        sala.maxJogadores
      ) {
        socket.emit(
          'erroEntrada',
          'Sala cheia.'
        );
        return;
      }

      if (sala.jogoIniciado) {
        socket.emit(
          'erroEntrada',
          'A partida já começou.'
        );
        return;
      }

      socket.join(nomeSala);
      socket.nomeSala = nomeSala;

      let timeA =
        sala.jogadores.filter(
          j => j.time === 'A'
        ).length;

      let timeB =
        sala.jogadores.filter(
          j => j.time === 'B'
        ).length;

      let time =
        timeA <= timeB
          ? 'A'
          : 'B';

      let jogador = {
        id: socket.id,
        apelido,
        avatar,
        time,
        cartas: [],
        isBot: false,
        pronto: true
      };

      sala.jogadores.push(jogador);

      socket.emit(
        'sucessoEntrada',
        {
          apelido,
          time,
          nomeSala,
          isDono: false
        }
      );

      io.to(nomeSala).emit(
        'atualizarJogadores',
        {
          jogadores: sala.jogadores,
          jogoIniciado: false
        }
      );
    }
  );

  socket.on(
    'adicionarBot',
    () => {
      let sala =
        salas[socket.nomeSala];

      if (
        !sala ||
        sala.jogadores.length >=
          sala.maxJogadores ||
        sala.jogoIniciado
      ) {
        return;
      }

      let timeA =
        sala.jogadores.filter(
          j => j.time === 'A'
        ).length;

      let timeB =
        sala.jogadores.filter(
          j => j.time === 'B'
        ).length;

      let timeAtribuido =
        timeA <= timeB
          ? 'A'
          : 'B';

      let botJogador = {
        id:
          `bot_${Math.random().toString(36).substring(7)}`,

        apelido:
          `Bot_${sala.jogadores.length + 1}`,

        avatar: '🤖',

        time: timeAtribuido,

        cartas: [],

        isBot: true,

        pronto: true
      };

      sala.jogadores.push(
        botJogador
      );

      io.to(sala.nome).emit(
        'atualizarJogadores',
        {
          jogadores: sala.jogadores,
          jogoIniciado:
            sala.jogoIniciado
        }
      );
    }
  );

  socket.on(
    'solicitarInicioPartida',
    () => {
      let sala =
        salas[socket.nomeSala];

      if (
        !sala ||
        sala.donoId !== socket.id ||
        sala.jogoIniciado
      ) {
        return;
      }

      if (sala.jogadores.length < 2) {
        return;
      }

      sala.jogoIniciado = true;

      io.to(sala.nome).emit(
        'iniciarContagemRegressiva'
      );

      setTimeout(() => {
        if (salas[sala.nome]) {
          iniciarNovaMao(sala);
        }
      }, 5000);
    }
  );

  socket.on(
    'jogarCarta',
    ({
      indiceCarta,
      esconder
    }) => {
      let sala =
        salas[socket.nomeSala];

      if (
        !sala ||
        sala.processandoTurno
      ) {
        return;
      }

      let jogadorAtual =
        sala.jogadores[
          sala.indiceTurno
        ];

      if (!jogadorAtual) return;

      if (
        jogadorAtual.id !==
        socket.id
      ) {
        return;
      }

      executarJogadaCarta(
        sala,
        jogadorAtual,
        indiceCarta,
        esconder
      );
    }
  );

  // =========================================================
  // TRUCO / SEIS / NOVE / 12
  // =========================================================

  socket.on(
    'pedirTruco',
    () => {
      let sala =
        salas[socket.nomeSala];

      if (
        !sala ||
        sala.isMaoDe11 ||
        sala.maoDeFerro
      ) {
        return;
      }

      // =====================================================
      // TRAVA PRINCIPAL CONTRA SPAM
      // Se já existe uma proposta, qualquer novo clique
      // simplesmente é ignorado.
      // =====================================================
      if (sala.propostaTruco) {
        return;
      }

      let jogador =
        sala.jogadores.find(
          j => j.id === socket.id
        );

      if (!jogador) return;

      // O mesmo time não pode pedir novamente logo após
      // ter sido quem fez a última proposta aceita.
      if (
        sala.ultimoPediuTime ===
        jogador.time
      ) {
        return;
      }

      if (sala.valorMao >= 12) {
        return;
      }

      let proximoValor =
        sala.valorMao === 1
          ? 3
          : sala.valorMao === 3
            ? 6
            : sala.valorMao === 6
              ? 9
              : 12;

      // Cria UMA única proposta.
      sala.propostaTruco = {
        pediuApelido:
          jogador.apelido,

        pediuTime:
          jogador.time,

        valorProposto:
          proximoValor
      };

      if (sala.timerTurno) {
        clearTimeout(
          sala.timerTurno
        );

        sala.timerTurno = null;
      }

      // Trava o Truco para todos enquanto existe
      // uma proposta pendente.
      io.to(sala.nome).emit(
        'atualizarEstadoTruco',
        {
          valorMao:
            sala.valorMao,

          ultimoPediuTime:
            sala.ultimoPediuTime,

          bloqueio: true,
          bloqueado: true,

          isMaoDe11:
            sala.isMaoDe11,

          maoDeFerro:
            sala.maoDeFerro
        }
      );

      io.to(sala.nome).emit(
        'solicitacaoTruco',
        sala.propostaTruco
      );

      // Se for bot, ele responde automaticamente.
      let timeAdversario =
        jogador.time === 'A'
          ? 'B'
          : 'A';

      let advBot =
        sala.jogadores.find(
          j =>
            j.time ===
              timeAdversario &&
            j.isBot
        );

      if (advBot) {
        setTimeout(() => {
          responderTrucoBot(
            sala,
            advBot
          );
        }, 1500);
      }
    }
  );

  socket.on(
    'correrVoluntario',
    () => {
      let sala =
        salas[socket.nomeSala];

      if (
        !sala ||
        sala.processandoTurno ||
        sala.propostaTruco
      ) {
        return;
      }

      let jogador =
        sala.jogadores.find(
          j => j.id === socket.id
        );

      if (!jogador) return;

      let timeAdversario =
        jogador.time === 'A'
          ? 'B'
          : 'A';

      finalizarMao(
        sala,
        timeAdversario
      );
    }
  );

  socket.on(
    'respostaMao11',
    aceitou => {
      let sala =
        salas[socket.nomeSala];

      if (
        !sala ||
        !sala.isMaoDe11
      ) {
        return;
      }

      let jogador =
        sala.jogadores.find(
          j => j.id === socket.id
        );

      if (
        !jogador ||
        jogador.time !==
          sala.timeNaMao11
      ) {
        return;
      }

      processarRespostaMao11(
        sala,
        jogador.time,
        aceitou
      );
    }
  );

  socket.on(
    'respostaTruco',
    ({
      aceitou,
      aumentar
    }) => {
      let sala =
        salas[socket.nomeSala];

      if (
        !sala ||
        !sala.propostaTruco
      ) {
        return;
      }

      const proposta =
        sala.propostaTruco;

      const timeQuePediu =
        proposta.pediuTime;

      const jogadorResposta =
        sala.jogadores.find(
          j => j.id === socket.id
        );

      if (!jogadorResposta) {
        return;
      }

      // =====================================================
      // SEGURANÇA:
      // somente o time adversário pode responder.
      // =====================================================
      if (
        jogadorResposta.time ===
        timeQuePediu
      ) {
        return;
      }

      // =====================================================
      // CONSUME A PROPOSTA IMEDIATAMENTE.
      // Isso impede respostas duplicadas.
      // =====================================================
      sala.propostaTruco = null;

      // =====================================================
      // CORREU
      // =====================================================
      if (!aceitou) {
        finalizarMao(
          sala,
          timeQuePediu
        );

        return;
      }

      // =====================================================
      // ACEITOU
      // =====================================================
      sala.valorMao =
        proposta.valorProposto;

      sala.ultimoPediuTime =
        timeQuePediu;

      // =====================================================
      // ACEITOU SEM AUMENTAR
      // =====================================================
      if (
        !aumentar ||
        sala.valorMao >= 12
      ) {
        io.to(sala.nome).emit(
          'jogadorAceitouTruco',
          {
            apelido:
              jogadorResposta.apelido,

            valor:
              sala.valorMao
          }
        );

        io.to(sala.nome).emit(
          'atualizarEstadoTruco',
          {
            valorMao:
              sala.valorMao,

            ultimoPediuTime:
              sala.ultimoPediuTime,

            bloqueio: false,
            bloqueado: false,

            isMaoDe11:
              sala.isMaoDe11,

            maoDeFerro:
              sala.maoDeFerro
          }
        );

        iniciarTimerTurno(
          sala
        );

        return;
      }

      // =====================================================
      // ACEITOU E AUMENTOU
      //
      // Exemplo:
      // A pede 3
      // B aceita e pede 6
      // A aceita e pede 9
      // B aceita e pede 12
      // =====================================================

      let proximoValor =
        sala.valorMao === 3
          ? 6
          : sala.valorMao === 6
            ? 9
            : 12;

      if (proximoValor > 12) {
        io.to(sala.nome).emit(
          'atualizarEstadoTruco',
          {
            valorMao:
              sala.valorMao,

            ultimoPediuTime:
              sala.ultimoPediuTime,

            bloqueio: false,
            bloqueado: false
          }
        );

        iniciarTimerTurno(
          sala
        );

        return;
      }

      // Cria somente UMA nova proposta.
      sala.propostaTruco = {
        pediuApelido:
          jogadorResposta.apelido,

        pediuTime:
          jogadorResposta.time,

        valorProposto:
          proximoValor
      };

      io.to(sala.nome).emit(
        'atualizarEstadoTruco',
        {
          valorMao:
            sala.valorMao,

          ultimoPediuTime:
            sala.ultimoPediuTime,

          bloqueio: true,
          bloqueado: true,

          isMaoDe11:
            sala.isMaoDe11,

          maoDeFerro:
            sala.maoDeFerro
        }
      );

      io.to(sala.nome).emit(
        'solicitacaoTruco',
        sala.propostaTruco
      );
    }
  );

  socket.on(
    'enviarReacao',
    emoji => {
      if (socket.nomeSala) {
        io.to(
          socket.nomeSala
        ).emit(
          'receberReacao',
          {
            emoji
          }
        );
      }
    }
  );

  socket.on(
    'enviarChat',
    texto => {
      let sala =
        salas[socket.nomeSala];

      if (!sala) return;

      let jogador =
        sala.jogadores.find(
          j => j.id === socket.id
        );

      if (!jogador) return;

      io.to(sala.nome).emit(
        'receberChat',
        {
          apelido:
            jogador.apelido,

          texto
        }
      );
    }
  );

  socket.on(
    'disconnect',
    () => {
      let nomeSala =
        socket.nomeSala;

      if (
        nomeSala &&
        salas[nomeSala]
      ) {
        let sala =
          salas[nomeSala];

        let jogadorSaindo =
          sala.jogadores.find(
            j => j.id === socket.id
          );

        if (jogadorSaindo) {
          io.to(nomeSala).emit(
            'jogadorDesconectadoTemp',
            {
              apelido:
                jogadorSaindo.apelido
            }
          );

          jogadorSaindo.timerDesconexao =
            setTimeout(() => {
              if (
                salas[nomeSala]
              ) {
                delete salas[nomeSala];

                io.to(nomeSala).emit(
                  'jogadorDesconectado',
                  {
                    apelido:
                      jogadorSaindo.apelido
                  }
                );
              }
            }, 30000);
        }
      }
    }
  );
});

const PORT =
  process.env.PORT || 10000;

server.listen(
  PORT,
  '0.0.0.0',
  () =>
    console.log(
      `Servidor a executar na porta ${PORT}`
    )
);
