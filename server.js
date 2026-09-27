const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const NAIPES = ['♦', '♠', '♥', '♣']; // Ouros, Espadas, Copas, Paus (Ordem de força do Truco Paulista)
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

  // Verificação de Mão de 11 e Mão de Ferro
  sala.isMaoDe11 = (sala.pontosA === 11 || sala.pontosB === 11) && !(sala.pontosA === 11 && sala.pontosB === 11);
  sala.maoDeFerro = (sala.pontosA === 11 && sala.pontosB === 11);

  if (sala.isMaoDe11) {
    sala.valorMao = 3; // Se aceitarem jogar na Mão de 11, a mão vale 3 pontos
    sala.timeNaMao11 = sala.pontosA === 11 ? 'A' : 'B';
    sala.mao11Decidida = false;
  }

  // Distribuir 3 cartas para cada jogador
  sala.jogadores.forEach(j => {
    j.cartas = [sala.baralho.pop(), sala.baralho.pop(), sala.baralho.pop()];
  });

  // Alternar o distribuidor (pé) e definir o primeiro a jogar
  sala.indicePe = (sala.indicePe + 1) % sala.jogadores.length;
  sala.indiceTurno = (sala.indicePe + 1) % sala.jogadores.length;

  // Notificar clientes
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
    io.to(j.id).emit('minhasCartas', {
      cartas: j.cartas,
      noEscuro: sala.maoDeFerro
    });
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

  sala.timerTurno = setTimeout(() => {
    if (sala.jogadores.length === sala.maxJogadores && !sala.processandoTurno) {
      // Força a jogada da primeira carta disponível se estourar 20 segundos
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
    if (item.escondida) return; // Carta coberta tem força 0
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

  // Efeito Zap/Manilha se a carta mais forte da rodada for Manilha
  if (!empate && vencedorJogada) {
    let cartaGanhadora = sala.cartasMesa.find(i => i.jogador === vencedorJogada).carta;
    if (cartaGanhadora.valor === sala.valorManilha) {
      io.to(sala.nome).emit('efeitoManilhaZap', {
        carta: cartaGanhadora,
        isZap: cartaGanhadora.naipe === '♣'
      });
    }
  }

  // Definir quem começa a próxima rodada (quem ganhou a vaza atual)
  if (!empate && vencedorJogada) {
    sala.indiceTurno = sala.jogadores.findIndex(j => j.id === vencedorJogada.id);
  }

  // Verificar se alguém venceu a Mão (Melhor de 3)
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
  }, 3000); // Aguarda 3s para mostrar as cartas jogadas na mesa
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
  io.to(jogador.id).emit('minhasCartas', { cartas: jogador.cartas, noEscuro: sala.maoDeFerro });

  // Se todos jogaram na rodada
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

  socket.on('criarSala', ({ apelido, nomeSala, maxJogadores }) => {
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

    entrarNaSala(socket, apelido, nomeSala);
  });

  socket.on('entrarSala', ({ apelido, nomeSala }) => {
    if (!salas[nomeSala]) {
      return socket.emit('erroEntrada', 'Sala não encontrada!');
    }
    entrarNaSala(socket, apelido, nomeSala);
  });

  function entrarNaSala(socket, apelido, nomeSala) {
    let sala = salas[nomeSala];

    if (sala.jogadores.length >= sala.maxJogadores) {
      return socket.emit('erroEntrada', 'A sala já está cheia!');
    }

    let timeA = sala.jogadores.filter(j => j.time === 'A').length;
    let timeB = sala.jogadores.filter(j => j.time === 'B').length;
    let timeAtribuido = (timeA <= timeB) ? 'A' : 'B';

    let novoJogador = {
      id: socket.id,
      apelido,
      time: timeAtribuido,
      cartas: []
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
    if (!jogador) return;

    if (sala.ultimoPediuTime === jogador.time) return;

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
    let timeQueResponde = timeQuePediu === 'A' ? 'B' : 'A';

    if (!aceitou) {
      // Correr do truco entrega o valor da mão atual para o rival
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
      // Auto-pedir o próximo nível se clicou em Aumentar
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
      // Decidiu jogar: a mão vale 3 pontos
      sala.valorMao = 3;
      io.to(sala.nome).emit('atualizarEstadoTruco', { valorMao: 3, bloqueio: true });
      iniciarTimerTurno(sala);
    } else {
      // Correu da Mão de 11: entrega 1 ponto ao adversário
      sala.valorMao = 1;
      let timeRival = sala.timeNaMao11 === 'A' ? 'B' : 'A';
      finalizarMao(sala, timeRival);
    }
  });

  socket.on('destruirSalaForcado', () => {
    let nomeSala = socket.nomeSala;
    if (salas[nomeSala]) {
      if (salas[nomeSala].timerTurno) clearTimeout(salas[nomeSala].timerTurno);
      io.to(nomeSala).emit('salaDestruida', 'A sala foi destruída por um dos jogadores.');
      delete salas[nomeSala];
    }
  });

  socket.on('disconnect', () => {
    let nomeSala = socket.nomeSala;
    if (nomeSala && salas[nomeSala]) {
      let sala = salas[nomeSala];
      let jogadorSaindo = sala.jogadores.find(j => j.id === socket.id);
      if (sala.timerTurno) clearTimeout(sala.timerTurno);

      io.to(nomeSala).emit('jogadorDesconectado', {
        apelido: jogadorSaindo ? jogadorSaindo.apelido : 'Um jogador'
      });
      delete salas[nomeSala];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));
