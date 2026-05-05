const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');

// GET /api/teams
router.get('/', wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM teams ORDER BY id').all());
}));

// POST /api/teams
router.post('/', wrap((req, res) => {
  const { name, season } = req.body ?? {};
  if (!name?.trim() || !season?.toString().trim())
    return res.status(400).json({ error: 'name and season are required' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO teams (name, season) VALUES (?, ?)')
    .run(name.trim(), season.toString().trim());

  res.status(201).json(db.prepare('SELECT * FROM teams WHERE id = ?').get(lastInsertRowid));
}));

// GET /api/teams/:id  — includes players array
router.get('/:id', wrap((req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  team.players = db
    .prepare('SELECT * FROM players WHERE team_id = ? ORDER BY jersey_number')
    .all(req.params.id);

  res.json(team);
}));

module.exports = router;
