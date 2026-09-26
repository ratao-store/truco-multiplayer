const socket = io();

const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app');

const btnEntrar = document.getElementById('btn-entrar');
const inputApelido = document.getElementById('input-apelido');
const inputSala = document.getElementById('input-sala');
const selectJogadores = document.getElementById('select-jogadores');

btnEntrar.onclick = () => {
  const apelido = inputApelido.value.trim() || 'Jogador_' + Math.floor(100 + Math.random() * 900);
  const nomeSala = inputSala.value.trim() || 'sala-geral';
  const maxJogadores = selectJogadores.value;

  socket.emit('entrarOuCriarSala', { apelido, nomeSala, maxJogadores });
};

socket.on('erroEntrada', (msg) => {
  alert(msg);
});

socket.on('sucessoEntrada', (data) => {
  loginContainer.style.display = 'none';
  appContainer.style.display = 'flex';
  
  document.getElementById('label-nome-sala').innerText = data.nomeSala;
  document.getElementById('meu-info').innerText = `${data.apelido} (Time ${data.time})`;
});

socket.on('atualizarJogadores', (jogadores) => {
  const timeA = jogadores.filter(j => j.time === 'A').map(j => j.apelido).join(' & ');
  const timeB = jogadores.filter(j => j.time === 'B').map(j => j.apelido).join(' & ');

  document.getElementById('nome-time-a').innerText = timeA || 'Aguardando...';
  document.getElementById('nome-time-b').innerText = timeB || 'Aguardando...';
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
  document.getElementById('status-vez').innerText = apelido.includes('Aguardando') ? apelido : `Vez de: ${apelido}`;
});

socket.on('fimDeJogo', (data) => {
  alert(`Fim de jogo! Vencedores: ${data.vencedor}`);
});
