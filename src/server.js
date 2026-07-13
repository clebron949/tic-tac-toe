const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });
let players = [];
let board = Array(9).fill(null);
let currentTurn = 'X';
let winner = null;
let winningLine = [];
let scores = createScores();

const winningCombos = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

wss.on('connection', (ws) => {
  if (players.length >= 2) {
    send(ws, { type: 'full', message: 'Game is full. Try again later.' });
    ws.close();
    return;
  }

  const takenSymbols = players.map((player) => player.symbol);
  const symbol = takenSymbols.includes('X') ? 'O' : 'X';
  players.push({ ws, symbol });

  send(ws, { type: 'init', symbol });
  broadcastGameState(players.length === 2 ? 'game' : 'waiting');

  ws.on('message', (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch {
      send(ws, { type: 'error', message: 'Invalid message received.' });
      return;
    }

    if (data.type === 'move') {
      handleMove(ws, symbol, Number(data.index));
      return;
    }

    if (data.type === 'reset') {
      resetGame();
      broadcastGameState(players.length === 2 ? 'game' : 'waiting');
    }
  });

  ws.on('close', () => {
    players = players.filter((player) => player.ws !== ws);
    resetGame();
    scores = createScores();
    broadcast({ type: 'opponent_left', message: 'Opponent disconnected. Waiting for another player.' });
    broadcastGameState('waiting');
  });
});

function handleMove(ws, symbol, index) {
  if (players.length < 2) {
    send(ws, { type: 'error', message: 'Wait for another player before moving.' });
    return;
  }

  if (winner) {
    send(ws, { type: 'error', message: 'The round is over. Start a new round.' });
    return;
  }

  if (symbol !== currentTurn) {
    send(ws, { type: 'error', message: 'It is not your turn.' });
    return;
  }

  if (!Number.isInteger(index) || index < 0 || index > 8 || board[index]) {
    send(ws, { type: 'error', message: 'That square is not available.' });
    return;
  }

  board[index] = symbol;
  const result = getRoundResult();

  if (result) {
    winner = result.winner;
    winningLine = result.winningLine;
    updateScores(winner);
    broadcastGameState('over');
    return;
  }

  currentTurn = currentTurn === 'X' ? 'O' : 'X';
  broadcastGameState('game');
}

function getRoundResult() {
  for (const combo of winningCombos) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winningLine: combo };
    }
  }

  if (board.every(Boolean)) {
    return { winner: 'Draw', winningLine: [] };
  }

  return null;
}

function broadcastGameState(type) {
  broadcast({
    type,
    board,
    currentTurn,
    winner,
    winningLine,
    playerCount: players.length,
    scores,
  });
}

function broadcast(data) {
  players.forEach((player) => send(player.ws, data));
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function resetGame() {
  board = Array(9).fill(null);
  currentTurn = 'X';
  winner = null;
  winningLine = [];
}

function createScores() {
  return {
    X: { wins: 0, losses: 0, draws: 0 },
    O: { wins: 0, losses: 0, draws: 0 },
  };
}

function updateScores(result) {
  if (result === 'Draw') {
    scores.X.draws += 1;
    scores.O.draws += 1;
    return;
  }

  const loser = result === 'X' ? 'O' : 'X';
  scores[result].wins += 1;
  scores[loser].losses += 1;
}
