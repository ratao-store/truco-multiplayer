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
  let proxIdx = (idx + 1) % VALORES_ORDEM.length;
  return VALORES_ORDEM[proxIdx];
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
      io.to(j.id).emit('minhasCartas', {
        cartas: j.cartas,
        noEscuro: sala.maoDeFerro
      });
    }
  });

  if (sala.isMaoDe11) {
    io.to(sala.nome).emit('decisaoMao11Pendente', { timeNaMao11: sala.timeNaMao11 });
  } else {
    iniciarTimerTurno(sala);
  }
}

function iniciarTimerTurno(sala) {
  if (sala.timerTurno) clearTimeout(sala.timerTurno);
  
  const jogadorAtual = sala.jogadores[sala.indiceTurno];
  io.to(sala.nome).emit('atualizarVez', jogadorAtual.apelido);

  // Inteligência Artificial do Bot
  if (jogadorAtual.isBot && !sala.processandoTurno) {
    setTimeout(() => {
      if (jogadorAtual.cartas.length > 0) {
        executarJogadaCarta(sala, jogadorAtual, 0, false);
      }
    }, 1200);
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
      io.to(sala.nome).emit('efeitoManilhaZap', {
        carta: cartaGanhadora,
        isZap: cartaGanhadora.naipe === '♣'
      });
    }
  }

  if (!empate && vencedorJogada) {
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
  }, 3000);
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
  sala.cartasMesa.push({
    jogador,
    carta: cartaJogada,
    escondida: esconder
  });

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
    if (salas[nomeSala]) {
      return socket.emit('erroEntrada', 'Já existe uma sala com este nome!');
    }

    salas[nomeSala] = {
      nome: nomeSala,
      maxJogadores: max,
      jogadores: [],
      pontosA: 0,
      pontosB: 0,
      trofeusA: 0,
      trofeusB: 0,
      indicePe: -1,
      timerTurno: null,
      processandoTurno: false
    };

    entrarNaSala(socket, apelido, avatar, nomeSala);
  });

  socket.on('entrarSala', ({ apelido, avatar, nomeSala }) => {
    if (!salas[nomeSala]) {
      return socket.emit('erroEntrada', 'Sala não encontrada!');
    }
    entrarNaSala(socket, apelido, avatar, nomeSala);
  });

  function entrarNaSala(socket, apelido, avatar, nomeSala) {
    let sala = salas[nomeSala];

    // Verificar se é reconexão de um jogador existente
    let jogadorExistente = sala.jogadores.find(j => j.apelido === apelido);
    if (jogadorExistente) {
      if (jogadorExistente.timerDesconexao) {
        clearTimeout(jogadorExistente.timerDesconexao);
        jogadorExistente.timerDesconexao = null;
      }
      jogadorExistente.id = socket.id;
      socket.join(nomeSala);
      socket.nomeSala = nomeSala;

      socket.emit('sucessoEntrada', { apelido, time: jogadorExistente.time, nomeSala });
      io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);
      io.to(nomeSala).emit('jogadorReconectou', { apelido });

      socket.emit('minhasCartas', { cartas: jogadorExistente.cartas, noEscuro: sala.maoDeFerro });
      socket.emit('atualizarMesa', sala.cartasMesa);
      return;
    }

    if (sala.jogadores.length >= sala.maxJogadores) {
      return socket.emit('erroEntrada', 'A sala já está cheia!');
    }

    let timeA = sala.jogadores.filter(j => j.time === 'A').length;
    let timeB = sala.jogadores.filter(j => j.time === 'B').length;
    let timeAtribuido = (timeA <= timeB) ? 'A' : 'B';

    let novoJogador = {
      id: socket.id,
      apelido,
      avatar: avatar || '🥸',
      time: timeAtribuido,
      cartas: [],
      isBot: false
    };

    sala.jogadores.push(novoJogador);
    socket.join(nomeSala);
    socket.nomeSala = nomeSala;

    socket.emit('sucessoEntrada', { apelido, time: timeAtribuido, nomeSala });
    io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);

    if (sala.jogadores.length === sala.maxJogadores) {
      iniciarNovaMao(sala);
    }
  }

  // Suporte a Bots (IA)
  socket.on('adicionarBot', () => {
    let nomeSala = socket.nomeSala;
    let sala = salas[nomeSala];
    if (!sala || sala.jogadores.length >= sala.maxJogadores) return;

    let timeA = sala.jogadores.filter(j => j.time === 'A').length;
    let timeB = sala.jogadores.filter(j => j.time === 'B').length;
    let timeAtribuido = (timeA <= timeB) ? 'A' : 'B';

    let botId = `bot_${Math.random().toString(36).substring(7)}`;
    let botJogador = {
      id: botId,
      apelido: `Bot_${sala.jogadores.length + 1}`,
      avatar: '🤖',
      time: timeAtribuido,
      cartas: [],
      isBot: true
    };

    sala.jogadores.push(botJogador);
    io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);

    if (sala.jogadores.length === sala.maxJogadores) {
      iniciarNovaMao(sala);
    }
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

    let proximoValor = 3;
    if (sala.valorMao === 3) proximoValor = 6;
    else if (sala.valorMao === 6) proximoValor = 9;
    else if (sala.valorMao === 9) proximoValor = 12;

    sala.propostaTruco = {
      pediuApelido: jogador.apelido,
      pediuTime: jogador.time,
      valorProposto: proximoValor
    };

    if (sala.timerTurno) clearTimeout(sala.timerTurno);
    io.to(sala.nome).emit('solicitacaoTruco', sala.propostaTruco);
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

    io.to(sala.nome).emit('atualizarEstadoTruco', {
      valorMao: sala.valorMao,
      ultimoPediuTime: sala.ultimoPediuTime,
      bloqueio: false
    });

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

  socket.on('respostaMao11', (aceitou) => {
    let sala = salas[socket.nomeSala];
    if (!sala || !sala.isMaoDe11 || sala.mao11Decidida) return;

    let jogador = sala.jogadores.find(j => j.id === socket.id);
    if (!jogador || jogador.time !== sala.timeNaMao11) return;

    sala.mao11Decidida = true;

    if (aceitou) {
      sala.valorMao = 3;
      io.to(sala.nome).emit('atualizarEstadoTruco', { valorMao: 3, bloqueio: true });
      iniciarTimerTurno(sala);
    } else {
      sala.valorMao = 1;
      let timeRival = sala.timeNaMao11 === 'A' ? 'B' : 'A';
      finalizarMao(sala, timeRival);
    }
  });

  socket.on('enviarReacao', (emoji) => {
    let nomeSala = socket.nomeSala;
    if (nomeSala) {
      io.to(nomeSala).emit('receberReacao', { emoji });
    }
  });

  socket.on('enviarChat', (texto) => {
    let nomeSala = socket.nomeSala;
    let sala = salas[nomeSala];
    if (sala) {
      let jogador = sala.jogadores.find(j => j.id === socket.id);
      if (jogador) {
        io.to(nomeSala).emit('receberChat', { apelido: jogador.apelido, texto });
      }
    }
  });

  socket.on('destruirSalaForcado', () => {
    let nomeSala = socket.nomeSala;
    if (salas[nomeSala]) {
      if (salas[nomeSala].timerTurno) clearTimeout(salas[nomeSala].timerTurno);
      io.to(nomeSala).emit('salaDestruida', 'A sala foi encerrada.');
      delete salas[nomeSala];
    }
  });

  // Gestão de Desconexão Temporária (30s de Margem)
  socket.on('disconnect', () => {
    let nomeSala = socket.nomeSala;
    if (nomeSala && salas[nomeSala]) {
      let sala = salas[nomeSala];
      let jogadorSaindo = sala.jogadores.find(j => j.id === socket.id);

      if (jogadorSaindo) {
        io.to(nomeSala).emit('jogadorDesconectadoTemp', { apelido: jogadorSaindo.apelido });

        jogadorSaindo.timerDesconexao = setTimeout(() => {
          if (salas[nomeSala]) {
            if (sala.timerTurno) clearTimeout(sala.timerTurno);
            io.to(nomeSala).emit('jogadorDesconectado', { apelido: jogadorSaindo.apelido });
            delete salas[nomeSala];
          }
        }, 30000); // 30 segundos para reconectar
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));
