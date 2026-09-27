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

const FORCA_VALORES = { '4': 1, '5': 2, '6': 3, '7': 4, 'Q': 5, 'J': 6, 'K': 7, 'A': 8, '2': 9, '3': 10 };
const FORCA_NAIPES = { '♦': 1, '♠': 2, '♥': 3, '♣': 4 };

let salas = {};

io.on('connection', (socket) => {

  // Criar Sala
  socket.on('criarSala', ({ apelido, nomeSala, maxJogadores }) => {
    nomeSala = nomeSala.trim().toLowerCase();
    
    if (salas[nomeSala]) {
      socket.emit('erroEntrada', 'Essa sala já existe! Escolha outro nome ou entre nela.');
      return;
    }

    salas[nomeSala] = {
      nome: nomeSala,
      maxJogadores: parseInt(maxJogadores) || 4,
      jogadores: [],
      vistoriasA: 0,
      vistoriasB: 0,
      gameState: resetGameState()
    };

    entrarNaSala(socket, apelido, nomeSala);
  });

  // Entrar em Sala
  socket.on('entrarSala', ({ apelido, nomeSala }) => {
    nomeSala = nomeSala.trim().toLowerCase();

    if (!salas[nomeSala]) {
      socket.emit('erroEntrada', 'Sala não encontrada! Verifique o nome ou crie uma nova.');
      return;
    }

    if (salas[nomeSala].jogadores.length >= salas[nomeSala].maxJogadores) {
      socket.emit('erroEntrada', 'A sala está cheia!');
      return;
    }

    entrarNaSala(socket, apelido, nomeSala);
  });

  // Lógica do Truco
  socket.on('pedirTruco', () => {
    const nomeSala = socket.nomeSala;
    if (!nomeSala || !salas[nomeSala]) return;
    const sala = salas[nomeSala];
    const gs = sala.gameState;

    if (!gs.emAndamento || gs.trucoPendente) return;

    const jogador = sala.jogadores.find(j => j.id === socket.id);
    if (!jogador) return;

    // Não pode pedir se o seu próprio time pediu a última aposta
    if (gs.ultimoTimeApostou === jogador.time) return;

    let proximoValor = 3;
    if (gs.valorMao === 1) proximoValor = 3;
    else if (gs.valorMao === 3) proximoValor = 6;
    else if (gs.valorMao === 6) proximoValor = 9;
    else if (gs.valorMao === 9) proximoValor = 12;

    if (proximoValor > 12) return;

    gs.trucoPendente = {
      pediuTime: jogador.time,
      pediuApelido: jogador.apelido,
      valorProposto: proximoValor
    };

    io.to(nomeSala).emit('solicitacaoTruco', gs.trucoPendente);
  });

  socket.on('respostaTruco', (aceitou) => {
    const nomeSala = socket.nomeSala;
    if (!nomeSala || !salas[nomeSala]) return;
    const sala = salas[nomeSala];
    const gs = sala.gameState;

    if (!gs.trucoPendente) return;

    const jogador = sala.jogadores.find(j => j.id === socket.id);
    if (!jogador || jogador.time === gs.trucoPendente.pediuTime) return;

    const { pediuTime, valorProposto } = gs.trucoPendente;
    gs.trucoPendente = null;

    if (aceitou) {
      gs.valorMao = valorProposto;
      gs.ultimoTimeApostou = jogador.time;
      io.to(nomeSala).emit('trucoAceito', { valorMao: gs.valorMao, timeRespondera: jogador.time });
    } else {
      // Time correu: dá os pontos acumulados até então para o time que pediu
      let pontosGanhos = gs.valorMao;
      finalizarMao(nomeSala, pediuTime, pontosGanhos);
    }
  });

  socket.on('jogarCarta', (indexCarta) => {
    const nomeSala = socket.nomeSala;
    if (!nomeSala || !salas[nomeSala]) return;
    const sala = salas[nomeSala];
    const gs = sala.gameState;

    if (!gs.emAndamento || gs.trucoPendente) return;
    const jogadorAtual = sala.jogadores[gs.vezIndex];
    if (!jogadorAtual || jogadorAtual.id !== socket.id) return;

    if (indexCarta < 0 || indexCarta >= jogadorAtual.cartas.length) return;

    const cartaJogada = jogadorAtual.cartas.splice(indexCarta, 1)[0];
    gs.cartasMesa.push({ jogador: jogadorAtual, carta: cartaJogada });

    io.to(nomeSala).emit('atualizarMesa', gs.cartasMesa);
    socket.emit('minhasCartas', jogadorAtual.cartas);

    if (gs.cartasMesa.length === sala.jogadores.length) {
      setTimeout(() => processarFimDeRodada(nomeSala), 1200);
    } else {
      gs.vezIndex = (gs.vezIndex + 1) % sala.jogadores.length;
      io.to(nomeSala).emit('atualizarVez', sala.jogadores[gs.vezIndex].apelido);
    }
  });

  socket.on('disconnect', () => {
    const nomeSala = socket.nomeSala;
    if (nomeSala && salas[nomeSala]) {
      let sala = salas[nomeSala];
      sala.jogadores = sala.jogadores.filter(j => j.id !== socket.id);
      sala.gameState.emAndamento = false;

      if (sala.jogadores.length === 0) {
        delete salas[nomeSala];
      } else {
        io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);
        io.to(nomeSala).emit('atualizarVez', 'Jogador desconectou.');
      }
    }
  });
});

function entrarNaSala(socket, apelido, nomeSala) {
  const sala = salas[nomeSala];
  const time = sala.jogadores.length % 2 === 0 ? 'A' : 'B';
  const jogador = { id: socket.id, apelido, time, cartas: [] };
  
  sala.jogadores.push(jogador);
  socket.join(nomeSala);
  socket.nomeSala = nomeSala;

  socket.emit('sucessoEntrada', { apelido, time, nomeSala });
  io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);
  io.to(nomeSala).emit('atualizarTrofeus', { a: sala.vistoriasA, b: sala.vistoriasB });

  if (sala.jogadores.length === sala.maxJogadores && !sala.gameState.emAndamento) {
    iniciarJogo(nomeSala);
  } else {
    io.to(nomeSala).emit('atualizarVez', `Aguardando (${sala.jogadores.length}/${sala.maxJogadores})...`);
  }
}

function resetGameState() {
  return {
    emAndamento: false,
    pontosA: 0,
    pontosB: 0,
    valorMao: 1,
    ultimoTimeApostou: null,
    trucoPendente: null,
    vira: null,
    manilhaValor: null,
    rodadasVencidas: { A: 0, B: 0 },
    historicoRodadas: [],
    cartasMesa: [],
    vezIndex: 0,
    maoIndex: 0
  };
}

function iniciarJogo(nomeSala) {
  let sala = salas[nomeSala];
  if (!sala) return;

  sala.gameState.pontosA = 0;
  sala.gameState.pontosB = 0;
  sala.gameState.emAndamento = true;
  sala.gameState.maoIndex = 0;
  iniciarNovaMao(nomeSala);
}

function iniciarNovaMao(nomeSala) {
  let sala = salas[nomeSala];
  if (!sala || sala.jogadores.length < sala.maxJogadores) return;

  const gs = sala.gameState;
  const baralho = criarBaralho();

  gs.valorMao = 1;
  gs.ultimoTimeApostou = null;
  gs.trucoPendente = null;
  gs.rodadasVencidas = { A: 0, B: 0 };
  gs.historicoRodadas = [];
  gs.cartasMesa = [];

  gs.vira = baralho.pop();
  let idx = VALORES.indexOf(gs.vira.valor);
  gs.manilhaValor = VALORES[(idx + 1) % VALORES.length];

  sala.jogadores.forEach(j => {
    j.cartas = [baralho.pop(), baralho.pop(), baralho.pop()];
    io.to(j.id).emit('minhasCartas', j.cartas);
  });

  gs.vezIndex = gs.maoIndex % sala.jogadores.length;
  io.to(nomeSala).emit('novaMao', {
    vira: gs.vira,
    pontosA: gs.pontosA,
    pontosB: gs.pontosB,
    valorMao: gs.valorMao,
    vez: sala.jogadores[gs.vezIndex].apelido
  });
}

function calcularForca(carta, manilha) {
  if (carta.valor === manilha) {
    return 100 + FORCA_NAIPES[carta.naipe];
  }
  return FORCA_VALORES[carta.valor];
}

function processarFimDeRodada(nomeSala) {
  let sala = salas[nomeSala];
  if (!sala) return;
  let gs = sala.gameState;

  let maiorForca = -1;
  let vencedor = null;
  let empate = false;

  gs.cartasMesa.forEach(item => {
    let forca = calcularForca(item.carta, gs.manilhaValor);
    if (forca > maiorForca) {
      maiorForca = forca;
      vencedor = item.jogador;
      empate = false;
    } else if (forca === maiorForca) {
      empate = true;
    }
  });

  let timeGanhador = empate ? 'empate' : vencedor.time;
  gs.historicoRodadas.push(timeGanhador);

  if (!empate) {
    gs.rodadasVencidas[timeGanhador]++;
    gs.vezIndex = sala.jogadores.findIndex(j => j.id === vencedor.id);
  }

  gs.cartasMesa = [];
  io.to(nomeSala).emit('atualizarMesa', []);

  let ganhadorMao = verificarGanhadorMao(gs.historicoRodadas, gs.rodadasVencidas);

  if (ganhadorMao) {
    finalizarMao(nomeSala, ganhadorMao, gs.valorMao);
  } else {
    io.to(nomeSala).emit('atualizarVez', sala.jogadores[gs.vezIndex].apelido);
  }
}

function finalizarMao(nomeSala, timeGanhador, pontos) {
  let sala = salas[nomeSala];
  let gs = sala.gameState;

  if (timeGanhador === 'A') gs.pontosA += pontos;
  if (timeGanhador === 'B') gs.pontosB += pontos;

  if (gs.pontosA >= 12 || gs.pontosB >= 12) {
    let vencedorFinal = gs.pontosA >= 12 ? 'A' : 'B';
    if (vencedorFinal === 'A') sala.vistoriasA++;
    else sala.vistoriasB++;

    const nomesVencedores = sala.jogadores.filter(j => j.time === vencedorFinal).map(j => j.apelido).join(' e ');

    io.to(nomeSala).emit('atualizarTrofeus', { a: sala.vistoriasA, b: sala.vistoriasB });
    io.to(nomeSala).emit('fimDePartida', { vencedor: nomesVencedores });

    // Reinicia a partida do zero na mesma sala mantendo o troféu
    setTimeout(() => {
      iniciarJogo(nomeSala);
    }, 3000);

  } else {
    gs.maoIndex++;
    iniciarNovaMao(nomeSala);
  }
}

function verificarGanhadorMao(historico, v) {
  if (v.A === 2) return 'A';
  if (v.B === 2) return 'B';

  if (historico.length === 2 && historico[0] === 'empate' && historico[1] !== 'empate') return historico[1];
  if (historico.length === 2 && historico[1] === 'empate' && historico[0] !== 'empate') return historico[0];
  if (historico.length === 3 && historico[2] === 'empate') return historico[0] !== 'empate' ? historico[0] : 'A';

  return null;
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
