const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');
const { requireAuth } = require('../lib/auth');

// ── Shared SQL ────────────────────────────────────────────────────────────────

const GAME_SELECT = `
  SELECT
    g.id, g.date, g.home_team, g.away_team,
    COALESCE(ht.name, g.home_team_name) AS home_team_name,
    COALESCE(at.name, g.away_team_name) AS away_team_name,
    g.notes, g.created_by, g.updated_by,
    g.status, g.started_at, g.first_half_duration_seconds,
    g.second_half_started_at, g.completed_at,
    (SELECT COUNT(*) FROM goals WHERE game_id = g.id AND team_id = g.home_team) AS home_score,
    (SELECT COUNT(*) FROM goals WHERE game_id = g.id AND team_id = g.away_team) AS away_score,
    cu.display_name AS created_by_name,
    uu.display_name AS updated_by_name,
    (
      SELECT json_group_array(json_object(
        'id',              sub.id,
        'player_id',       sub.player_id,
        'team_id',         sub.team_id,
        'player_name',     sub.player_name,
        'jersey_number',   sub.jersey_number,
        'minute',          sub.display_minute,
        'elapsed_seconds', sub.elapsed_seconds,
        'created_by_name', sub.created_by_name
      ))
      FROM (
        SELECT go.id, go.player_id, go.team_id, p.name AS player_name, p.jersey_number,
               go.display_minute, go.elapsed_seconds,
               gu.display_name AS created_by_name
        FROM   goals go
        LEFT JOIN players p ON p.id = go.player_id
        LEFT JOIN users gu ON gu.id = go.created_by
        WHERE  go.game_id = g.id
        ORDER  BY go.elapsed_seconds
      ) sub
    ) AS goals,
    (
      SELECT json_object(
        'id',              pg.id,
        'player_id',       pg.player_id,
        'player_name',     p2.name,
        'jersey_number',   p2.jersey_number,
        'created_by_name', pu.display_name
      )
      FROM player_of_game pg
      JOIN players p2 ON p2.id = pg.player_id
      LEFT JOIN users pu ON pu.id = pg.created_by
      WHERE pg.game_id = g.id
    ) AS player_of_game
  FROM games g
  LEFT JOIN teams ht ON ht.id = g.home_team
  LEFT JOIN teams at ON at.id = g.away_team
  LEFT JOIN users cu ON cu.id = g.created_by
  LEFT JOIN users uu ON uu.id = g.updated_by
`;

const stmtFindAll  = db.prepare(`${GAME_SELECT} ORDER BY g.date DESC, g.id DESC`);
const stmtFindById = db.prepare(`${GAME_SELECT} WHERE g.id = ?`);

function computeElapsedSeconds(game) {
  const now = Math.floor(Date.now() / 1000);
  const status = game.status ?? 'complete';
  if (status === 'scheduled') return null;
  if (status === 'halftime') return game.first_half_duration_seconds ?? 0;
  if (status === 'complete') {
    if (game.completed_at && game.second_half_started_at) {
      const sh  = Math.floor(new Date(game.second_half_started_at).getTime() / 1000);
      const end = Math.floor(new Date(game.completed_at).getTime() / 1000);
      return (game.first_half_duration_seconds ?? 0) + (end - sh);
    }
    if (game.completed_at && game.started_at) {
      const start = Math.floor(new Date(game.started_at).getTime() / 1000);
      const end   = Math.floor(new Date(game.completed_at).getTime() / 1000);
      return end - start;
    }
    return null;
  }
  // live
  if (!game.started_at) return 0;
  if (!game.second_half_started_at) {
    return now - Math.floor(new Date(game.started_at).getTime() / 1000);
  }
  const sh = Math.floor(new Date(game.second_half_started_at).getTime() / 1000);
  return (game.first_half_duration_seconds ?? 0) + (now - sh);
}

function parseGame(row) {
  if (!row) return null;
  row.goals = typeof row.goals === 'string' ? JSON.parse(row.goals) : (row.goals ?? []);
  row.player_of_game = typeof row.player_of_game === 'string'
    ? JSON.parse(row.player_of_game)
    : (row.player_of_game ?? null);
  row.elapsed_seconds = computeElapsedSeconds(row);
  return row;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/games
router.get('/', wrap((req, res) => {
  res.json(stmtFindAll.all().map(parseGame));
}));

// POST /api/games
router.post('/', requireAuth, wrap((req, res) => {
  let { date, home_team, away_team, notes } = req.body ?? {};

  if (!home_team && req.user.my_team_id) home_team = req.user.my_team_id;

  if (!date || !home_team || !away_team)
    return res.status(400).json({ error: 'date, home_team, and away_team are required' });

  if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(home_team))
    return res.status(404).json({ error: 'home_team not found' });
  if (!db.prepare('SELECT id FROM teams WHERE id = ?').get(away_team))
    return res.status(404).json({ error: 'away_team not found' });

  const htName = db.prepare('SELECT name FROM teams WHERE id = ?').get(home_team)?.name ?? '';
  const atName = db.prepare('SELECT name FROM teams WHERE id = ?').get(away_team)?.name ?? '';

  const { lastInsertRowid } = db
    .prepare(`INSERT INTO games
      (date, home_team, away_team, home_team_name, away_team_name, notes, status, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)`)
    .run(date, home_team, away_team, htName, atName, notes ?? null, req.user.id, req.user.id);

  res.status(201).json(parseGame(stmtFindById.get(lastInsertRowid)));
}));

// GET /api/games/:id
router.get('/:id', wrap((req, res) => {
  const game = parseGame(stmtFindById.get(req.params.id));
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
}));

// PUT /api/games/:id  — edit date, teams, notes only
router.put('/:id', requireAuth, wrap((req, res) => {
  const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found' });

  const {
    date      = existing.date,
    home_team = existing.home_team,
    away_team = existing.away_team,
    notes     = existing.notes,
  } = req.body ?? {};

  if (home_team !== existing.home_team && !db.prepare('SELECT id FROM teams WHERE id = ?').get(home_team))
    return res.status(404).json({ error: 'home_team not found' });
  if (away_team !== existing.away_team && !db.prepare('SELECT id FROM teams WHERE id = ?').get(away_team))
    return res.status(404).json({ error: 'away_team not found' });

  const htName = db.prepare('SELECT name FROM teams WHERE id = ?').get(home_team)?.name ?? existing.home_team_name ?? '';
  const atName = db.prepare('SELECT name FROM teams WHERE id = ?').get(away_team)?.name ?? existing.away_team_name ?? '';

  db.prepare(`
    UPDATE games SET date=?, home_team=?, away_team=?, home_team_name=?, away_team_name=?, notes=?, updated_by=?
    WHERE id=?
  `).run(date, home_team, away_team, htName, atName, notes ?? null, req.user.id, req.params.id);

  res.json(parseGame(stmtFindById.get(req.params.id)));
}));

// DELETE /api/games/:id
router.delete('/:id', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, id: Number(req.params.id) });
}));

// ── Game state transitions ────────────────────────────────────────────────────

// PATCH /api/games/:id/start
router.patch('/:id/start', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id, status FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'scheduled') return res.status(400).json({ error: 'Game is not scheduled' });

  db.prepare(`UPDATE games SET status='live', started_at=datetime('now'), updated_by=? WHERE id=?`)
    .run(req.user.id, req.params.id);
  res.json(parseGame(stmtFindById.get(req.params.id)));
}));

// PATCH /api/games/:id/halftime
router.patch('/:id/halftime', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id, status, started_at FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'live') return res.status(400).json({ error: 'Game is not live' });

  const firstHalfDuration = Math.floor(
    (Date.now() - new Date(game.started_at).getTime()) / 1000
  );

  db.prepare(`UPDATE games SET status='halftime', first_half_duration_seconds=?, updated_by=? WHERE id=?`)
    .run(firstHalfDuration, req.user.id, req.params.id);
  res.json(parseGame(stmtFindById.get(req.params.id)));
}));

// PATCH /api/games/:id/restart  — start second half
router.patch('/:id/restart', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id, status FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'halftime') return res.status(400).json({ error: 'Game is not at halftime' });

  db.prepare(`UPDATE games SET status='live', second_half_started_at=datetime('now'), updated_by=? WHERE id=?`)
    .run(req.user.id, req.params.id);
  res.json(parseGame(stmtFindById.get(req.params.id)));
}));

// PATCH /api/games/:id/fulltime
router.patch('/:id/fulltime', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id, status FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'live') return res.status(400).json({ error: 'Game is not live' });

  db.prepare(`UPDATE games SET status='complete', completed_at=datetime('now'), updated_by=? WHERE id=?`)
    .run(req.user.id, req.params.id);
  res.json(parseGame(stmtFindById.get(req.params.id)));
}));

// PATCH /api/games/:id/reopen  — admin only
router.patch('/:id/reopen', requireAuth, wrap((req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const game = db.prepare('SELECT id, status FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'complete') return res.status(400).json({ error: 'Game is not complete' });

  db.prepare(`UPDATE games SET status='live', completed_at=NULL, updated_by=? WHERE id=?`)
    .run(req.user.id, req.params.id);
  res.json(parseGame(stmtFindById.get(req.params.id)));
}));

module.exports = router;
