const statusText = document.querySelector('[data-status]');
const playerBadge = document.querySelector('[data-player]');
const opponentBadge = document.querySelector('[data-opponent]');
const turnBadge = document.querySelector('[data-turn]');
const connectionText = document.querySelector('[data-connection]');
const resetButton = document.querySelector('[data-reset]');
const cells = [...document.querySelectorAll('[data-cell]')];

const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${protocol}://${window.location.host}`);

let mySymbol = null;
let latestState = {
  board: Array(9).fill(null),
  currentTurn: 'X',
  winner: null,
  winningLine: [],
  playerCount: 0,
};

ws.addEventListener('open', () => {
  connectionText.textContent = 'Connected';
});

ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'init') {
    mySymbol = data.symbol;
    playerBadge.textContent = `You: ${mySymbol}`;
    opponentBadge.textContent = `Opponent: ${mySymbol === 'X' ? 'O' : 'X'}`;
    return;
  }

  if (data.type === 'full') {
    statusText.textContent = data.message;
    connectionText.textContent = 'Room full';
    setBoardDisabled(true);
    return;
  }

  if (data.type === 'error') {
    statusText.textContent = data.message;
    return;
  }

  if (data.type === 'opponent_left') {
    statusText.textContent = data.message;
  }

  if (['waiting', 'game', 'over'].includes(data.type)) {
    latestState = {
      board: data.board || latestState.board,
      currentTurn: data.currentTurn || 'X',
      winner: data.winner || null,
      winningLine: data.winningLine || [],
      playerCount: data.playerCount || 0,
    };

    render(data.type);
  }
});

ws.addEventListener('close', () => {
  connectionText.textContent = 'Disconnected';
  statusText.textContent = 'Connection closed. Refresh to join again.';
  setBoardDisabled(true);
});

ws.addEventListener('error', () => {
  connectionText.textContent = 'Connection error';
  statusText.textContent = 'Could not connect to the game server.';
});

cells.forEach((cell) => {
  cell.addEventListener('click', () => {
    const index = Number(cell.dataset.cell);

    if (!canPlay(index)) {
      return;
    }

    ws.send(JSON.stringify({ type: 'move', index }));
  });
});

resetButton.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'reset' }));
});

function render(messageType) {
  const { board, currentTurn, winner, winningLine, playerCount } = latestState;
  const isMyTurn = currentTurn === mySymbol;

  turnBadge.textContent = winner ? 'Round over' : `Turn: ${currentTurn}`;
  resetButton.disabled = playerCount < 2;

  cells.forEach((cell, index) => {
    const mark = board[index] || '';
    cell.textContent = mark;
    cell.classList.toggle('winning-cell', winningLine.includes(index));
    cell.disabled = !canPlay(index);
    cell.setAttribute('aria-label', mark ? `Square ${index + 1}, ${mark}` : `Square ${index + 1}, empty`);
  });

  document.body.classList.toggle('my-turn', isMyTurn && !winner && playerCount === 2);

  if (winner === 'Draw') {
    statusText.textContent = 'Draw. The board is full and nobody blinked.';
    return;
  }

  if (winner) {
    statusText.textContent = winner === mySymbol ? 'You win. Clean line, clean finish.' : `Player ${winner} wins this round.`;
    return;
  }

  if (messageType === 'waiting' || playerCount < 2) {
    statusText.textContent = 'Waiting for an opponent to join...';
    return;
  }

  statusText.textContent = isMyTurn ? 'Your move. Pick a square.' : `Player ${currentTurn} is thinking...`;
}

function canPlay(index) {
  return (
    ws.readyState === WebSocket.OPEN &&
    latestState.playerCount === 2 &&
    !latestState.winner &&
    latestState.currentTurn === mySymbol &&
    !latestState.board[index]
  );
}

function setBoardDisabled(disabled) {
  cells.forEach((cell) => {
    cell.disabled = disabled;
  });
  resetButton.disabled = disabled;
}
