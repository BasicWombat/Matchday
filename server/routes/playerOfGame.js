const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');
const { requireAuth } = require('../lib/auth');

// POST /api/player-of-game  (upsert — one per game)
router.post('/', requireAuth, wrap((req, res) => {
  const { game_id, player_id } = req.body ?? {};
  if (!game_id || !player_id)
    return res.status(400).json({ error: 'game_id and player_id are required' });

  if (!db.prepare('SELECT id FROM games WHERE id = ?').get(game_id))
    return res.status(404).json({ error: 'Game not found' });
  if (!db.prepare('SELECT id FROM players WHERE id = ?').get(player_id))
    return res.status(404).json({ error: 'Player not found' });

  const upsert = db.transaction(() => {
    db.prepare('DELETE FROM player_of_game WHERE game_id = ?').run(game_id);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO player_of_game (game_id, player_id, created_by) VALUES (?, ?, ?)')
      .run(game_id, player_id, req.user.id);
    return lastInsertRowid;
  });

  const id = upsert();

  const row = db.prepare(`
    SELECT pg.*, p.name AS player_name, p.jersey_number
    FROM   player_of_game pg
    JOIN   players p ON p.id = pg.player_id
    WHERE  pg.id = ?
  `).get(id);

  res.status(201).json(row);
}));

module.exports = router;
