const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');

// ── Shared SQL ────────────────────────────────────────────────────────────────

// Goals are fetched via a derived table so ORDER BY inside json_group_array works
// across SQLite versions.
const GAME_SELECT = `
  SELECT
    g.*,
    ht.name AS home_team_name,
    at.name AS away_team_name,
    (
      SELECT json_group_array(json_object(
        'id',            sub.id,
        'player_id',     sub.player_id,
        'player_name',   sub.player_name,
        'jersey_number', sub.jersey_number,
        'minute',        sub.minute
      ))
      FROM (
        SELECT go.id, go.player_id, p.name AS player_name, p.jersey_number, go.minute
        FROM   goals go
        JOIN   players p ON p.id = go.player_id
        WHERE  go.game_id = g.id
        ORDER  BY go.minute
      ) sub
    ) AS goals,
    (
      SELECT json_object(
        'id',            pg.id,
        'player_id',     pg.player_id,
        'player_name',   p2.name,
        'jersey_number', p2.jersey_number
      )
      FROM player_of_game pg
      JOIN players p2 ON p2.id = pg.player_id
      WHERE pg.game_id = g.id
    ) AS player_of_game
  FROM games g
  JOIN teams ht ON ht.id = g.home_team
  JOIN teams at ON at.id = g.away_team
`;

const stmtFindAll  = db.prepare(`${GAME_SELECT} ORDER BY g.date DESC`);
const stmtFindById = db.prepare(`${GAME_SELECT} WHERE g.id = ?`);

function parseGame(row) {
  if (!row) return null;
  // better-sqlite3 returns JSON columns as strings
  row.goals = typeof row.goals === 'string' ? JSON.parse(row.goals) : (row.goals ?? []);
  row.player_of_game = typeof row.player_of_game === 'string'
    ? JSON.parse(row.player_of_game)
    : (row.player_of_game ?? null);
  return row;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/games
router.get('/', wrap((req, res) => {
  res.json(stmtFindAll.all().map(parseGame));
}));

// POST /api/games
router.post('/', wrap((req, res) => {
  const { date, home_team, away_team, home_score = 0, away_score = 0, notes } = req.body ?? {};
  if (!date || !home_team || !away_team)
    return res.status(400).json({ error: 'date, home_team, and away_team are required' });

  if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(home_team))
    return res.status(404).json({ error: 'home_team not found' });
  if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(away_team))
    return res.status(404).json({ error: 'away_team not found' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO games (date, home_team, away_team, home_score, away_score, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(date, home_team, away_team, Number(home_score), Number(away_score), notes ?? null);

  res.status(201).json(parseGame(stmtFindById.get(lastInsertRowid)));
}));

// GET /api/games/:id
router.get('/:id', wrap((req, res) => {
  const game = parseGame(stmtFindById.get(req.params.id));
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
}));

// PUT /api/games/:id
router.put('/:id', wrap((req, res) => {
  const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });

  const {
    date       = existing.date,
    home_team  = existing.home_team,
    away_team  = existing.away_team,
    home_score = existing.home_score,
    away_score = existing.away_score,
    notes      = existing.notes,
  } = req.body ?? {};

  if (home_team !== existing.home_team && !db.prepare('SELECT id FROM teams WHERE id = ?').get(home_team))
    return res.status(404).json({ error: 'home_team not found' });
  if (away_team !== existing.away_team && !db.prepare('SELECT id FROM teams WHERE id = ?').get(away_team))
    return res.status(404).json({ error: 'away_team not found' });

  db.prepare(`
    UPDATE games SET date=?, home_team=?, away_team=?, home_score=?, away_score=?, notes=?
    WHERE id=?
  `).run(date, home_team, away_team, Number(home_score), Number(away_score), notes ?? null, req.params.id);

  res.json(parseGame(stmtFindById.get(req.params.id)));
}));

// DELETE /api/games/:id
router.delete('/:id', wrap((req, res) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, id: Number(req.params.id) });
}));

module.exports = router;
