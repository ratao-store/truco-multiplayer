const socket = io();
let idSalaAtual = '';

function entrarNaSala() {
  const nome = document.getElementById('nomeJogador').value.trim();
  const sala = document.getElementById('idSala').value.trim();
  const max = document.getElementById('maxJogadores').value;

  if (!nome || !sala) {
    alert('Preencha seu apelido e a sala!');
    return;
  }

  idSalaAtual = sala;
  socket.emit('entrarSala', { nomeJogador: nome, idSala: sala, maxJogadores: max });

  document.getElementById('telaLobby').classList.add('oculto');
  document.getElementById('telaJogo').classList.remove('oculto');
}

socket.on('suaMao', ({ mao, vira, proximoJogadorId, nomeProximo }) => {
  document.getElementById('cartaVira').innerText = `${vira.valor} ${vira.naipe.split(' ')[0]}`;
  document.getElementById('cartasNaMesa').innerHTML = '';

  const divMinhasCartas = document.getElementById('minhasCartas');
  divMinhasCartas.innerHTML = '';

  mao.forEach((carta, index) => {
    const btn = document.createElement('div');
    btn.className = 'carta-display carta-mao';
    btn.innerText = `${carta.valor}\n${carta.naipe.split(' ')[0]}`;
    btn.onclick = () => socket.emit('jogarCarta', { idSala: idSalaAtual, indexCarta: index });
    divMinhasCartas.appendChild(btn);
  });

  atualizarTurno(proximoJogadorId, nomeProximo);
});

socket.on('cartaJogada', ({ nomeJogador, carta }) => {
  const mesa = document.getElementById('cartasNaMesa');
  const wrapper = document.createElement('div');
  wrapper.className = 'carta-mesa-wrapper';

  const card = document.createElement('div');
  card.className = 'carta-display';
  card.innerText = `${carta.valor}\n${carta.naipe.split(' ')[0]}`;

  const label = document.createElement('span');
  label.innerText = nomeJogador;

  wrapper.appendChild(card);
  wrapper.appendChild(label);
  mesa.appendChild(wrapper);
});

socket.on('atualizarPlacar', (pontos) => {
  document.getElementById('placarNos').innerText = pontos.nos;
  document.getElementById('placarEles').innerText = pontos.eles;
});

socket.on('atualizarValorRodada', (valor) => {
  document.getElementById('valorRodada').innerText = valor;
});

socket.on('mensagemStatus', (msg) => {
  document.getElementById('statusMesa').innerText = msg;
});

socket.on('proximoTurno', ({ proximoJogadorId, nomeProximo }) => {
  atualizarTurno(proximoJogadorId, nomeProximo);
});

function pedirTruco() {
  socket.emit('pedirTruco', { idSala: idSalaAtual });
}

function atualizarTurno(idProximo, nomeProximo) {
  const status = document.getElementById('statusMesa');
  if (idProximo === socket.id) {
    status.innerText = 'Sua vez de jogar!';
  } else {
    status.innerText = `Vez de: ${nomeProximo}`;
  }
}