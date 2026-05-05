const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/teams',          require('./routes/teams'));
app.use('/api/players',        require('./routes/players'));
app.use('/api/games',          require('./routes/games'));
app.use('/api/goals',          require('./routes/goals'));
app.use('/api/player-of-game', require('./routes/playerOfGame'));
app.use('/api/stats',          require('./routes/stats'));

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM teams)          AS teams,
      (SELECT COUNT(*) FROM players)        AS players,
      (SELECT COUNT(*) FROM games)          AS games,
      (SELECT COUNT(*) FROM goals)          AS goals,
      (SELECT COUNT(*) FROM player_of_game) AS player_of_game
  `).get();
  res.json({ status: 'ok', ...counts });
});

// ── Static assets (production) ────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// ── 404 for /api ──────────────────────────────────────────────────────────────

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// ── SPA fallback (production) ─────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Matchday API running on http://localhost:${PORT}`);
});
