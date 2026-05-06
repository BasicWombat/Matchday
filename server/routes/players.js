const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');
const { requireAuth } = require('../lib/auth');

// GET /api/players?team_id=X
router.get('/', wrap((req, res) => {
  const { team_id } = req.query;
  const players = team_id
    ? db.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY jersey_number').all(team_id)
    : db.prepare('SELECT * FROM players ORDER BY team_id, jersey_number').all();
  res.json(players);
}));

// POST /api/players
router.post('/', requireAuth, wrap((req, res) => {
  const { name, team_id, jersey_number } = req.body ?? {};
  if (!name?.trim() || !team_id || jersey_number == null)
    return res.status(400).json({ error: 'name, team_id, and jersey_number are required' });

  if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(team_id))
    return res.status(404).json({ error: 'Team not found' });

  const num = Number(jersey_number);
  if (!Number.isInteger(num) || num < 1 || num > 99)
    return res.status(400).json({ error: 'jersey_number must be an integer between 1 and 99' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO players (name, team_id, jersey_number) VALUES (?, ?, ?)')
    .run(name.trim(), team_id, num);

  res.status(201).json(db.prepare('SELECT * FROM players WHERE id = ?').get(lastInsertRowid));
}));

// DELETE /api/players/:id
router.delete('/:id', requireAuth, wrap((req, res) => {
  const player = db.prepare('SELECT id FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, id: Number(req.params.id) });
}));

module.exports = router;
