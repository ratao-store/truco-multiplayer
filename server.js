const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const NAIPES = ['♦', '♠', '♥', '♣'];
const VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

function criarBaralho() {
  let baralho = [];
  for (let n of NAIPES) {
    for (let v of VALORES) {
      baralho.push({ naipe: n, valor: v });
    }
  }
  return baralho.sort(() => Math.random() - 0.5);
}

// Ordem de força no Truco Paulista
const FORCA_VALORES = { '4': 1, '5': 2, '6': 3, '7': 4, 'Q': 5, 'J': 6, 'K': 7, 'A': 8, '2': 9, '3': 10 };
const FORCA_NAIPES = { '♦': 1, '♠': 2, '♥': 3, '♣': 4 };

let jogadores = [];
let gameState = {
  emAndamento: false,
  pontosA: 0,
  pontosB: 0,
  valorMao: 1,
  vira: null,
  manilhaValor: null,
  rodadasVencidas: { A: 0, B: 0 },
  historicoRodadas: [],
  cartasMesa: [],
  vezIndex: 0,
  maoIndex: 0
};

io.on('connection', (socket) => {
  if (jogadores.length >= 4) {
    socket.emit('erro', 'A mesa já está cheia (máximo 4 jogadores).');
    return;
  }

  const apelido = 'Jogador_' + Math.floor(1000 + Math.random() * 9000);
  const time = jogadores.length % 2 === 0 ? 'A' : 'B';
  const jogador = { id: socket.id, apelido, time, cartas: [] };
  jogadores.push(jogador);

  socket.emit('infoJogador', { apelido, time });
  io.emit('atualizarJogadores', jogadores);

  if (jogadores.length === 4 && !gameState.emAndamento) {
    iniciarJogo();
  }

  socket.on('jogarCarta', (indexCarta) => {
    if (!gameState.emAndamento) return;
    const jogadorAtual = jogadores[gameState.vezIndex];
    if (jogadorAtual.id !== socket.id) return;

    const cartaJogada = jogadorAtual.cartas.splice(indexCarta, 1)[0];
    gameState.cartasMesa.push({ jogador: jogadorAtual, carta: cartaJogada });

    io.emit('atualizarMesa', gameState.cartasMesa);
    socket.emit('minhasCartas', jogadorAtual.cartas);

    if (gameState.cartasMesa.length === 4) {
      setTimeout(processarFimDeRodada, 1500);
    } else {
      gameState.vezIndex = (gameState.vezIndex + 1) % 4;
      io.emit('atualizarVez', jogadores[gameState.vezIndex].apelido);
    }
  });

  socket.on('disconnect', () => {
    jogadores = jogadores.filter(j => j.id !== socket.id);
    gameState.emAndamento = false;
    io.emit('atualizarJogadores', jogadores);
    io.emit('jogoInterrompido');
  });
});

function iniciarJogo() {
  gameState.pontosA = 0;
  gameState.pontosB = 0;
  gameState.emAndamento = true;
  gameState.maoIndex = 0;
  iniciarNovaMao();
}

function iniciarNovaMao() {
  const baralho = criarBaralho();
  gameState.valorMao = 1;
  gameState.rodadasVencidas = { A: 0, B: 0 };
  gameState.historicoRodadas = [];
  gameState.cartasMesa = [];

  gameState.vira = baralho.pop();
  let idx = VALORES.indexOf(gameState.vira.valor);
  gameState.manilhaValor = VALORES[(idx + 1) % VALORES.length];

  jogadores.forEach(j => {
    j.cartas = [baralho.pop(), baralho.pop(), baralho.pop()];
    io.to(j.id).emit('minhasCartas', j.cartas);
  });

  gameState.vezIndex = gameState.maoIndex % 4;
  io.emit('novaMao', {
    vira: gameState.vira,
    pontosA: gameState.pontosA,
    pontosB: gameState.pontosB,
    vez: jogadores[gameState.vezIndex].apelido
  });
}

function calcularForca(carta) {
  if (carta.valor === gameState.manilhaValor) {
    return 100 + FORCA_NAIPES[carta.naipe];
  }
  return FORCA_VALORES[carta.valor];
}

function processarFimDeRodada() {
  let maiorForca = -1;
  let vencedor = null;
  let empate = false;

  gameState.cartasMesa.forEach(item => {
    let forca = calcularForca(item.carta);
    if (forca > maiorForca) {
      maiorForca = forca;
      vencedor = item.jogador;
      empate = false;
    } else if (forca === maiorForca) {
      empate = true;
    }
  });

  let timeGanhadorRodada = empate ? 'empate' : vencedor.time;
  gameState.historicoRodadas.push(timeGanhadorRodada);

  if (!empate) {
    gameState.rodadasVencidas[timeGanhadorRodada]++;
    gameState.vezIndex = jogadores.findIndex(j => j.id === vencedor.id);
  }

  gameState.cartasMesa = [];
  io.emit('atualizarMesa', []);

  let ganhadorMao = verificarGanhadorMao();

  if (ganhadorMao) {
    if (ganhadorMao === 'A') gameState.pontosA += gameState.valorMao;
    if (ganhadorMao === 'B') gameState.pontosB += gameState.valorMao;

    if (gameState.pontosA >= 12 || gameState.pontosB >= 12) {
      io.emit('fimDeJogo', { vencedor: gameState.pontosA >= 12 ? 'Time A' : 'Time B' });
      gameState.emAndamento = false;
    } else {
      gameState.maoIndex++;
      iniciarNovaMao();
    }
  } else {
    io.emit('atualizarVez', jogadores[gameState.vezIndex].apelido);
  }
}

function verificarGanhadorMao() {
  const h = gameState.historicoRodadas;
  const vA = gameState.rodadasVencidas.A;
  const vB = gameState.rodadasVencidas.B;

  if (vA === 2) return 'A';
  if (vB === 2) return 'B';

  if (h.length === 2 && h[0] === 'empate' && h[1] !== 'empate') return h[1];
  if (h.length === 2 && h[1] === 'empate' && h[0] !== 'empate') return h[0];
  if (h.length === 3 && h[2] === 'empate') return h[0] !== 'empate' ? h[0] : 'A';

  return null;
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
