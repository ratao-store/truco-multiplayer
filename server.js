const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const BARALHO_BASE = [
  { naipe: '♦ Ouros', valor: '4', peso: 1 }, { naipe: '♠ Espadas', valor: '4', peso: 1 }, { naipe: '♥ Copas', valor: '4', peso: 1 }, { naipe: '♣ Paus', valor: '4', peso: 1 },
  { naipe: '♦ Ouros', valor: '5', peso: 2 }, { naipe: '♠ Espadas', valor: '5', peso: 2 }, { naipe: '♥ Copas', valor: '5', peso: 2 }, { naipe: '♣ Paus', valor: '5', peso: 2 },
  { naipe: '♦ Ouros', valor: '6', peso: 3 }, { naipe: '♠ Espadas', valor: '6', peso: 3 }, { naipe: '♥ Copas', valor: '6', peso: 3 }, { naipe: '♣ Paus', valor: '6', peso: 3 },
  { naipe: '♦ Ouros', valor: '7', peso: 4 }, { naipe: '♠ Espadas', valor: '7', peso: 4 }, { naipe: '♥ Copas', valor: '7', peso: 4 }, { naipe: '♣ Paus', valor: '7', peso: 4 },
  { naipe: '♦ Ouros', valor: 'Q', peso: 5 }, { naipe: '♠ Espadas', valor: 'Q', peso: 5 }, { naipe: '♥ Copas', valor: 'Q', peso: 5 }, { naipe: '♣ Paus', valor: 'Q', peso: 5 },
  { naipe: '♦ Ouros', valor: 'J', peso: 6 }, { naipe: '♠ Espadas', valor: 'J', peso: 6 }, { naipe: '♥ Copas', valor: 'J', peso: 6 }, { naipe: '♣ Paus', valor: 'J', peso: 6 },
  { naipe: '♦ Ouros', valor: 'K', peso: 7 }, { naipe: '♠ Espadas', valor: 'K', peso: 7 }, { naipe: '♥ Copas', valor: 'K', peso: 7 }, { naipe: '♣ Paus', valor: 'K', peso: 7 },
  { naipe: '♦ Ouros', valor: 'A', peso: 8 }, { naipe: '♠ Espadas', valor: 'A', peso: 8 }, { naipe: '♥ Copas', valor: 'A', peso: 8 }, { naipe: '♣ Paus', valor: 'A', peso: 8 },
  { naipe: '♦ Ouros', valor: '2', peso: 9 }, { naipe: '♠ Espadas', valor: '2', peso: 9 }, { naipe: '♥ Copas', valor: '2', peso: 9 }, { naipe: '♣ Paus', valor: '2', peso: 9 },
  { naipe: '♦ Ouros', valor: '3', peso: 10 }, { naipe: '♠ Espadas', valor: '3', peso: 10 }, { naipe: '♥ Copas', valor: '3', peso: 10 }, { naipe: '♣ Paus', valor: '3', peso: 10 }
];

let salas = {};

function embaralhar(baralho) {
  let b = [...baralho];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

io.on('connection', (socket) => {
  socket.on('entrarSala', ({ nomeJogador, idSala, maxJogadores }) => {
    socket.join(idSala);

    if (!salas[idSala]) {
      salas[idSala] = {
        id: idSala,
        maxJogadores: parseInt(maxJogadores) || 2,
        jogadores: [],
        pontos: { nos: 0, eles: 0 },
        valorRodada: 1,
        estado: 'aguardando',
        cartasNaMesa: [],
        turno: 0
      };
    }

    const sala = salas[idSala];

    if (sala.jogadores.length < sala.maxJogadores) {
      const time = (sala.jogadores.length % 2 === 0) ? 'nos' : 'eles';
      sala.jogadores.push({
        id: socket.id,
        nome: nomeJogador || `Jogador ${sala.jogadores.length + 1}`,
        time: time,
        mao: []
      });

      io.to(idSala).emit('atualizarPlacar', sala.pontos);

      if (sala.jogadores.length === sala.maxJogadores) {
        iniciarNovaRodada(idSala);
      } else {
        io.to(idSala).emit('mensagemStatus', `Aguardando mais jogadores (${sala.jogadores.length}/${sala.maxJogadores})...`);
      }
    } else {
      socket.emit('erro', 'Esta sala já está cheia!');
    }
  });

  socket.on('jogarCarta', ({ idSala, indexCarta }) => {
    const sala = salas[idSala];
    if (!sala || sala.estado !== 'jogando') return;

    const jogadorAtual = sala.jogadores[sala.turno];
    if (jogadorAtual.id !== socket.id) {
      socket.emit('erro', 'Não é o seu turno!');
      return;
    }

    const carta = jogadorAtual.mao.splice(indexCarta, 1)[0];
    sala.cartasNaMesa.push({ jogador: jogadorAtual, carta });

    io.to(idSala).emit('cartaJogada', {
      nomeJogador: jogadorAtual.nome,
      carta
    });

    sala.turno = (sala.turno + 1) % sala.jogadores.length;

    if (sala.cartasNaMesa.length === sala.jogadores.length) {
      avaliarMao(idSala);
    } else {
      io.to(idSala).emit('proximoTurno', {
        proximoJogadorId: sala.jogadores[sala.turno].id,
        nomeProximo: sala.jogadores[sala.turno].nome
      });
    }
  });

  socket.on('pedirTruco', ({ idSala }) => {
    const sala = salas[idSala];
    if (!sala) return;

    if (sala.valorRodada === 1) sala.valorRodada = 3;
    else if (sala.valorRodada === 3) sala.valorRodada = 6;
    else if (sala.valorRodada === 6) sala.valorRodada = 9;
    else if (sala.valorRodada === 9) sala.valorRodada = 12;

    io.to(idSala).emit('atualizarValorRodada', sala.valorRodada);
    io.to(idSala).emit('mensagemStatus', `${socket.id} AUMENTOU O JOGO PARA ${sala.valorRodada}!`);
  });

  socket.on('disconnect', () => {
    for (const id in salas) {
      salas[id].jogadores = salas[id].jogadores.filter(j => j.id !== socket.id);
      if (salas[id].jogadores.length === 0) delete salas[id];
    }
  });
});

function iniciarNovaRodada(idSala) {
  const sala = salas[idSala];
  sala.estado = 'jogando';
  sala.cartasNaMesa = [];
  sala.valorRodada = 1;

  const baralho = embaralhar(BARALHO_BASE);
  sala.vira = baralho.pop();

  sala.jogadores.forEach(j => {
    j.mao = [baralho.pop(), baralho.pop(), baralho.pop()];
    io.to(j.id).emit('suaMao', {
      mao: j.mao,
      vira: sala.vira,
      proximoJogadorId: sala.jogadores[sala.turno].id,
      nomeProximo: sala.jogadores[sala.turno].nome
    });
  });

  io.to(idSala).emit('atualizarValorRodada', 1);
}

function avaliarMao(idSala) {
  const sala = salas[idSala];
  
  // Ordena para descobrir quem jogou a carta de maior peso
  const jogadaGanhadora = [...sala.cartasNaMesa].sort((a, b) => b.carta.peso - a.carta.peso)[0];
  const timeVencedor = jogadaGanhadora.jogador.time;

  sala.pontos[timeVencedor] += sala.valorRodada;

  io.to(idSala).emit('atualizarPlacar', sala.pontos);
  io.to(idSala).emit('mensagemStatus', `${jogadaGanhadora.jogador.nome} venceu a queda!`);

  setTimeout(() => {
    if (sala.pontos.nos >= 12 || sala.pontos.eles >= 12) {
      io.to(idSala).emit('mensagemStatus', `FIM DE JOGO! TIME ${timeVencedor.toUpperCase()} VENCEU!`);
      sala.pontos = { nos: 0, eles: 0 };
    }
    iniciarNovaRodada(idSala);
  }, 3000);
}

// Configuração da porta dinâmica (essencial para Discloud, Render, Railway, etc.)
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORT}`));