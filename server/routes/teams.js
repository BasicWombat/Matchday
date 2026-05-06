const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');
const { requireAuth } = require('../lib/auth');

// GET /api/teams
router.get('/', wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM teams ORDER BY id').all());
}));

// POST /api/teams  — season is optional (opponent teams don't need one)
router.post('/', wrap((req, res) => {
  const { name, season = '' } = req.body ?? {};
  if (!name?.trim())
    return res.status(400).json({ error: 'name is required' });

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

// PUT /api/teams/:id  — update team name
router.put('/:id', requireAuth, wrap((req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const { name } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const trimmed = name.trim();
  db.prepare('UPDATE teams SET name = ? WHERE id = ?').run(trimmed, req.params.id);
  // Keep game snapshots in sync so if this team is later deleted, history stays accurate
  db.prepare('UPDATE games SET home_team_name = ? WHERE home_team = ?').run(trimmed, req.params.id);
  db.prepare('UPDATE games SET away_team_name = ? WHERE away_team = ?').run(trimmed, req.params.id);

  res.json(db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id));
}));

// PUT /api/teams/:id/set-my-team  — sets this team as the current user's My Team
router.put('/:id/set-my-team', requireAuth, wrap((req, res) => {
  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  db.prepare('UPDATE users SET my_team_id = ? WHERE id = ?').run(req.params.id, req.user.id);

  res.json(db.prepare(
    'SELECT id, username, display_name, role, my_team_id, created_at FROM users WHERE id = ?'
  ).get(req.user.id));
}));

// DELETE /api/teams/:id  — cascades players; games preserve team name via snapshot
router.delete('/:id', requireAuth, wrap((req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const isAnyonesMyTeam = db.prepare('SELECT 1 FROM users WHERE my_team_id = ? LIMIT 1').get(req.params.id);
  if (isAnyonesMyTeam) return res.status(400).json({ error: 'Cannot delete a team set as My Team by any user. Switch My Team first.' });

  // Players cascade via FK ON DELETE CASCADE on players.team_id
  // Games retain team name via snapshot columns + ON DELETE SET NULL on games.home_team/away_team
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, id: Number(req.params.id) });
}));

module.exports = router;
