const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

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
    const forcaNaipes = { '♦': 101, '♠': 102, '♥': 103, '♣': 104 };
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
  sala.cartasMesa = [];
  sala.historicoRodadas = [];
  sala.processandoTurno = false;

  sala.isMaoDe11 = (sala.pontosA === 11 || sala.pontosB === 11) && !(sala.pontosA === 11 && sala.pontosB === 11);
  sala.maoDeFerro = (sala.pontosA === 11 && sala.pontosB === 11);

  if (sala.isMaoDe11) {
    sala.valorMao = 3;
    sala.timeNaMao11 = sala.pontosA === 11 ? 'A' : 'B';
    sala.mao11Decidida = false;
  }

  sala.jogadores.forEach(j => {
    j.cartas = [sala.baralho.pop(), sala.baralho.pop(), sala.baralho.pop()];
  });

  sala.indicePe = (sala.indicePe + 1) % sala.jogadores.length;
  sala.indiceTurno = (sala.indicePe + 1) % sala.jogadores.length;

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
      io.to(j.id).emit('minhasCartas', { cartas: j.cartas, noEscuro: sala.maoDeFerro });
    }
  });

  if (sala.isMaoDe11) {
    io.to(sala.nome).emit('decisaoMao11Pendente', { timeNaMao11: sala.timeNaMao11 });
  } else {
    iniciarTimerTurno(sala);
  }
}

function verificarAcaoBot(sala) {
  const jogadorAtual = sala.jogadores[sala.indiceTurno];
  if (!jogadorAtual || !jogadorAtual.isBot || sala.processandoTurno) return;

  // Decisão de Pedir Truco pela IA do Bot
  let temManilhaOuCartaBoa = jogadorAtual.cartas.some(c => c.valor === sala.valorManilha || ['3', '2', 'A'].includes(c.valor));
  let roubarBluff = Math.random() < 0.25; // 25% de hipótese de blefar (roubar)

  if ((temManilhaOuCartaBoa || roubarBluff) && sala.ultimoPediuTime !== jogadorAtual.time && !sala.isMaoDe11 && sala.valorMao < 12) {
    let proximoValor = sala.valorMao === 1 ? 3 : (sala.valorMao === 3 ? 6 : (sala.valorMao === 6 ? 9 : 12));
    sala.propostaTruco = {
      pediuApelido: jogadorAtual.apelido,
      pediuTime: jogadorAtual.time,
      valorProposto: proximoValor
    };
    if (sala.timerTurno) clearTimeout(sala.timerTurno);
    io.to(sala.nome).emit('solicitacaoTruco', sala.propostaTruco);

    // Se o adversário for outro bot, responder automaticamente
    let timeAdversario = jogadorAtual.time === 'A' ? 'B' : 'A';
    let advBot = sala.jogadores.find(j => j.time === timeAdversario && j.isBot);
    if (advBot) {
      setTimeout(() => responderTrucoBot(sala, advBot), 1500);
    }
    return;
  }

  // Jogar Carta do Bot
  setTimeout(() => {
    if (jogadorAtual.cartas.length > 0) {
      executarJogadaCarta(sala, jogadorAtual, 0, false);
    }
  }, 1200);
}

function responderTrucoBot(sala, bot) {
  if (!sala.propostaTruco) return;

  let temBoa = bot.cartas.some(c => c.valor === sala.valorManilha || ['3', '2'].includes(c.valor));
  let aceitar = temBoa || Math.random() < 0.65; // Aceita a maioria dos trucos

  if (aceitar) {
    sala.valorMao = sala.propostaTruco.valorProposto;
    sala.ultimoPediuTime = sala.propostaTruco.pediuTime;
    sala.propostaTruco = null;

    io.to(sala.nome).emit('atualizarEstadoTruco', { valorMao: sala.valorMao, ultimoPediuTime: sala.ultimoPediuTime, bloqueio: false });
    iniciarTimerTurno(sala);
  } else {
    let timeQuePediu = sala.propostaTruco.pediuTime;
    sala.propostaTruco = null;
    finalizarMao(sala, timeQuePediu);
  }
}

function iniciarTimerTurno(sala) {
  if (sala.timerTurno) clearTimeout(sala.timerTurno);

  const jogadorAtual = sala.jogadores[sala.indiceTurno];
  io.to(sala.nome).emit('atualizarVez', jogadorAtual.apelido);

  if (jogadorAtual.isBot) {
    verificarAcaoBot(sala);
    return;
  }

  sala.timerTurno = setTimeout(() => {
    if (sala.jogadores.length === sala.maxJogadores && !sala.processandoTurno) {
      const jogador = sala.jogadores[sala.indiceTurno];
      if (jogador && jogador.cartas.length > 0) {
        executarJogadaCarta(sala, jogador, 0, false);
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
    let f = calcularForcaCarta(item.carta, sala.valorManilha);
    if (f > maiorForca) {
      maiorForca = f;
      vencedorJogada = item.jogador;
      empate = false;
    } else if (f === maiorForca) {
      empate = true;
    }
  });

  let resultadoRodada = empate ? 'Empate' : vencedorJogada.time;
  sala.historicoRodadas.push(resultadoRodada);

  io.to(sala.nome).emit('atualizarRodadasMao', sala.historicoRodadas);

  if (!empate && vencedorJogada) {
    let cartaGanhadora = sala.cartasMesa.find(i => i.jogador === vencedorJogada).carta;
    if (cartaGanhadora.valor === sala.valorManilha) {
      io.to(sala.nome).emit('efeitoManilhaZap', { carta: cartaGanhadora, isZap: cartaGanhadora.naipe === '♣' });
    }
    sala.indiceTurno = sala.jogadores.findIndex(j => j.id === vencedorJogada.id);
  }

  let vencedorMao = determinarVencedorMao(sala.historicoRodadas);

  setTimeout(() => {
    sala.cartasMesa = [];
    io.to(sala.nome).emit('atualizarMesa', []);

    if (vencedorMao) {
      finalizarMao(sala, vencedorMao);
    } else {
      sala.processandoTurno = false;
      iniciarTimerTurno(sala);
    }
  }, 2500);
}

function determinarVencedorMao(historico) {
  let vitoriasA = historico.filter(r => r === 'A').length;
  let vitoriasB = historico.filter(r => r === 'B').length;

  if (vitoriasA >= 2) return 'A';
  if (vitoriasB >= 2) return 'B';

  if (historico.length === 2) {
    if (historico[0] === 'Empate' && historico[1] !== 'Empate') return historico[1];
    if (historico[1] === 'Empate' && historico[0] !== 'Empate') return historico[0];
  }

  if (historico.length === 3) {
    if (historico[2] !== 'Empate') return historico[2];
    if (historico[0] !== 'Empate') return historico[0];
  }

  return null;
}

function finalizarMao(sala, timeVencedor) {
  if (sala.timerTurno) clearTimeout(sala.timerTurno);

  if (timeVencedor === 'A') sala.pontosA += sala.valorMao;
  if (timeVencedor === 'B') sala.pontosB += sala.valorMao;

  if (sala.pontosA >= 12 || sala.pontosB >= 12) {
    let campeao = sala.pontosA >= 12 ? 'A' : 'B';
    if (campeao === 'A') sala.trofeusA++;
    else sala.trofeusB++;

    io.to(sala.nome).emit('fimDePartida', { vencedor: campeao });
    io.to(sala.nome).emit('atualizarTrofeus', { a: sala.trofeusA, b: sala.trofeusB });

    sala.pontosA = 0;
    sala.pontosB = 0;
  }

  iniciarNovaMao(sala);
}

function executarJogadaCarta(sala, jogador, indiceCarta, esconder) {
  let cartaJogada = jogador.cartas.splice(indiceCarta, 1)[0];
  sala.cartasMesa.push({ jogador, carta: cartaJogada, escondida: esconder });

  io.to(sala.nome).emit('atualizarMesa', sala.cartasMesa);
  if (!jogador.isBot) {
    io.to(jogador.id).emit('minhasCartas', { cartas: jogador.cartas, noEscuro: sala.maoDeFerro });
  }

  if (sala.cartasMesa.length === sala.jogadores.length) {
    sala.processandoTurno = true;
    if (sala.timerTurno) clearTimeout(sala.timerTurno);
    processarFimDaRodada(sala);
  } else {
    sala.indiceTurno = (sala.indiceTurno + 1) % sala.jogadores.length;
    iniciarTimerTurno(sala);
  }
}

io.on('connection', (socket) => {

  socket.on('criarSala', ({ apelido, avatar, nomeSala, maxJogadores }) => {
    let max = parseInt(maxJogadores) === 2 ? 2 : 4;
    if (salas[nomeSala]) return socket.emit('erroEntrada', 'Já existe uma sala com este nome!');

    salas[nomeSala] = {
      nome: nomeSala,
      maxJogadores: max,
      donoId: socket.id,
      jogadores: [],
      pontosA: 0,
      pontosB: 0,
      trofeusA: 0,
      trofeusB: 0,
      indicePe: -1,
      timerTurno: null,
      processandoTurno: false,
      jogoIniciado: false
    };

    entrarNaSala(socket, apelido, avatar, nomeSala);
  });

  socket.on('entrarSala', ({ apelido, avatar, nomeSala }) => {
    if (!salas[nomeSala]) return socket.emit('erroEntrada', 'Sala não encontrada!');
    entrarNaSala(socket, apelido, avatar, nomeSala);
  });

  function entrarNaSala(socket, apelido, avatar, nomeSala) {
    let sala = salas[nomeSala];

    let jogadorExistente = sala.jogadores.find(j => j.apelido === apelido);
    if (jogadorExistente) {
      if (jogadorExistente.timerDesconexao) {
        clearTimeout(jogadorExistente.timerDesconexao);
        jogadorExistente.timerDesconexao = null;
      }
      jogadorExistente.id = socket.id;
      socket.join(nomeSala);
      socket.nomeSala = nomeSala;

      let isDono = (sala.donoId === socket.id);
      socket.emit('sucessoEntrada', { apelido, time: jogadorExistente.time, nomeSala, isDono });
      io.to(nomeSala).emit('atualizarJogadores', { jogadores: sala.jogadores, jogoIniciado: sala.jogoIniciado });
      return;
    }

    if (sala.jogadores.length >= sala.maxJogadores) return socket.emit('erroEntrada', 'A sala já está cheia!');

    let timeA = sala.jogadores.filter(j => j.time === 'A').length;
    let timeB = sala.jogadores.filter(j => j.time === 'B').length;
    let timeAtribuido = (timeA <= timeB) ? 'A' : 'B';

    let novoJogador = {
      id: socket.id,
      apelido,
      avatar: avatar || '🥸',
      time: timeAtribuido,
      cartas: [],
      isBot: false,
      pronto: false
    };

    sala.jogadores.push(novoJogador);
    socket.join(nomeSala);
    socket.nomeSala = nomeSala;

    let isDono = (sala.donoId === socket.id);
    socket.emit('sucessoEntrada', { apelido, time: timeAtribuido, nomeSala, isDono });
    io.to(nomeSala).emit('atualizarJogadores', { jogadores: sala.jogadores, jogoIniciado: sala.jogoIniciado });
  }

  socket.on('adicionarBot', () => {
    let sala = salas[socket.nomeSala];
    if (!sala || sala.jogadores.length >= sala.maxJogadores) return;

    let timeA = sala.jogadores.filter(j => j.time === 'A').length;
    let timeB = sala.jogadores.filter(j => j.time === 'B').length;
    let timeAtribuido = (timeA <= timeB) ? 'A' : 'B';

    let botJogador = {
      id: `bot_${Math.random().toString(36).substring(7)}`,
      apelido: `Bot_${sala.jogadores.length + 1}`,
      avatar: '🤖',
      time: timeAtribuido,
      cartas: [],
      isBot: true,
      pronto: true
    };

    sala.jogadores.push(botJogador);
    io.to(sala.nome).emit('atualizarJogadores', { jogadores: sala.jogadores, jogoIniciado: sala.jogoIniciado });
  });

  socket.on('solicitarInicioPartida', () => {
    let sala = salas[socket.nomeSala];
    if (!sala || sala.donoId !== socket.id || sala.jogoIniciado) return;

    sala.jogoIniciado = true;
    io.to(sala.nome).emit('iniciarContagemRegressiva');

    setTimeout(() => {
      iniciarNovaMao(sala);
    }, 5000);
  });

  socket.on('jogarCarta', ({ indiceCarta, esconder }) => {
    let sala = salas[socket.nomeSala];
    if (!sala || sala.processandoTurno) return;

    let jogadorAtual = sala.jogadores[sala.indiceTurno];
    if (jogadorAtual.id !== socket.id) return;

    executarJogadaCarta(sala, jogadorAtual, indiceCarta, esconder);
  });

  socket.on('pedirTruco', () => {
    let sala = salas[socket.nomeSala];
    if (!sala || sala.isMaoDe11 || sala.maoDeFerro) return;

    let jogador = sala.jogadores.find(j => j.id === socket.id);
    if (!jogador || sala.ultimoPediuTime === jogador.time) return;

    let proximoValor = sala.valorMao === 1 ? 3 : (sala.valorMao === 3 ? 6 : (sala.valorMao === 6 ? 9 : 12));

    sala.propostaTruco = {
      pediuApelido: jogador.apelido,
      pediuTime: jogador.time,
      valorProposto: proximoValor
    };

    if (sala.timerTurno) clearTimeout(sala.timerTurno);
    io.to(sala.nome).emit('solicitacaoTruco', sala.propostaTruco);

    // Se o adversário for Bot, responde automaticamente
    let timeAdversario = jogador.time === 'A' ? 'B' : 'A';
    let advBot = sala.jogadores.find(j => j.time === timeAdversario && j.isBot);
    if (advBot) {
      setTimeout(() => responderTrucoBot(sala, advBot), 1500);
    }
  });

  socket.on('respostaTruco', ({ aceitou, aumentar }) => {
    let sala = salas[socket.nomeSala];
    if (!sala || !sala.propostaTruco) return;

    let timeQuePediu = sala.propostaTruco.pediuTime;

    if (!aceitou) {
      finalizarMao(sala, timeQuePediu);
      sala.propostaTruco = null;
      return;
    }

    sala.valorMao = sala.propostaTruco.valorProposto;
    sala.ultimoPediuTime = timeQuePediu;
    sala.propostaTruco = null;

    io.to(sala.nome).emit('atualizarEstadoTruco', { valorMao: sala.valorMao, ultimoPediuTime: sala.ultimoPediuTime, bloqueio: false });

    if (aumentar) {
      let jogador = sala.jogadores.find(j => j.id === socket.id);
      let proximoValor = sala.valorMao === 3 ? 6 : (sala.valorMao === 6 ? 9 : 12);

      sala.propostaTruco = {
        pediuApelido: jogador.apelido,
        pediuTime: jogador.time,
        valorProposto: proximoValor
      };
      io.to(sala.nome).emit('solicitacaoTruco', sala.propostaTruco);
    } else {
      iniciarTimerTurno(sala);
    }
  });

  socket.on('enviarReacao', (emoji) => {
    if (socket.nomeSala) io.to(socket.nomeSala).emit('receberReacao', { emoji });
  });

  socket.on('enviarChat', (texto) => {
    let sala = salas[socket.nomeSala];
    if (sala) {
      let jogador = sala.jogadores.find(j => j.id === socket.id);
      if (jogador) {
        io.to(sala.nome).emit('receberChat', { apelido: jogador.apelido, texto });
      }
    }
  });

  socket.on('disconnect', () => {
    let nomeSala = socket.nomeSala;
    if (nomeSala && salas[nomeSala]) {
      let sala = salas[nomeSala];
      let jogadorSaindo = sala.jogadores.find(j => j.id === socket.id);

      if (jogadorSaindo) {
        io.to(nomeSala).emit('jogadorDesconectadoTemp', { apelido: jogadorSaindo.apelido });
        jogadorSaindo.timerDesconexao = setTimeout(() => {
          if (salas[nomeSala]) {
            delete salas[nomeSala];
            io.to(nomeSala).emit('jogadorDesconectado', { apelido: jogadorSaindo.apelido });
          }
        }, 30000);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
