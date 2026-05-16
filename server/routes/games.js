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
    g.score_home_override, g.score_away_override,
    g.season_id,
    s.name AS season_name,
    COALESCE(g.score_home_override, (SELECT COUNT(*) FROM goals WHERE game_id = g.id AND team_id = g.home_team)) AS home_score,
    COALESCE(g.score_away_override, (SELECT COUNT(*) FROM goals WHERE game_id = g.id AND team_id = g.away_team)) AS away_score,
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
  LEFT JOIN seasons s ON s.id = g.season_id
  LEFT JOIN users cu ON cu.id = g.created_by
  LEFT JOIN users uu ON uu.id = g.updated_by
`;

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

// GET /api/games — optional ?season_id=, defaults to active season
router.get('/', wrap((req, res) => {
  let { season_id } = req.query;

  if (!season_id) {
    const active = db.prepare('SELECT id FROM seasons WHERE is_active = 1 LIMIT 1').get();
    if (active) season_id = active.id;
  }

  const where  = season_id ? 'WHERE g.season_id = ?' : '';
  const params = season_id ? [season_id] : [];
  const games  = db.prepare(`${GAME_SELECT} ${where} ORDER BY g.date DESC, g.id DESC`).all(...params);
  res.json(games.map(parseGame));
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

  const activeSeason = db.prepare('SELECT id FROM seasons WHERE is_active = 1 LIMIT 1').get();

  const { lastInsertRowid } = db
    .prepare(`INSERT INTO games
      (date, home_team, away_team, home_team_name, away_team_name, notes, status, season_id, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)`)
    .run(date, home_team, away_team, htName, atName, notes ?? null, activeSeason?.id ?? null, req.user.id, req.user.id);

  res.status(201).json(parseGame(stmtFindById.get(lastInsertRowid)));
}));

// GET /api/games/:id
router.get('/:id', wrap((req, res) => {
  const game = parseGame(stmtFindById.get(req.params.id));
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
}));

// ── Lineup / attendance / substitution helpers ────────────────────────────────

function getLineupRows(gameId) {
  return db.prepare(`
    SELECT gl.player_id, gl.position, p.name, p.jersey_number
    FROM game_lineup gl
    JOIN players p ON p.id = gl.player_id
    WHERE gl.game_id = ?
    ORDER BY CASE gl.position WHEN 'goalie' THEN 0 WHEN 'field' THEN 1 ELSE 2 END, p.jersey_number
  `).all(gameId);
}

function getAttendanceRows(gameId, myTeamId) {
  return db.prepare(`
    SELECT p.id AS player_id, p.name, p.jersey_number,
           COALESCE(a.is_present, 0)                    AS is_present,
           COALESCE(a.wants_extra_rest, 0)               AS wants_extra_rest,
           COALESCE(a.extra_rest_extension_minutes, 0)   AS extra_rest_extension_minutes
    FROM players p
    LEFT JOIN game_attendance a ON a.game_id = ? AND a.player_id = p.id
    WHERE p.team_id = ?
    ORDER BY p.jersey_number
  `).all(gameId, myTeamId).map(r => ({
    ...r,
    is_present:       r.is_present       === 1,
    wants_extra_rest: r.wants_extra_rest  === 1,
  }));
}

// GET /api/games/:id/attendance
router.get('/:id/attendance', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (!req.user.my_team_id) return res.status(400).json({ error: 'No team set' });
  res.json(getAttendanceRows(req.params.id, req.user.my_team_id));
}));

// POST /api/games/:id/attendance
router.post('/:id/attendance', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (!req.user.my_team_id) return res.status(400).json({ error: 'No team set' });

  const entries = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'Body must be an array' });

  const upsert = db.prepare(`
    INSERT INTO game_attendance (game_id, player_id, is_present, wants_extra_rest)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(game_id, player_id) DO UPDATE SET
      is_present       = excluded.is_present,
      wants_extra_rest = excluded.wants_extra_rest
  `);
  db.transaction(() => {
    for (const e of entries) {
      upsert.run(req.params.id, e.player_id, e.is_present ? 1 : 0, e.wants_extra_rest ? 1 : 0);
    }
  })();

  res.json(getAttendanceRows(req.params.id, req.user.my_team_id));
}));

// PATCH /api/games/:id/attendance/:player_id/extend-rest
router.patch('/:id/attendance/:player_id/extend-rest', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const existing = db.prepare(
    'SELECT id FROM game_attendance WHERE game_id = ? AND player_id = ?'
  ).get(req.params.id, req.params.player_id);

  if (existing) {
    db.prepare(`
      UPDATE game_attendance SET extra_rest_extension_minutes = extra_rest_extension_minutes + 1
      WHERE game_id = ? AND player_id = ?
    `).run(req.params.id, req.params.player_id);
  } else {
    db.prepare(`
      INSERT INTO game_attendance (game_id, player_id, is_present, wants_extra_rest, extra_rest_extension_minutes)
      VALUES (?, ?, 1, 0, 1)
    `).run(req.params.id, req.params.player_id);
  }

  const updated = db.prepare(
    'SELECT * FROM game_attendance WHERE game_id = ? AND player_id = ?'
  ).get(req.params.id, req.params.player_id);

  res.json({
    ...updated,
    is_present:       updated.is_present       === 1,
    wants_extra_rest: updated.wants_extra_rest  === 1,
  });
}));

// GET /api/games/:id/lineup
router.get('/:id/lineup', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(getLineupRows(req.params.id));
}));

// POST /api/games/:id/lineup
router.post('/:id/lineup', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const lineup = req.body;
  if (!Array.isArray(lineup)) return res.status(400).json({ error: 'Body must be an array' });

  const season = game.season_id
    ? db.prepare('SELECT squad_size FROM seasons WHERE id = ?').get(game.season_id)
    : null;
  const squadSize = season?.squad_size ?? null;

  const onField = lineup.filter(l => l.position === 'field' || l.position === 'goalie');
  const goalies = lineup.filter(l => l.position === 'goalie');

  if (squadSize !== null && onField.length !== squadSize)
    return res.status(400).json({
      error: `Must have exactly ${squadSize} players on field (including goalie), got ${onField.length}`,
    });

  if (goalies.length !== 1)
    return res.status(400).json({ error: `Must have exactly one goalie, got ${goalies.length}` });

  const upsert = db.prepare(`
    INSERT INTO game_lineup (game_id, player_id, position) VALUES (?, ?, ?)
    ON CONFLICT(game_id, player_id) DO UPDATE SET position = excluded.position
  `);
  db.prepare('DELETE FROM game_lineup WHERE game_id = ?').run(req.params.id);
  db.transaction(() => {
    for (const e of lineup) upsert.run(req.params.id, e.player_id, e.position);
  })();

  res.json(getLineupRows(req.params.id));
}));

// GET /api/games/:id/substitutions
router.get('/:id/substitutions', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const subs = db.prepare(`
    SELECT gs.*,
           pon.name  AS player_on_name,  pon.jersey_number  AS player_on_jersey,
           poff.name AS player_off_name, poff.jersey_number AS player_off_jersey
    FROM game_substitutions gs
    JOIN players pon  ON pon.id  = gs.player_on_id
    JOIN players poff ON poff.id = gs.player_off_id
    WHERE gs.game_id = ?
    ORDER BY gs.elapsed_seconds, gs.id
  `).all(req.params.id);

  res.json(subs.map(s => ({ ...s, is_goalie_swap: s.is_goalie_swap === 1 })));
}));

// POST /api/games/:id/substitution
router.post('/:id/substitution', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'live') return res.status(400).json({ error: 'Game is not live' });

  const { player_on_id, player_off_id, elapsed_seconds, is_goalie_swap = false } = req.body ?? {};
  if (!player_on_id || !player_off_id || elapsed_seconds == null)
    return res.status(400).json({ error: 'player_on_id, player_off_id, and elapsed_seconds are required' });

  const gameMinute = Math.floor(Number(elapsed_seconds) / 60) + 1;
  const half       = game.second_half_started_at ? 'second' : 'first';

  const offLineup = db.prepare(
    'SELECT position FROM game_lineup WHERE game_id = ? AND player_id = ?'
  ).get(req.params.id, player_off_id);
  const onPosition = is_goalie_swap ? 'goalie' : (offLineup?.position === 'goalie' ? 'field' : 'field');

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO game_substitutions
      (game_id, player_on_id, player_off_id, elapsed_seconds, game_minute, is_goalie_swap, half)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, player_on_id, player_off_id, elapsed_seconds, gameMinute, is_goalie_swap ? 1 : 0, half);

  db.prepare('UPDATE game_lineup SET position = ? WHERE game_id = ? AND player_id = ?')
    .run('bench', req.params.id, player_off_id);
  db.prepare('UPDATE game_lineup SET position = ? WHERE game_id = ? AND player_id = ?')
    .run(onPosition, req.params.id, player_on_id);

  const sub = db.prepare(`
    SELECT gs.*,
           pon.name  AS player_on_name,  pon.jersey_number  AS player_on_jersey,
           poff.name AS player_off_name, poff.jersey_number AS player_off_jersey
    FROM game_substitutions gs
    JOIN players pon  ON pon.id  = gs.player_on_id
    JOIN players poff ON poff.id = gs.player_off_id
    WHERE gs.id = ?
  `).get(lastInsertRowid);

  res.status(201).json({ ...sub, is_goalie_swap: sub.is_goalie_swap === 1 });
}));

// DELETE /api/games/:id/substitution/:sub_id
router.delete('/:id/substitution/:sub_id', requireAuth, wrap((req, res) => {
  const sub = db.prepare(
    'SELECT * FROM game_substitutions WHERE id = ? AND game_id = ?'
  ).get(req.params.sub_id, req.params.id);
  if (!sub) return res.status(404).json({ error: 'Substitution not found' });

  // Revert positions: player_off was field/goalie before, player_on was bench
  const prevOffPosition = sub.is_goalie_swap ? 'goalie' : 'field';
  db.prepare('UPDATE game_lineup SET position = ? WHERE game_id = ? AND player_id = ?')
    .run(prevOffPosition, req.params.id, sub.player_off_id);
  db.prepare('UPDATE game_lineup SET position = ? WHERE game_id = ? AND player_id = ?')
    .run('bench', req.params.id, sub.player_on_id);

  db.prepare('DELETE FROM game_substitutions WHERE id = ?').run(req.params.sub_id);
  res.json({ deleted: true, id: Number(req.params.sub_id) });
}));

// GET /api/games/:id/player-time
router.get('/:id/player-time', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (!req.user.my_team_id) return res.status(400).json({ error: 'No team set' });

  const currentElapsed    = parseInt(req.query.elapsed_seconds ?? '0', 10);
  const firstHalfDuration = game.first_half_duration_seconds ?? 0;
  const secondHalfStarted = !!game.second_half_started_at;

  const players = db.prepare(
    'SELECT id, name, jersey_number FROM players WHERE team_id = ? ORDER BY jersey_number'
  ).all(req.user.my_team_id);

  const lineupMap = Object.fromEntries(
    db.prepare('SELECT player_id, position FROM game_lineup WHERE game_id = ?')
      .all(req.params.id)
      .map(l => [l.player_id, l.position])
  );

  const subs = db.prepare(
    'SELECT * FROM game_substitutions WHERE game_id = ? ORDER BY elapsed_seconds, id'
  ).all(req.params.id);

  const attendanceMap = Object.fromEntries(
    db.prepare('SELECT player_id, wants_extra_rest, extra_rest_extension_minutes FROM game_attendance WHERE game_id = ?')
      .all(req.params.id)
      .map(a => [a.player_id, a])
  );

  const season = game.season_id
    ? db.prepare('SELECT preferred_rest_minutes FROM seasons WHERE id = ?').get(game.season_id)
    : null;
  const preferredRestMinutes = season?.preferred_rest_minutes ?? 5;

  // Build per-player state from initial lineup
  const pState = {};
  for (const p of players) {
    const pos = lineupMap[p.id];
    if (!pos) continue;
    pState[p.id] = {
      player_id: p.id, name: p.name, jersey_number: p.jersey_number,
      field_seconds: 0, bench_seconds: 0,
      swaps_count: 0, current_position: pos, last_change_at: 0,
    };
  }

  // Apply substitutions in order
  for (const sub of subs) {
    const off = pState[sub.player_off_id];
    const on  = pState[sub.player_on_id];
    if (off) {
      if (off.current_position === 'field' || off.current_position === 'goalie')
        off.field_seconds += Math.max(0, sub.elapsed_seconds - off.last_change_at);
      else
        off.bench_seconds += Math.max(0, sub.elapsed_seconds - off.last_change_at);
      off.last_change_at  = sub.elapsed_seconds;
      off.current_position = 'bench';
      off.swaps_count++;
    }
    if (on) {
      if (on.current_position === 'bench')
        on.bench_seconds += Math.max(0, sub.elapsed_seconds - on.last_change_at);
      else
        on.field_seconds += Math.max(0, sub.elapsed_seconds - on.last_change_at);
      on.last_change_at  = sub.elapsed_seconds;
      on.current_position = sub.is_goalie_swap ? 'goalie' : 'field';
      on.swaps_count++;
    }
  }

  const result = [];
  for (const s of Object.values(pState)) {
    const att              = attendanceMap[s.player_id] ?? {};
    const wantsExtraRest   = att.wants_extra_rest   ?? 0;
    const extensionMinutes = att.extra_rest_extension_minutes ?? 0;

    let fieldSec = s.field_seconds;
    let benchSec = s.bench_seconds;
    let benchSecCurrentStint = 0;

    if (s.current_position === 'field' || s.current_position === 'goalie') {
      fieldSec += Math.max(0, currentElapsed - s.last_change_at);
    } else {
      if (secondHalfStarted && s.last_change_at < firstHalfDuration) {
        const fhb = Math.max(0, firstHalfDuration - s.last_change_at);
        const shb = Math.max(0, currentElapsed - firstHalfDuration);
        benchSec += fhb + shb;
        benchSecCurrentStint = shb;
      } else {
        const curr = Math.max(0, currentElapsed - s.last_change_at);
        benchSec += curr;
        benchSecCurrentStint = curr;
      }
    }

    result.push({
      player_id:                  s.player_id,
      name:                       s.name,
      jersey_number:              s.jersey_number,
      minutes_on_field:           Math.floor(fieldSec / 60),
      minutes_on_bench:           Math.floor(benchSec / 60),
      field_seconds:              fieldSec,
      bench_seconds:              benchSec,
      swaps_count:                s.swaps_count,
      current_position:           s.current_position,
      bench_seconds_current_stint: benchSecCurrentStint,
      effective_rest_target_seconds: (preferredRestMinutes + extensionMinutes + (wantsExtraRest ? 2 : 0)) * 60,
      wants_extra_rest:           wantsExtraRest === 1,
    });
  }

  res.json(result);
}));

// GET /api/games/:id/share-text
router.get('/:id/share-text', requireAuth, wrap((req, res) => {
  const game = parseGame(stmtFindById.get(req.params.id));
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'complete')
    return res.status(400).json({ error: 'Game is not complete' });

  const { season_id } = db.prepare('SELECT season_id FROM games WHERE id = ?').get(req.params.id) ?? {};
  const season = season_id
    ? db.prepare('SELECT name FROM seasons WHERE id = ?').get(season_id)
    : null;

  const myTeamId      = req.user.my_team_id ?? null;
  const myIsHome      = game.home_team === myTeamId;
  const myName        = (myIsHome ? game.home_team_name : game.away_team_name) ?? 'Us';
  const oppName       = (myIsHome ? game.away_team_name : game.home_team_name) ?? 'Them';
  const myTeamActual  = myIsHome ? game.home_team : game.away_team;
  const oppTeamActual = myIsHome ? game.away_team : game.home_team;
  const myScore       = myIsHome ? game.home_score : game.away_score;
  const oppScore      = myIsHome ? game.away_score : game.home_score;

  const myGoals  = (game.goals ?? []).filter(g => g.team_id === myTeamActual);
  const oppGoals = (game.goals ?? []).filter(g => g.team_id === oppTeamActual);

  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [yr, mo, dy] = game.date.split('-').map(Number);
  const dateStr = `${DAYS[new Date(yr, mo - 1, dy).getDay()]} ${dy} ${MONTHS[mo - 1]} ${yr}`;

  function abbrev(name) {
    if (!name) return 'Unknown';
    const parts = name.trim().split(/\s+/);
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }

  const SEP      = '─────────────────';
  const awayTag  = (myTeamId && !myIsHome) ? ' (Away)' : '';
  const scoreLine = `${myName}${awayTag} ${myScore} — ${oppScore} ${oppName}`;

  let text = `⚽ MATCHDAY RESULT\n${SEP}\n${scoreLine}\n📅 ${dateStr}`;
  if (season?.name) text += `\n🏁 ${season.name}`;

  text += '\n\n⚽ GOALS';
  if (myGoals.length > 0) {
    text += `\n${myName}:`;
    myGoals.forEach(g => { text += `\n  ${abbrev(g.player_name)} ${g.minute}'`; });
  } else {
    text += `\nNo goals scored by ${myName}`;
  }
  text += '\n';
  if (oppGoals.length > 0) {
    text += `\n${oppName}:`;
    oppGoals.forEach(g => { text += `\n  ${abbrev(g.player_name)} ${g.minute}'`; });
  } else {
    text += `\nNo goals scored by ${oppName}`;
  }

  if (game.player_of_game?.player_name) {
    text += `\n\n🏆 PLAYER OF THE GAME\n${abbrev(game.player_of_game.player_name)}`;
  }

  const squadRows = db.prepare(`
    SELECT p.name FROM players p
    JOIN game_attendance a ON a.player_id = p.id
    WHERE a.game_id = ? AND a.is_present = 1
    ORDER BY p.jersey_number
  `).all(req.params.id);

  if (squadRows.length > 0) {
    text += `\n\n👥 SQUAD (${squadRows.length} players)\n${SEP}\n`;
    text += squadRows.map(p => p.name).join('\n');
  }

  text += `\n\n${SEP}\nPowered by Matchday`;

  res.json({ text });
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

// PATCH /api/games/:id/score  — manual score override (null clears override)
router.patch('/:id/score', requireAuth, wrap((req, res) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { home_score, away_score } = req.body ?? {};
  const homeOverride = home_score != null ? Number(home_score) : null;
  const awayOverride = away_score != null ? Number(away_score) : null;

  if (homeOverride !== null && (!Number.isInteger(homeOverride) || homeOverride < 0))
    return res.status(400).json({ error: 'home_score must be a non-negative integer' });
  if (awayOverride !== null && (!Number.isInteger(awayOverride) || awayOverride < 0))
    return res.status(400).json({ error: 'away_score must be a non-negative integer' });

  db.prepare('UPDATE games SET score_home_override=?, score_away_override=?, updated_by=? WHERE id=?')
    .run(homeOverride, awayOverride, req.user.id, req.params.id);

  res.json(parseGame(stmtFindById.get(req.params.id)));
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
