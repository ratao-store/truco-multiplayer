const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Estrutura das salas de jogo
const salas = {};

// Baralho de Truco Paulista (Sem 8, 9, 10)
const NAIPES = ['♣', '♥', '♠', '♦'];
const VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

// Força da carta padrão
const FORCA_CARTA = {
  '4': 1, '5': 2, '6': 3, '7': 4,
  'Q': 5, 'J': 6, 'K': 7, 'A': 8,
  '2': 9, '3': 10
};

// Ordem dos naipes para manilhas (Manilha Velha / Paulista)
// ♣ Zap > ♥ Copas > ♠ Espadilha > ♦ Ouros
const FORCA_NAIPE = {
  '♣': 4,
  '♥': 3,
  '♠': 2,
  '♦': 1
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
  sala.jogadasRodadaAtual = [];
  sala.rodadasGanhas = { A: 0, B: 0 };
  sala.historicoRodadas = [];

  // Distribui 3 cartas para cada jogador
  sala.jogadores.forEach(j => {
    j.cartas = [sala.baralho.pop(), sala.baralho.pop(), sala.baralho.pop()];
  });

  // Define quem começa jogando a mão
  if (sala.indiceIniciadorMao === undefined) {
    sala.indiceIniciadorMao = 0;
  } else {
    sala.indiceIniciadorMao = (sala.indiceIniciadorMao + 1) % sala.jogadores.length;
  }
  sala.indiceVez = sala.indiceIniciadorMao;

  // Notifica os clientes
  sala.jogadores.forEach(j => {
    io.to(j.id).emit('minhasCartas', j.cartas);
  });

  io.to(nomeSala).emit('novaMao', {
    vira: sala.vira,
    valorMao: sala.valorMao,
    pontosA: sala.pontos.A,
    pontosB: sala.pontos.B,
    vez: sala.jogadores[sala.indiceVez].apelido
  });

  io.to(nomeSala).emit('atualizarMesa', []);
}

function verificarFimMao(nomeSala) {
  const sala = salas[nomeSala];

  let timeVencedorMao = null;

  if (sala.rodadasGanhas.A >= 2) timeVencedorMao = 'A';
  else if (sala.rodadasGanhas.B >= 2) timeVencedorMao = 'B';
  else if (sala.historicoRodadas.length === 3) {
    // Caso de empate nas rodadas
    const ganhoA = sala.historicoRodadas.filter(r => r === 'A').length;
    const ganhoB = sala.historicoRodadas.filter(r => r === 'B').length;
    if (ganhoA > ganhoB) timeVencedorMao = 'A';
    else if (ganhoB > ganhoA) timeVencedorMao = 'B';
    else timeVencedorMao = sala.historicoRodadas[0] !== 'Empate' ? sala.historicoRodadas[0] : 'A';
  }

  if (timeVencedorMao) {
    sala.pontos[timeVencedorMao] += sala.valorMao;

    if (sala.pontos[timeVencedorMao] >= 12) {
      // Time ganhou a partida
      sala.trofeus[timeVencedorMao] += 1;
      io.to(nomeSala).emit('atualizarTrofeus', sala.trofeus);
      io.to(nomeSala).emit('fimDePartida', { vencedor: timeVencedorMao });

      // Reinicia placar da partida
      sala.pontos = { A: 0, B: 0 };
    }

    iniciarNovaMao(nomeSala);
  }
}

io.on('connection', (socket) => {

  // Criar Sala
  socket.on('criarSala', ({ apelido, nomeSala, maxJogadores }) => {
    if (salas[nomeSala]) {
      socket.emit('erroEntrada', 'A sala já existe! Escolha outro nome ou entre nela.');
      return;
    }

    salas[nomeSala] = {
      maxJogadores: parseInt(maxJogadores) || 4,
      jogadores: [],
      pontos: { A: 0, B: 0 },
      trofeus: { A: 0, B: 0 },
      emAndamento: false,
      valorMao: 1
    };

    entrarNaSala(socket, apelido, nomeSala);
  });

  // Entrar na Sala
  socket.on('entrarSala', ({ apelido, nomeSala }) => {
    if (!salas[nomeSala]) {
      socket.emit('erroEntrada', 'Sala não encontrada!');
      return;
    }

    if (salas[nomeSala].jogadores.length >= salas[nomeSala].maxJogadores) {
      socket.emit('erroEntrada', 'A sala está cheia!');
      return;
    }

    entrarNaSala(socket, apelido, nomeSala);
  });

  function entrarNaSala(socket, apelido, nomeSala) {
    const sala = salas[nomeSala];
    
    // Define o time (A ou B alternadamente)
    const time = sala.jogadores.length % 2 === 0 ? 'A' : 'B';

    socket.join(nomeSala);
    socket.nomeSala = nomeSala;
    socket.apelido = apelido;
    socket.time = time;

    sala.jogadores.push({
      id: socket.id,
      apelido,
      time,
      cartas: []
    });

    socket.emit('sucessoEntrada', { apelido, time, nomeSala });
    io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);

    // Se preencheu a sala, inicia a partida
    if (sala.jogadores.length === sala.maxJogadores && !sala.emAndamento) {
      sala.emAndamento = true;
      iniciarNovaMao(nomeSala);
    }
  }

  // Ação de Jogar Carta
  socket.on('jogarCarta', (indiceCarta) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.emAndamento) return;

    const jogadorDaVez = sala.jogadores[sala.indiceVez];
    if (jogadorDaVez.id !== socket.id) return;

    const jogador = sala.jogadores.find(j => j.id === socket.id);
    if (!jogador || !jogador.cartas[indiceCarta]) return;

    const cartaJogada = jogador.cartas.splice(indiceCarta, 1)[0];
    sala.jogadasRodadaAtual.push({
      jogador: jogador.apelido,
      time: jogador.time,
      carta: cartaJogada
    });

    socket.emit('minhasCartas', jogador.cartas);
    io.to(socket.nomeSala).emit('atualizarMesa', sala.jogadasRodadaAtual);

    // Passa a vez para o próximo jogador
    sala.indiceVez = (sala.indiceVez + 1) % sala.jogadores.length;

    // Se todos da rodada já jogaram carta
    if (sala.jogadasRodadaAtual.length === sala.jogadores.length) {
      setTimeout(() => {
        let maiorForca = -1;
        let vencedorJogada = null;
        let empate = false;

        sala.jogadasRodadaAtual.forEach(j => {
          const f = calcularForca(j.carta, sala.valorManilha);
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

  // Ação de Pedir Truco / Seis / Nove / Doze
  socket.on('pedirTruco', () => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.emAndamento) return;

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

  // Resposta ao Truco (Aceitar ou Correr)
  socket.on('respostaTruco', (aceitou) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.trucoPendente) return;

    const timeAdversario = sala.trucoPendente.pediuTime === 'A' ? 'B' : 'A';

    if (aceitou) {
      sala.valorMao = sala.trucoPendente.valorProposto;
      io.to(socket.nomeSala).emit('trucoAceito', { valorMao: sala.valorMao });
      sala.trucoPendente = null;
    } else {
      // Se fugiu/correu, o time que pediu ganha os pontos atuais
      sala.pontos[sala.trucoPendente.pediuTime] += sala.valorMao;
      sala.trucoPendente = null;
      verificarFimMao(socket.nomeSala);
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    if (socket.nomeSala && salas[socket.nomeSala]) {
      const sala = salas[socket.nomeSala];
      sala.jogadores = sala.jogadores.filter(j => j.id !== socket.id);

      if (sala.jogadores.length === 0) {
        delete salas[socket.nomeSala];
      } else {
        io.to(socket.nomeSala).emit('atualizarJogadores', sala.jogadores);
        io.to(socket.nomeSala).emit('atualizarVez', 'Aguardando jogadores...');
        sala.emAndamento = false;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
