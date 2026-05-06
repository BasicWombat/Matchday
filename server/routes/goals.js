const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');
const { requireAuth } = require('../lib/auth');

// POST /api/goals
router.post('/', requireAuth, wrap((req, res) => {
  const { game_id, player_id, team_id, elapsed_seconds } = req.body ?? {};

  if (!game_id || !team_id || elapsed_seconds == null)
    return res.status(400).json({ error: 'game_id, team_id, and elapsed_seconds are required' });

  const elapsedSec = Number(elapsed_seconds);
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0)
    return res.status(400).json({ error: 'elapsed_seconds must be a non-negative number' });

  const displayMinute = Math.floor(elapsedSec / 60) + 1;

  const game = db.prepare('SELECT id, status FROM games WHERE id = ?').get(game_id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status === 'complete') return res.status(400).json({ error: 'Cannot add goals to a completed game' });

  if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(team_id))
    return res.status(404).json({ error: 'Team not found' });

  if (player_id && !db.prepare('SELECT id FROM players WHERE id = ?').get(player_id))
    return res.status(404).json({ error: 'Player not found' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO goals (game_id, team_id, player_id, elapsed_seconds, display_minute, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(game_id, team_id, player_id ?? null, elapsedSec, displayMinute, req.user.id);

  const goal = db.prepare(`
    SELECT go.*, p.name AS player_name, p.jersey_number, go.display_minute AS minute
    FROM   goals go
    LEFT JOIN players p ON p.id = go.player_id
    WHERE  go.id = ?
  `).get(lastInsertRowid);

  res.status(201).json(goal);
}));

// DELETE /api/goals/:id
router.delete('/:id', requireAuth, wrap((req, res) => {
  const goal = db.prepare('SELECT id, game_id FROM goals WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const game = db.prepare('SELECT status FROM games WHERE id = ?').get(goal.game_id);
  if (game?.status === 'complete') return res.status(400).json({ error: 'Cannot remove goals from a completed game' });

  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, id: Number(req.params.id) });
}));

module.exports = router;
