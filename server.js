const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir arquivos estáticos (HTML, CSS, JS no mesmo diretório)
app.use(express.static(path.join(__dirname, '/')));

// --- ESTRUTURAS DE DADOS DO JOGO ---
const NAIPES = ['♦', '♠', '♥', '♣']; // Ordem do Truco Paulista: Ouros < Espadilha < Copas < Zap
const VALORES_ORDEM = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

const salas = {};

// Helper: Criar e embaralhar baralho de Truco (40 cartas)
function criarBaralho() {
  const baralho = [];
  for (const valor of VALORES_ORDEM) {
    for (const naipe of NAIPES) {
      baralho.push({ valor, naipe });
    }
  }
  // Fisher-Yates Shuffle
  for (let i = baralho.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
  }
  return baralho;
}

// Calcular Manilha baseada no Vira
function getManilhaValor(viraValor) {
  const idx = VALORES_ORDEM.indexOf(viraValor);
  return VALORES_ORDEM[(idx + 1) % VALORES_ORDEM.length];
}

// Retorna peso numérico da carta para comparação
function getPesoCarta(carta, manilhaValor) {
  if (carta.valor === manilhaValor) {
    // É Manilha: desempate por naipe (♦ = 14, ♠ = 15, ♥ = 16, ♣ = 17)
    return 14 + NAIPES.indexOf(carta.naipe);
  }
  return VALORES_ORDEM.indexOf(carta.valor);
}

// --- LÓGICA DO SERVIDOR SOCKET.IO ---
io.on('connection', (socket) => {

  // 1. Criar Sala
  socket.on('criarSala', ({ apelido, nomeSala, maxJogadores }) => {
    if (salas[nomeSala]) {
      return socket.emit('erroEntrada', 'Sala já existe! Escolha outro nome.');
    }

    salas[nomeSala] = {
      nome: nomeSala,
      maxJogadores: parseInt(maxJogadores),
      jogadores: [],
      pontosA: 0,
      pontosB: 0,
      trofeusA: 0,
      trofeusB: 0,
      emAndamento: false,
      estadoMao: null
    };

    entrarNaSala(socket, apelido, nomeSala);
  });

  // 2. Entrar na Sala
  socket.on('entrarSala', ({ apelido, nomeSala }) => {
    if (!salas[nomeSala]) {
      return socket.emit('erroEntrada', 'Sala não encontrada!');
    }
    entrarNaSala(socket, apelido, nomeSala);
  });

  function entrarNaSala(socket, apelido, nomeSala) {
    const sala = salas[nomeSala];

    if (sala.jogadores.length >= sala.maxJogadores) {
      return socket.emit('erroEntrada', 'A sala já está cheia!');
    }

    // Define time (A ou B)
    const timeA = sala.jogadores.filter(j => j.time === 'A').length;
    const timeB = sala.jogadores.filter(j => j.time === 'B').length;
    const time = timeA <= timeB ? 'A' : 'B';

    const jogador = {
      id: socket.id,
      apelido,
      time,
      cartas: []
    };

    sala.jogadores.push(jogador);
    socket.join(nomeSala);
    socket.nomeSala = nomeSala;

    socket.emit('sucessoEntrada', { apelido, time, nomeSala });
    io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);
    io.to(nomeSala).emit('atualizarTrofeus', { a: sala.trofeusA, b: sala.trofeusB });

    // Inicia a partida se atingir a capacidade máxima
    if (sala.jogadores.length === sala.maxJogadores && !sala.emAndamento) {
      sala.emAndamento = true;
      iniciarNovaMao(sala);
    }
  }

  // 3. Iniciar Nova Mão
  function iniciarNovaMao(sala) {
    const baralho = criarBaralho();
    const vira = baralho.pop();
    const manilhaValor = getManilhaValor(vira.valor);

    // Distribuir 3 cartas por jogador
    sala.jogadores.forEach(j => {
      j.cartas = [baralho.pop(), baralho.pop(), baralho.pop()];
    });

    const isMaoDe11A = sala.pontosA === 11 && sala.pontosB < 11;
    const isMaoDe11B = sala.pontosB === 11 && sala.pontosA < 11;
    const maoDeFerro = sala.pontosA === 11 && sala.pontosB === 11;

    sala.estadoMao = {
      baralho,
      vira,
      manilhaValor,
      valorMao: 1,
      ultimoPediuTime: null,
      trucoBloqueado: isMaoDe11A || isMaoDe11B || maoDeFerro,
      isMaoDe11: isMaoDe11A || isMaoDe11B,
      timeMao11: isMaoDe11A ? 'A' : (isMaoDe11B ? 'B' : null),
      maoDeFerro,
      historicoRodadas: [],
      cartasMesa: [],
      jogadorVezIndex: 0,
      primeiroDaMaoIndex: 0,
      vitoriasRodadaA: 0,
      vitoriasRodadaB: 0
    };

    // Atualiza individualmente cada jogador com suas cartas
    sala.jogadores.forEach(j => {
      io.to(j.id).emit('minhasCartas', {
        cartas: j.cartas,
        noEscuro: maoDeFerro
      });
    });

    const jogadorVez = sala.jogadores[0];

    io.to(sala.nome).emit('novaMao', {
      valorMao: 1,
      pontosA: sala.pontosA,
      pontosB: sala.pontosB,
      vez: jogadorVez.apelido,
      valorManilha: manilhaValor,
      vira,
      isMaoDe11: sala.estadoMao.isMaoDe11,
      maoDeFerro
    });

    io.to(sala.nome).emit('atualizarMesa', []);

    if (sala.estadoMao.isMaoDe11) {
      io.to(sala.nome).emit('decisaoMao11Pendente', { timeNaMao11: sala.estadoMao.timeMao11 });
    }
  }

  // 4. Jogar Carta
  socket.on('jogarCarta', ({ indiceCarta, esconder }) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.estadoMao) return;

    const m = sala.estadoMao;
    const jogador = sala.jogadores[m.jogadorVezIndex];

    if (jogador.id !== socket.id) return; // Não é a vez do jogador
    if (indiceCarta < 0 || indiceCarta >= jogador.cartas.length) return;

    const cartaJogada = jogador.cartas.splice(indiceCarta, 1)[0];
    const ehEscondida = esconder && m.historicoRodadas.length >= 1;

    m.cartasMesa.push({
      jogador,
      carta: cartaJogada,
      escondida: ehEscondida,
      peso: ehEscondida ? -1 : getPesoCarta(cartaJogada, m.manilhaValor)
    });

    // Animação para Manilha/Zap se jogada aberta
    if (!ehEscondida && cartaJogada.valor === m.manilhaValor) {
      const isZap = cartaJogada.naipe === '♣';
      io.to(sala.nome).emit('efeitoManilhaZap', { isZap, carta: cartaJogada });
    }

    io.to(socket.id).emit('minhasCartas', { cartas: jogador.cartas, noEscuro: m.maoDeFerro });
    io.to(sala.nome).emit('atualizarMesa', m.cartasMesa);

    // Se todos jogaram na rodada
    if (m.cartasMesa.length === sala.jogadores.length) {
      avaliarFimDaRodada(sala);
    } else {
      m.jogadorVezIndex = (m.jogadorVezIndex + 1) % sala.jogadores.length;
      io.to(sala.nome).emit('atualizarVez', sala.jogadores[m.jogadorVezIndex].apelido);
    }
  });

  // 5. Avaliação da Rodada / Mão
  function avaliarFimDaRodada(sala) {
    const m = sala.estadoMao;

    let maiorPeso = -2;
    let vencedores = [];

    m.cartasMesa.forEach(item => {
      if (item.peso > maiorPeso) {
        maiorPeso = item.peso;
        vencedores = [item.jogador];
      } else if (item.peso === maiorPeso) {
        vencedores.push(item.jogador);
      }
    });

    let resultadoRodada = 'Empate';
    if (vencedores.length === 1) {
      resultadoRodada = vencedores[0].time;
    } else if (vencedores.length > 1 && vencedores[0].time === vencedores[1].time) {
      resultadoRodada = vencedores[0].time;
    }

    m.historicoRodadas.push(resultadoRodada);

    if (resultadoRodada === 'A') m.vitoriasRodadaA++;
    if (resultadoRodada === 'B') m.vitoriasRodadaB++;

    io.to(sala.nome).emit('atualizarRodadasMao', m.historicoRodadas);

    // Checa vencedor da Mão (Melhor de 3)
    let timeVencedorMao = null;
    const h = m.historicoRodadas;

    if (m.vitoriasRodadaA >= 2) timeVencedorMao = 'A';
    else if (m.vitoriasRodadaB >= 2) timeVencedorMao = 'B';
    else if (h.length === 2 && h[0] === 'Empate' && h[1] !== 'Empate') timeVencedorMao = h[1];
    else if (h.length === 2 && h[0] !== 'Empate' && h[1] === 'Empate') timeVencedorMao = h[0];
    else if (h.length === 3) {
      if (h[2] !== 'Empate') timeVencedorMao = h[2];
      else timeVencedorMao = h[0] !== 'Empate' ? h[0] : null;
    }

    setTimeout(() => {
      m.cartasMesa = [];
      io.to(sala.nome).emit('atualizarMesa', []);

      if (timeVencedorMao) {
        finalizarMao(sala, timeVencedorMao, m.valorMao);
      } else {
        // Próxima rodada
        if (vencedores.length === 1) {
          m.jogadorVezIndex = sala.jogadores.findIndex(j => j.id === vencedores[0].id);
        } else {
          m.jogadorVezIndex = (m.primeiroDaMaoIndex + 1) % sala.jogadores.length;
        }
        io.to(sala.nome).emit('atualizarVez', sala.jogadores[m.jogadorVezIndex].apelido);
      }
    }, 1500);
  }

  function finalizarMao(sala, timeVencedor, pontos) {
    if (timeVencedor === 'A') sala.pontosA += pontos;
    if (timeVencedor === 'B') sala.pontosB += pontos;

    if (sala.pontosA >= 12 || sala.pontosB >= 12) {
      const vencedor = sala.pontosA >= 12 ? 'A' : 'B';
      if (vencedor === 'A') sala.trofeusA++;
      else sala.trofeusB++;

      io.to(sala.nome).emit('fimDePartida', { vencedor });
      io.to(sala.nome).emit('atualizarTrofeus', { a: sala.trofeusA, b: sala.trofeusB });

      // Reinicia Pontos para nova partida
      sala.pontosA = 0;
      sala.pontosB = 0;
    }

    iniciarNovaMao(sala);
  }

  // 6. Sistema de Aposta (Truco / 6 / 9 / 12)
  socket.on('pedirTruco', () => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.estadoMao) return;

    const m = sala.estadoMao;
    if (m.trucoBloqueado) return;

    const jogador = sala.jogadores.find(j => j.id === socket.id);
    if (!jogador || jogador.time === m.ultimoPediuTime) return;

    let proximoValor = 3;
    if (m.valorMao === 3) proximoValor = 6;
    if (m.valorMao === 6) proximoValor = 9;
    if (m.valorMao === 9) proximoValor = 12;

    m.valorProposto = proximoValor;
    m.quemPediu = jogador;

    io.to(sala.nome).emit('solicitacaoTruco', {
      pediuApelido: jogador.apelido,
      pediuTime: jogador.time,
      valorProposto: proximoValor
    });
  });

  socket.on('respostaTruco', ({ aceitou, aumentar }) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.estadoMao) return;

    const m = sala.estadoMao;
    const jogadorRespondeu = sala.jogadores.find(j => j.id === socket.id);

    if (aceitou) {
      if (aumentar) {
        // Contra-proposta de aumento
        let novoValor = 6;
        if (m.valorProposto === 6) novoValor = 9;
        if (m.valorProposto === 9) novoValor = 12;

        m.valorProposto = novoValor;
        m.ultimoPediuTime = jogadorRespondeu.time;

        io.to(sala.nome).emit('solicitacaoTruco', {
          pediuApelido: jogadorRespondeu.apelido,
          pediuTime: jogadorRespondeu.time,
          valorProposto: novoValor
        });
      } else {
        // Aceitou aumento
        m.valorMao = m.valorProposto;
        m.ultimoPediuTime = m.quemPediu.time;

        io.to(sala.nome).emit('atualizarEstadoTruco', {
          valorMao: m.valorMao,
          ultimoPediuTime: m.ultimoPediuTime,
          bloqueado: false
        });
      }
    } else {
      // Correu do Truco
      const timeVencedor = jogadorRespondeu.time === 'A' ? 'B' : 'A';
      finalizarMao(sala, timeVencedor, m.valorMao);
    }
  });

  // 7. Resposta Mão de 11
  socket.on('respostaMao11', (aceitou) => {
    const sala = salas[socket.nomeSala];
    if (!sala || !sala.estadoMao) return;

    const m = sala.estadoMao;
    const timeRival = m.timeMao11 === 'A' ? 'B' : 'A';

    if (aceitou) {
      m.valorMao = 3;
      io.to(sala.nome).emit('atualizarEstadoTruco', { valorMao: 3, bloqueado: true });
    } else {
      // Correu na mão de 11 -> Entrega 1 ponto ao rival
      finalizarMao(sala, timeRival, 1);
    }
  });

  // 8. Desconexão
  socket.on('destruirSalaForcado', () => {
    const nomeSala = socket.nomeSala;
    if (salas[nomeSala]) {
      io.to(nomeSala).emit('salaDestruida', 'A sala foi encerrada.');
      delete salas[nomeSala];
    }
  });

  socket.on('disconnect', () => {
    const nomeSala = socket.nomeSala;
    if (!nomeSala || !salas[nomeSala]) return;

    const sala = salas[nomeSala];
    const jogSaindo = sala.jogadores.find(j => j.id === socket.id);

    if (jogSaindo) {
      io.to(nomeSala).emit('jogadorDesconectado', { apelido: jogSaindo.apelido });

      if (sala.emAndamento) {
        delete salas[nomeSala];
      } else {
        sala.jogadores = sala.jogadores.filter(j => j.id !== socket.id);
        io.to(nomeSala).emit('atualizarJogadores', sala.jogadores);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
