const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');

// POST /api/goals
router.post('/', wrap((req, res) => {
  const { game_id, player_id, minute } = req.body ?? {};
  if (!game_id || !player_id || minute == null)
    return res.status(400).json({ error: 'game_id, player_id, and minute are required' });

  const min = Number(minute);
  if (!Number.isInteger(min) || min < 0 || min > 120)
    return res.status(400).json({ error: 'minute must be an integer between 0 and 120' });

  if (!db.prepare('SELECT id FROM games WHERE id = ?').get(game_id))
    return res.status(404).json({ error: 'Game not found' });
  if (!db.prepare('SELECT id FROM players WHERE id = ?').get(player_id))
    return res.status(404).json({ error: 'Player not found' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO goals (game_id, player_id, minute) VALUES (?, ?, ?)')
    .run(game_id, player_id, min);

  const goal = db.prepare(`
    SELECT go.*, p.name AS player_name, p.jersey_number
    FROM   goals go
    JOIN   players p ON p.id = go.player_id
    WHERE  go.id = ?
  `).get(lastInsertRowid);

  res.status(201).json(goal);
}));

// DELETE /api/goals/:id
router.delete('/:id', wrap((req, res) => {
  const goal = db.prepare('SELECT id FROM goals WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, id: Number(req.params.id) });
}));

module.exports = router;
