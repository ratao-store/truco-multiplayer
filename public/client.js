const socket = io();

let meuApelido = '';
let meuTime = '';

socket.on('infoJogador', (data) => {
  meuApelido = data.apelido;
  meuTime = data.time;
  document.getElementById('meu-info').innerText = `${meuApelido} (Time ${meuTime})`;
});

socket.on('atualizarJogadores', (jogadores) => {
  const timeA = jogadores.filter(j => j.time === 'A').map(j => j.apelido).join(' & ');
  const timeB = jogadores.filter(j => j.time === 'B').map(j => j.apelido).join(' & ');

  document.getElementById('nome-time-a').innerText = timeA || 'Time A';
  document.getElementById('nome-time-b').innerText = timeB || 'Time B';
});

socket.on('novaMao', (data) => {
  document.getElementById('pontos-a').innerText = data.pontosA;
  document.getElementById('pontos-b').innerText = data.pontosB;
  document.getElementById('status-vez').innerText = `Vez de: ${data.vez}`;

  const viraEl = document.getElementById('carta-vira');
  viraEl.innerText = `${data.vira.valor}${data.vira.naipe}`;
  if (data.vira.naipe === '♦' || data.vira.naipe === '♥') {
    viraEl.classList.add('vermelho');
  } else {
    viraEl.classList.remove('vermelho');
  }
});

socket.on('minhasCartas', (cartas) => {
  const container = document.getElementById('minhas-cartas');
  container.innerHTML = '';

  cartas.forEach((c, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'carta' + (c.naipe === '♦' || c.naipe === '♥' ? ' vermelho' : '');
    cardEl.innerText = `${c.valor}${c.naipe}`;
    cardEl.onclick = () => socket.emit('jogarCarta', index);
    container.appendChild(cardEl);
  });
});

socket.on('atualizarMesa', (cartasMesa) => {
  const container = document.getElementById('cartas-mesa');
  container.innerHTML = '';

  cartasMesa.forEach(item => {
    const cardEl = document.createElement('div');
    cardEl.className = 'carta' + (item.carta.naipe === '♦' || item.carta.naipe === '♥' ? ' vermelho' : '');
    cardEl.innerText = `${item.carta.valor}${item.carta.naipe}`;
    container.appendChild(cardEl);
  });
});

socket.on('atualizarVez', (apelido) => {
  document.getElementById('status-vez').innerText = `Vez de: ${apelido}`;
});

socket.on('fimDeJogo', (data) => {
  alert(`Fim de jogo! Vencedor: ${data.vencedor}`);
});
