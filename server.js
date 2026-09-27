const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const salas = {};

const NAIPES = ['♣', '♥', '♠', '♦'];
const VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

const FORCA_CARTA = {
  '4': 1, '5': 2, '6': 3, '7': 4,
  'Q': 5, 'J': 6, 'K': 7, 'A': 8,
  '2': 9, '3': 10
};

// Ordem dos Quatro Paus do Truco Paulista
const FORCA_NAIPE = {
  '♣': 4, // Zap (Mais forte)
  '♥': 3, // Copas
  '♠': 2, // Espadilha
  '♦': 1  // Ouros
};

function criarBaralho() {
  const baralho = [];
  for (let naipe of NAIPES) {
    for (let valor of VALORES) {
      baralho.push({ valor, naipe });
    }
  }
  return baralho.sort(() => Math.random() - 0.5);
}

function proximaCarta(valor) {
  const idx = VALORES.indexOf(valor);
  return VALORES[(idx + 1) % VALORES.length];
}

function calcularForca(carta, valorManilha) {
  if (carta.valor === valorManilha) {
    return 100 + FORCA_NAIPE[carta.naipe];
  }
  return FORCA_CARTA[carta.valor];
}

function iniciarNovaMao(nomeSala) {
  const sala = salas[nomeSala];
  if (!sala) return;

  sala.baralho = criarBaralho();
  sala.vira = sala.baralho.pop();
  sala.valorManilha = proximaCarta(sala.vira.valor);
  sala.valorMao = 1;
  sala.trucoPendente = null;
  sala.ultimoPediuTime = null;
  sala.jogadasRodadaAtual = [];
  sala.rodadasGanhas = { A: 0, B: 0 };
  sala.historicoRodadas = [];
  sala.aguardandoMao11 = false;

  const pA = sala.pontos.A;
  const pB = sala.pontos.B;
  const maoDeFerro = (pA === 11 && pB === 11);
  const isMaoDe11 = (pA === 11 || pB === 11) && !maoDeFerro;

  sala.jogadores.forEach(j => {
    j.cartas = [sala.baralho.pop(), sala.baralho.pop(), sala.baralho.pop()];
  });

  if (sala.indiceIniciadorMao === undefined) {
    sala.indiceIniciadorMao = 0;
  } else {
    sala.indiceIniciadorMao = (sala.indiceIniciadorMao + 1) % sala.jogadores.length;
  }
  
  // Define quem começa a primeira rodada da mão
  sala.indiceVez = sala.indiceIniciadorMao;
  sala.primeiroDaRodadaAtual = sala.indiceIniciadorMao;

  sala.jogadores.forEach(j => {
    if (j.id) {
      io.to(j.id).emit('minhasCartas', {
        cartas: j.cartas,
        noEscuro: maoDeFerro
      });
    }
  });

  io.to(nomeSala).emit('novaMao', {
    vira: sala.vira,
    valorManilha: sala.valorManilha,
    valorMao: isMaoDe11 ? 3 : 1,
    pontosA: pA,
    pontosB: pB,
    vez: sala.jogadores[sala.indiceVez].apelido,
    maoDeFerro,
    isMaoDe11
  });

  io.to(nomeSala).emit('atualizarEstadoTruco', {
    valorMao: isMaoDe11 ? 3 : 1,
    ultimoPediuTime: null,
    bloqueado: isMaoDe11 || maoDeFerro
  });

  if (isMaoDe11) {
    sala.valorMao = 3;
    sala.aguardandoMao11 = true;
    sala.timeNaMao11 = pA === 11 ? 'A' : 'B';
    io.to(nomeSala).emit('decisaoMao11Pendente', { timeNaMao11: sala.timeNaMao11 });
  }

  io.to(nomeSala).emit('atualizarMesa', []);
  io.to(nomeSala).emit('atualizarRodadasMao', sala.historicoRodadas);
}

function verificarFimMao(nomeSala) {
  const sala = salas[nomeSala];
  let timeVencedorMao = null;
  const r = sala.historicoRodadas;

  if (r.length === 1) {
    if (sala.rodadasGanhas.A === 2) timeVencedorMao = 'A';
    if (sala.rodadasGanhas.B === 2) timeVencedorMao = 'B';
  } else if (r.length === 2) {
    if (sala.rodadasGanhas.A >= 2) timeVencedorMao = 'A';
    else if (sala.rodadasGanhas.B >= 2) timeVencedorMao = 'B';
    else if (r[1] === 'Empate') {
      if (r[0] !== 'Empate') timeVencedorMao = r[0];
    } else if (r[0] === 'Empate') {
      if (r[1] !== 'Empate') timeVencedorMao = r[1];
    }
  } else if (r.length === 3) {
    if (sala.rodadasGanhas.A > sala.rodadasGanhas.B) timeVencedorMao = 'A';
    else if (sala.rodadasGanhas.B > sala.rodadasGanhas.A) timeVencedorMao = 'B';
    else if (r[2] === 'Empate') {
      if (r[0] !== 'Empate') timeVencedorMao = r[0];
      else timeVencedorMao = 'A';
    } else {
      timeVencedorMao = r[2] !== 'Empate' ? r[2] : 'A';
    }
  }

  if (timeVencedorMao) {
    sala.pontos[timeVencedorMao] += sala.valorMao;

    if (sala.pontos[timeVencedorMao] >= 12) {
      sala.trofeus[timeVencedorMao] += 1;
      io.to(nomeSala).emit('atualizarTrofeus', sala.trofeus);
      io.to(nomeSala).emit('fimDePartida', { vencedor: timeVencedorMao });
      sala.pontos = { A: 0, B: 0 };
    }

    iniciarNovaMao(nomeSala);
    return true;
  }
  return false;
}

io.on('connection', (socket) => {

  socket.on('criarSala', ({ apelido, nomeSala, maxJogadores }) => {
    if (salas[nomeSala]) return socket.emit('erroEntrada', 'A sala já existe!');
    salas[nomeSala] = {
      maxJogadores: parseInt(maxJogadores) || 4,
      jogadores: [], pontos: { A: 0, B: 0 }, trofeus: { A: 0, B: 0 },
      emAndamento: false, valorMao: 1, ultimoPediuTime: null
    };
    entrarNaSala(socket, apelido, nomeSala);
  });

  socket.on('entrarSala', ({ apelido, nomeSala }) => {
    const sala = salas[nomeSala];
    if (!sala) return socket.emit('erroEntrada', 'Sala não encontrada!');

    const jogadorExistente = sala.jogadores.find(j => j.apelido.toLowerCase() === apelido.toLowerCase());
    if (jogadorExistente) {
      if (jogadorExistente.online) return socket.emit('erroEntrada', 'Apelido em uso!');
      jogadorExistente.id = socket.id;
      jogadorExistente.online = true;
      socket.join(nomeSala);
      socket.nomeSala = nomeSala;
      socket.apelido = jogadorExistente.apelido;
      socket.time = jogadorExistente.time;

      socket.emit('sucessoEntrada', { apelido: jogadorExistente.apelido, time: jogadorExistente.time, nomeSala });
      io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);
      return;
    }

    entrarNaSala(socket, apelido, nomeSala);
  });

  function entrarNaSala(socket, apelido, nomeSala) {
    const sala = salas[nomeSala];
    const time = sala.jogadores.length % 2 === 0 ? 'A' : 'B';

    socket.join(nomeSala);
    socket.nomeSala = nomeSala;
    socket.apelido = apelido;
    socket.time = time;

    sala.jogadores.push({ id: socket.id, apelido, time, cartas: [], online: true });
    socket.emit('sucessoEntrada', { apelido, time, nomeSala });
    io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);

    if (sala.jogadores.length === sala.maxJogadores && !sala.emAndamento) {
      sala.emAndamento = true;
      iniciarNovaMao(nomeSala);
    }
  }

  socket.on('respostaMao11', (aceitou) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.aguardandoMao11 || socket.time !== sala.timeNaMao11) return;

    sala.aguardandoMao11 = false;
    if (aceitou) {
      io.to(socket.nomeSala).emit('atualizarVez', sala.jogadores[sala.indiceVez].apelido);
    } else {
      const adversario = sala.timeNaMao11 === 'A' ? 'B' : 'A';
      sala.pontos[adversario] += 1;
      if (sala.pontos[adversario] >= 12) {
        sala.trofeus[adversario] += 1;
        io.to(socket.nomeSala).emit('atualizarTrofeus', sala.trofeus);
        io.to(socket.nomeSala).emit('fimDePartida', { vencedor: adversario });
        sala.pontos = { A: 0, B: 0 };
      }
      iniciarNovaMao(socket.nomeSala);
    }
  });

  socket.on('jogarCarta', ({ indiceCarta, esconder }) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.emAndamento || sala.aguardandoMao11 || sala.trucoPendente) return;

    const jogadorDaVez = sala.jogadores[sala.indiceVez];
    if (jogadorDaVez.id !== socket.id) return;

    const jogador = sala.jogadores.find(j => j.id === socket.id);
    if (!jogador || !jogador.cartas[indiceCarta]) return;

    const cartaJogada = jogador.cartas.splice(indiceCarta, 1)[0];
    const cartaEscondida = esconder && (sala.historicoRodadas.length >= 1);

    const isManilha = (cartaJogada.valor === sala.valorManilha);
    const isZap = (isManilha && cartaJogada.naipe === '♣');

    if (isManilha && !cartaEscondida) {
      io.to(socket.nomeSala).emit('efeitoManilhaZap', { carta: cartaJogada, isZap });
    }

    sala.jogadasRodadaAtual.push({
      jogadorId: socket.id,
      jogadorIndex: sala.indiceVez,
      jogador: jogador.apelido,
      time: jogador.time,
      carta: cartaJogada,
      escondida: cartaEscondida
    });

    socket.emit('minhasCartas', {
      cartas: jogador.cartas,
      noEscuro: (sala.pontos.A === 11 && sala.pontos.B === 11)
    });

    io.to(socket.nomeSala).emit('atualizarMesa', sala.jogadasRodadaAtual);

    // Se todos os jogadores já jogaram na rodada atual
    if (sala.jogadasRodadaAtual.length === sala.jogadores.length) {
      setTimeout(() => {
        let maiorForca = -1;
        let vencedorJogada = null;
        let empate = false;

        sala.jogadasRodadaAtual.forEach(j => {
          let f = j.escondida ? 0 : calcularForca(j.carta, sala.valorManilha);
          if (f > maiorForca) {
            maiorForca = f; 
            vencedorJogada = j; 
            empate = false;
          } else if (f === maiorForca) {
            empate = true;
          }
        });

        if (empate) {
          sala.historicoRodadas.push('Empate');
          // Em caso de canga (empate), torna quem começou a rodada anterior
          sala.indiceVez = sala.primeiroDaRodadaAtual;
        } else {
          sala.rodadasGanhas[vencedorJogada.time] += 1;
          sala.historicoRodadas.push(vencedorJogada.time);
          
          // REGRA CORRIGIDA: Quem matou a carta (venceu a rodada) joga primeiro na próxima
          sala.indiceVez = vencedorJogada.jogadorIndex;
          sala.primeiroDaRodadaAtual = vencedorJogada.jogadorIndex;
        }

        io.to(socket.nomeSala).emit('atualizarRodadasMao', sala.historicoRodadas);
        sala.jogadasRodadaAtual = [];
        io.to(socket.nomeSala).emit('atualizarMesa', []);

        const terminouMao = verificarFimMao(socket.nomeSala);
        if (sala.emAndamento && !terminouMao) {
          io.to(socket.nomeSala).emit('atualizarVez', sala.jogadores[sala.indiceVez].apelido);
        }
      }, 1500);
    } else {
      // Passa a vez para o próximo jogador dentro da mesma rodada
      sala.indiceVez = (sala.indiceVez + 1) % sala.jogadores.length;
      io.to(socket.nomeSala).emit('atualizarVez', sala.jogadores[sala.indiceVez].apelido);
    }
  });

  socket.on('pedirTruco', () => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.emAndamento || sala.aguardandoMao11 || sala.trucoPendente) return;

    if (sala.pontos.A === 11 || sala.pontos.B === 11) {
      const timeAdversario = socket.time === 'A' ? 'B' : 'A';
      sala.trofeus[timeAdversario] += 1;
      io.to(socket.nomeSala).emit('atualizarTrofeus', sala.trofeus);
      io.to(socket.nomeSala).emit('fimDePartida', { vencedor: timeAdversario });
      sala.pontos = { A: 0, B: 0 };
      iniciarNovaMao(socket.nomeSala);
      return;
    }

    if (sala.ultimoPediuTime === socket.time) return;

    let proximoValor = 3;
    if (sala.valorMao === 3) proximoValor = 6;
    else if (sala.valorMao === 6) proximoValor = 9;
    else if (sala.valorMao === 9) proximoValor = 12;

    if (sala.valorMao >= 12) return;

    sala.trucoPendente = {
      pediuTime: socket.time,
      pediuApelido: socket.apelido,
      valorProposto: proximoValor
    };

    io.to(socket.nomeSala).emit('solicitacaoTruco', sala.trucoPendente);
  });

  socket.on('respostaTruco', ({ aceitou, aumentar }) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.trucoPendente || socket.time === sala.trucoPendente.pediuTime) return;

    const valorPropostoAtual = sala.trucoPendente.valorProposto;
    const timeQuePediuAnterior = sala.trucoPendente.pediuTime;

    if (aumentar && valorPropostoAtual < 12) {
      let proximoValor = 6;
      if (valorPropostoAtual === 6) proximoValor = 9;
      else if (valorPropostoAtual === 9) proximoValor = 12;

      sala.valorMao = valorPropostoAtual;
      sala.ultimoPediuTime = socket.time;

      sala.trucoPendente = {
        pediuTime: socket.time,
        pediuApelido: socket.apelido,
        valorProposto: proximoValor
      };

      io.to(socket.nomeSala).emit('solicitacaoTruco', sala.trucoPendente);
      return;
    }

    if (aceitou) {
      sala.valorMao = valorPropostoAtual;
      sala.ultimoPediuTime = timeQuePediuAnterior;
      sala.trucoPendente = null;

      io.to(socket.nomeSala).emit('atualizarEstadoTruco', {
        valorMao: sala.valorMao,
        ultimoPediuTime: sala.ultimoPediuTime,
        bloqueado: false
      });
    } else {
      sala.pontos[timeQuePediuAnterior] += sala.valorMao;
      sala.trucoPendente = null;

      if (sala.pontos.A >= 12 || sala.pontos.B >= 12) {
        const venceu = sala.pontos.A >= 12 ? 'A' : 'B';
        sala.trofeus[venceu] += 1;
        io.to(socket.nomeSala).emit('atualizarTrofeus', sala.trofeus);
        io.to(socket.nomeSala).emit('fimDePartida', { vencedor: venceu });
        sala.pontos = { A: 0, B: 0 };
      }

      iniciarNovaMao(socket.nomeSala);
    }
  });

  socket.on('destruirSalaForcado', () => {
    if (socket.nomeSala && salas[socket.nomeSala]) {
      io.to(socket.nomeSala).emit('salaDestruida', 'A sala foi encerrada.');
      delete salas[socket.nomeSala];
    }
  });

  socket.on('disconnect', () => {
    if (socket.nomeSala && salas[socket.nomeSala]) {
      const sala = salas[socket.nomeSala];
      const j = sala.jogadores.find(x => x.id === socket.id);
      if (j) {
        j.online = false;
        socket.to(socket.nomeSala).emit('jogadorDesconectado', { apelido: j.apelido });
      }
      if (!sala.jogadores.some(x => x.online)) delete salas[socket.nomeSala];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
