const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');

function resolveSeasonId(season_id) {
  if (season_id) return season_id;
  return db.prepare('SELECT id FROM seasons WHERE is_active = 1 LIMIT 1').get()?.id ?? null;
}

// GET /api/stats/top-scorers?team_id=X&season_id=X
router.get('/top-scorers', wrap((req, res) => {
  const { team_id } = req.query;
  const season_id   = resolveSeasonId(req.query.season_id);

  const conditions = [];
  const params     = [];

  if (team_id)   { conditions.push('p.team_id = ?');    params.push(team_id); }
  if (season_id) { conditions.push('ga.season_id = ?'); params.push(season_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.jersey_number,
      p.team_id,
      t.name AS team_name,
      COUNT(go.id) AS goals
    FROM   players p
    JOIN   teams t   ON t.id  = p.team_id
    LEFT JOIN goals go ON go.player_id = p.id
    LEFT JOIN games ga ON ga.id = go.game_id
    ${where}
    GROUP  BY p.id
    ORDER  BY goals DESC, p.name ASC
  `).all(...params);

  res.json(rows);
}));

// GET /api/stats/player-of-game-count?team_id=X&season_id=X
router.get('/player-of-game-count', wrap((req, res) => {
  const { team_id } = req.query;
  const season_id   = resolveSeasonId(req.query.season_id);

  const conditions = [];
  const params     = [];

  if (team_id)   { conditions.push('p.team_id = ?');    params.push(team_id); }
  if (season_id) { conditions.push('ga.season_id = ?'); params.push(season_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.jersey_number,
      p.team_id,
      t.name AS team_name,
      COUNT(pg.id) AS awards
    FROM   players p
    JOIN   teams t  ON t.id = p.team_id
    LEFT JOIN player_of_game pg ON pg.player_id = p.id
    LEFT JOIN games ga ON ga.id = pg.game_id
    ${where}
    GROUP  BY p.id
    ORDER  BY awards DESC, p.name ASC
  `).all(...params);

  res.json(rows);
}));

module.exports = router;
