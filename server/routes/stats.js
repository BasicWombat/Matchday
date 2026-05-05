const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');

// GET /api/stats/top-scorers?team_id=X&season=X
// Returns every player with their goal count, ranked descending.
// Both filters are optional and can be combined.
router.get('/top-scorers', wrap((req, res) => {
  const { team_id, season } = req.query;
  const conditions = [];
  const params = [];

  if (team_id) { conditions.push('p.team_id = ?'); params.push(team_id); }
  if (season)  { conditions.push('t.season = ?');  params.push(season);  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.jersey_number,
      p.team_id,
      t.name   AS team_name,
      t.season,
      COUNT(go.id) AS goals
    FROM   players p
    JOIN   teams t  ON t.id = p.team_id
    LEFT JOIN goals go ON go.player_id = p.id
    ${where}
    GROUP  BY p.id
    ORDER  BY goals DESC, p.name ASC
  `).all(...params);

  res.json(rows);
}));

// GET /api/stats/player-of-game-count?team_id=X
// Returns every player with their player-of-game award count, ranked descending.
router.get('/player-of-game-count', wrap((req, res) => {
  const { team_id } = req.query;
  const conditions = [];
  const params = [];

  if (team_id) { conditions.push('p.team_id = ?'); params.push(team_id); }

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
    JOIN   teams t ON t.id = p.team_id
    LEFT JOIN player_of_game pg ON pg.player_id = p.id
    ${where}
    GROUP  BY p.id
    ORDER  BY awards DESC, p.name ASC
  `).all(...params);

  res.json(rows);
}));

module.exports = router;
