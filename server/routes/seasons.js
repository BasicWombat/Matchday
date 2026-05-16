const router = require('express').Router();
const db = require('../db');
const wrap = require('../lib/wrap');
const { requireAuth, requireAdmin } = require('../lib/auth');

function seasonWithCount(id) {
  return db.prepare(`
    SELECT s.*, COUNT(g.id) AS game_count
    FROM seasons s
    LEFT JOIN games g ON g.season_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `).get(id);
}

function allSeasons() {
  return db.prepare(`
    SELECT s.*, COUNT(g.id) AS game_count
    FROM seasons s
    LEFT JOIN games g ON g.season_id = s.id
    GROUP BY s.id
    ORDER BY s.id DESC
  `).all();
}

// GET /api/seasons
router.get('/', wrap((req, res) => {
  res.json(allSeasons());
}));

// POST /api/seasons — admin only
router.post('/', requireAdmin, wrap((req, res) => {
  const { name, year } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const parsedYear = year ? parseInt(year, 10) : null;

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO seasons (name, year, is_active) VALUES (?, ?, 0)'
  ).run(name.trim(), parsedYear || null);

  res.status(201).json(seasonWithCount(lastInsertRowid));
}));

// PUT /api/seasons/:id — admin only
router.put('/:id', requireAdmin, wrap((req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  const {
    name                 = season.name,
    year                 = season.year,
    squad_size           = season.squad_size,
    preferred_rest_minutes = season.preferred_rest_minutes,
    max_rest_minutes     = season.max_rest_minutes,
  } = req.body ?? {};

  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const parsedYear         = year                  ? parseInt(year, 10)                  : null;
  const parsedSquadSize    = squad_size             ? parseInt(squad_size, 10)            : null;
  const parsedPreferredRest = preferred_rest_minutes ? parseInt(preferred_rest_minutes, 10) : null;
  const parsedMaxRest      = max_rest_minutes       ? parseInt(max_rest_minutes, 10)      : null;

  db.prepare(`
    UPDATE seasons
    SET name = ?, year = ?, squad_size = ?, preferred_rest_minutes = ?, max_rest_minutes = ?
    WHERE id = ?
  `).run(
    name.trim(), parsedYear || null, parsedSquadSize || null,
    parsedPreferredRest || null, parsedMaxRest || null,
    req.params.id,
  );

  res.json(seasonWithCount(req.params.id));
}));

// PUT /api/seasons/:id/set-active — admin only
router.put('/:id/set-active', requireAdmin, wrap((req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  db.prepare('UPDATE seasons SET is_active = 0').run();
  db.prepare('UPDATE seasons SET is_active = 1 WHERE id = ?').run(req.params.id);

  res.json(allSeasons());
}));

// DELETE /api/seasons/:id — admin only
router.delete('/:id', requireAdmin, wrap((req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Season not found' });
  if (season.is_active)
    return res.status(400).json({ error: 'Cannot delete the active season' });

  const gameCount = db.prepare('SELECT COUNT(*) AS c FROM games WHERE season_id = ?')
    .get(req.params.id).c;
  if (gameCount > 0)
    return res.status(400).json({
      error: `Cannot delete: ${gameCount} game${gameCount !== 1 ? 's' : ''} attached to this season`,
    });

  db.prepare('DELETE FROM seasons WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, id: Number(req.params.id) });
}));

module.exports = router;
