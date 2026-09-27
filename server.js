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

const FORCA_NAIPE = {
  '♣': 4, // ZAP
  '♥': 3, // COPAS
  '♠': 2, // ESPADAS
  '♦': 1  // OUROS
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
  sala.ultimoPediuTime = null; // Zera o controle de quem pediu Truco
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
  sala.indiceVez = sala.indiceIniciadorMao;

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
    const timeNaMao11 = pA === 11 ? 'A' : 'B';
    sala.timeNaMao11 = timeNaMao11;

    io.to(nomeSala).emit('decisaoMao11Pendente', { timeNaMao11 });
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
  }
}

io.on('connection', (socket) => {

  socket.on('criarSala', ({ apelido, nomeSala, maxJogadores }) => {
    if (salas[nomeSala]) {
      socket.emit('erroEntrada', 'A sala já existe! Escolha outro nome.');
      return;
    }

    salas[nomeSala] = {
      maxJogadores: parseInt(maxJogadores) || 4,
      jogadores: [],
      pontos: { A: 0, B: 0 },
      trofeus: { A: 0, B: 0 },
      emAndamento: false,
      valorMao: 1,
      ultimoPediuTime: null
    };

    entrarNaSala(socket, apelido, nomeSala);
  });

  socket.on('entrarSala', ({ apelido, nomeSala }) => {
    const sala = salas[nomeSala];

    if (!sala) {
      socket.emit('erroEntrada', 'Sala não encontrada!');
      return;
    }

    const jogadorExistente = sala.jogadores.find(j => j.apelido.toLowerCase() === apelido.toLowerCase());

    if (jogadorExistente) {
      if (jogadorExistente.online) {
        socket.emit('erroEntrada', 'Este apelido já está jogando na sala!');
        return;
      }

      jogadorExistente.id = socket.id;
      jogadorExistente.online = true;

      socket.join(nomeSala);
      socket.nomeSala = nomeSala;
      socket.apelido = jogadorExistente.apelido;
      socket.time = jogadorExistente.time;

      socket.emit('sucessoEntrada', { apelido: jogadorExistente.apelido, time: jogadorExistente.time, nomeSala });
      io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);

      const pA = sala.pontos.A;
      const pB = sala.pontos.B;
      const maoDeFerro = (pA === 11 && pB === 11);
      const isMaoDe11 = (pA === 11 || pB === 11) && !maoDeFerro;

      socket.emit('minhasCartas', { cartas: jogadorExistente.cartas, noEscuro: maoDeFerro });
      
      io.to(nomeSala).emit('novaMao', {
        vira: sala.vira,
        valorMao: sala.valorMao,
        pontosA: pA,
        pontosB: pB,
        vez: sala.jogadores[sala.indiceVez].apelido,
        maoDeFerro,
        isMaoDe11
      });

      return;
    }

    const jogandoOnline = sala.jogadores.filter(j => j.online).length;
    if (sala.jogadores.length >= sala.maxJogadores && jogandoOnline === sala.maxJogadores) {
      socket.emit('erroEntrada', 'A sala está cheia!');
      return;
    }

    const desfalque = sala.jogadores.find(j => !j.online);
    if (desfalque) {
      socket.emit('erroEntrada', `Esta sala está aguardando a reconexão de (${desfalque.apelido}). Digite o mesmo nome caso seja você!`);
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

    sala.jogadores.push({
      id: socket.id,
      apelido,
      time,
      cartas: [],
      online: true
    });

    socket.emit('sucessoEntrada', { apelido, time, nomeSala });
    io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);

    if (sala.jogadores.length === sala.maxJogadores && !sala.emAndamento) {
      sala.emAndamento = true;
      iniciarNovaMao(nomeSala);
    }
  }

  // RESPOSTA DECISÃO DA MÃO DE 11
  socket.on('respostaMao11', (aceitou) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.aguardandoMao11) return;

    if (socket.time !== sala.timeNaMao11) return;

    sala.aguardandoMao11 = false;

    if (aceitou) {
      io.to(socket.nomeSala).emit('atualizarVez', sala.jogadores[sala.indiceVez].apelido);
    } else {
      const timeAdversario = sala.timeNaMao11 === 'A' ? 'B' : 'A';
      sala.pontos[timeAdversario] += 1;

      if (sala.pontos[timeAdversario] >= 12) {
        sala.trofeus[timeAdversario] += 1;
        io.to(socket.nomeSala).emit('atualizarTrofeus', sala.trofeus);
        io.to(socket.nomeSala).emit('fimDePartida', { vencedor: timeAdversario });
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
      io.to(socket.nomeSala).emit('efeitoManilhaZap', {
        carta: cartaJogada,
        isZap,
        jogador: jogador.apelido
      });
    }

    sala.jogadasRodadaAtual.push({
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

    sala.indiceVez = (sala.indiceVez + 1) % sala.jogadores.length;

    if (sala.jogadasRodadaAtual.length === sala.jogadores.length) {
      setTimeout(() => {
        let maiorForca = -1;
        let vencedorJogada = null;
        let empate = false;

        sala.jogadasRodadaAtual.forEach(j => {
          let f = 0;
          if (!j.escondida) {
            f = calcularForca(j.carta, sala.valorManilha);
          }

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
        } else {
          sala.rodadasGanhas[vencedorJogada.time] += 1;
          sala.historicoRodadas.push(vencedorJogada.time);
        }

        io.to(socket.nomeSala).emit('atualizarRodadasMao', sala.historicoRodadas);

        sala.jogadasRodadaAtual = [];
        io.to(socket.nomeSala).emit('atualizarMesa', []);

        verificarFimMao(socket.nomeSala);

        if (sala.emAndamento) {
          io.to(socket.nomeSala).emit('atualizarVez', sala.jogadores[sala.indiceVez].apelido);
        }
      }, 1500);
    } else {
      io.to(socket.nomeSala).emit('atualizarVez', sala.jogadores[sala.indiceVez].apelido);
    }
  });

  // SOLICITAÇÃO DE TRUCO / SEIS / NOVE / 12
  socket.on('pedirTruco', () => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.emAndamento || sala.aguardandoMao11 || sala.trucoPendente) return;

    if (sala.pontos.A === 11 || sala.pontos.B === 11) return;

    // TRAVA DE SEGURANÇA: Impede que a mesma dupla peça aumento em sequência
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

  // RESPOSTA AO TRUCO / AUMENTO
  socket.on('respostaTruco', ({ aceitou, aumentar }) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.trucoPendente) return;

    // Quem está respondendo tem que ser do time adversário de quem pediu
    if (socket.time === sala.trucoPendente.pediuTime) return;

    const valorPropostoAtual = sala.trucoPendente.valorProposto;
    const timeQuePediuAnterior = sala.trucoPendente.pediuTime;

    if (aumentar && valorPropostoAtual < 12) {
      // Re-aumentar imediatamente (ex: oponente pediu Truco e você respondeu pedindo 6)
      let proximoValor = 6;
      if (valorPropostoAtual === 6) proximoValor = 9;
      else if (valorPropostoAtual === 9) proximoValor = 12;

      sala.valorMao = valorPropostoAtual;
      sala.ultimoPediuTime = socket.time; // O direito do pedido muda para o jogador atual

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
      sala.ultimoPediuTime = timeQuePediuAnterior; // Registra quem foi a dupla que fez o último pedido aceito
      sala.trucoPendente = null;

      io.to(socket.nomeSala).emit('trucoAceito', { valorMao: sala.valorMao });
      
      // Atualiza os botões para todos na sala (bloqueando a dupla que acabou de pedir)
      io.to(socket.nomeSala).emit('atualizarEstadoTruco', {
        valorMao: sala.valorMao,
        ultimoPediuTime: sala.ultimoPediuTime,
        bloqueado: false
      });
    } else {
      // Se correu/fugiu do pedido, o time que pediu ganha o valor atual acumulado
      sala.pontos[timeQuePediuAnterior] += sala.valorMao;
      sala.trucoPendente = null;

      if (sala.pontos['A'] >= 12 || sala.pontos['B'] >= 12) {
        const venceu = sala.pontos['A'] >= 12 ? 'A' : 'B';
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
      io.to(socket.nomeSala).emit('salaDestruida', 'A sala foi destruída a pedido de um jogador.');
      delete salas[socket.nomeSala];
    }
  });

  socket.on('disconnect', () => {
    if (socket.nomeSala && salas[socket.nomeSala]) {
      const sala = salas[socket.nomeSala];
      const jogador = sala.jogadores.find(j => j.id === socket.id);

      if (jogador) {
        jogador.online = false;
        socket.to(socket.nomeSala).emit('jogadorDesconectado', {
          apelido: jogador.apelido
        });
      }

      const restamOnline = sala.jogadores.some(j => j.online);
      if (!restamOnline) {
        delete salas[socket.nomeSala];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
