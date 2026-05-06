const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'matchday.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    season      TEXT    NOT NULL DEFAULT '',
    is_my_team  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS players (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    team_id        INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    jersey_number  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS games (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL,
    home_team   INTEGER NOT NULL REFERENCES teams(id),
    away_team   INTEGER NOT NULL REFERENCES teams(id),
    home_score  INTEGER NOT NULL DEFAULT 0,
    away_score  INTEGER NOT NULL DEFAULT 0,
    notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS goals (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id   INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    minute    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS player_of_game (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id   INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    display_name  TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'member',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: add is_my_team column to existing databases
const teamCols = db.pragma('table_info(teams)');
if (!teamCols.some(c => c.name === 'is_my_team')) {
  db.exec('ALTER TABLE teams ADD COLUMN is_my_team INTEGER NOT NULL DEFAULT 0');
  const first = db.prepare('SELECT id FROM teams ORDER BY id LIMIT 1').get();
  if (first) db.prepare('UPDATE teams SET is_my_team = 1 WHERE id = ?').run(first.id);
}

// Migration: add team name snapshot columns to games and make team FKs nullable
// (so deleting a team preserves historical game records)
const gameCols = db.pragma('table_info(games)');
if (!gameCols.some(c => c.name === 'home_team_name')) {
  db.pragma('foreign_keys = OFF');
  // legacy_alter_table keeps child-table FK references pointing to "games" (not "games_old")
  db.pragma('legacy_alter_table = ON');
  db.exec(`
    ALTER TABLE games RENAME TO games_old;

    CREATE TABLE games (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      date           TEXT    NOT NULL,
      home_team      INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      away_team      INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      home_team_name TEXT,
      away_team_name TEXT,
      home_score     INTEGER NOT NULL DEFAULT 0,
      away_score     INTEGER NOT NULL DEFAULT 0,
      notes          TEXT
    );

    INSERT INTO games (id, date, home_team, away_team, home_team_name, away_team_name, home_score, away_score, notes)
    SELECT g.id, g.date, g.home_team, g.away_team,
           ht.name, at.name, g.home_score, g.away_score, g.notes
    FROM games_old g
    JOIN teams ht ON ht.id = g.home_team
    JOIN teams at ON at.id = g.away_team;

    DROP TABLE games_old;
  `);
  db.pragma('legacy_alter_table = OFF');
  db.pragma('foreign_keys = ON');
}

// Migration: add created_by / updated_by to games
const gameColNames = db.pragma('table_info(games)').map(c => c.name);
if (!gameColNames.includes('created_by'))
  db.exec('ALTER TABLE games ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
if (!gameColNames.includes('updated_by'))
  db.exec('ALTER TABLE games ADD COLUMN updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL');

// Migration: add created_by to goals
const goalColNames = db.pragma('table_info(goals)').map(c => c.name);
if (!goalColNames.includes('created_by'))
  db.exec('ALTER TABLE goals ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL');

// Migration: add created_by to player_of_game
const pogColNames = db.pragma('table_info(player_of_game)').map(c => c.name);
if (!pogColNames.includes('created_by'))
  db.exec('ALTER TABLE player_of_game ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL');

// Migration: add my_team_id to users (per-account My Team preference)
const userCols = db.pragma('table_info(users)').map(c => c.name);
if (!userCols.includes('my_team_id')) {
  db.exec('ALTER TABLE users ADD COLUMN my_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL');
  const myTeam = db.prepare('SELECT id FROM teams WHERE is_my_team = 1 LIMIT 1').get();
  if (myTeam) db.prepare('UPDATE users SET my_team_id = ?').run(myTeam.id);
}

// Migration: add live match tracking columns to games
const liveGameCols = db.pragma('table_info(games)').map(c => c.name);
if (!liveGameCols.includes('status')) {
  db.exec(`ALTER TABLE games ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'`);
  db.exec(`ALTER TABLE games ADD COLUMN started_at TEXT`);
  db.exec(`ALTER TABLE games ADD COLUMN first_half_duration_seconds INTEGER`);
  db.exec(`ALTER TABLE games ADD COLUMN second_half_started_at TEXT`);
  db.exec(`ALTER TABLE games ADD COLUMN completed_at TEXT`);
}

// Migration: rebuild goals table for live tracking
// Adds team_id (for opponent goals), makes player_id nullable, replaces minute with elapsed_seconds + display_minute
const liveGoalCols = db.pragma('table_info(goals)').map(c => c.name);
if (!liveGoalCols.includes('elapsed_seconds')) {
  db.pragma('foreign_keys = OFF');
  db.pragma('legacy_alter_table = ON');
  db.exec(`
    ALTER TABLE goals RENAME TO goals_old;

    CREATE TABLE goals (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id          INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      team_id          INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      player_id        INTEGER REFERENCES players(id) ON DELETE SET NULL,
      elapsed_seconds  INTEGER NOT NULL DEFAULT 0,
      display_minute   INTEGER NOT NULL DEFAULT 0,
      created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    INSERT INTO goals (id, game_id, team_id, player_id, elapsed_seconds, display_minute, created_by)
    SELECT go.id, go.game_id, p.team_id, go.player_id,
           go.minute * 60, go.minute, go.created_by
    FROM goals_old go
    LEFT JOIN players p ON p.id = go.player_id;

    DROP TABLE goals_old;
  `);
  db.pragma('legacy_alter_table = OFF');
  db.pragma('foreign_keys = ON');
}

function seedAdmin() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (existing.count > 0) return;
  const hash = bcrypt.hashSync('matchday123', 10);
  db.prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('admin', 'Admin', hash, 'admin');
  console.log('Seeded default admin user (admin / matchday123)');
}
seedAdmin();

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM teams').get();
  if (existing.count > 0) return;

  const insertTeam = db.prepare('INSERT INTO teams (name, season, is_my_team) VALUES (?, ?, ?)');
  const { lastInsertRowid: teamId } = insertTeam.run('Thunder FC', '2024', 1);

  const players = [
    { name: 'Liam Torres',    jersey: 1  },
    { name: 'Noah Patel',     jersey: 2  },
    { name: 'Ethan Okafor',   jersey: 3  },
    { name: 'Aiden Nguyen',   jersey: 4  },
    { name: 'Lucas Martínez', jersey: 5  },
    { name: 'Mason Chen',     jersey: 6  },
    { name: 'Elijah Brooks',  jersey: 7  },
    { name: 'James Kim',      jersey: 8  },
    { name: 'Oliver Singh',   jersey: 9  },
    { name: 'Caleb Ali',      jersey: 10 },
    { name: 'Ryan O\'Brien',  jersey: 11 },
  ];

  const insertPlayer = db.prepare(
    'INSERT INTO players (name, team_id, jersey_number) VALUES (?, ?, ?)'
  );

  const seedAll = db.transaction(() => {
    for (const p of players) {
      insertPlayer.run(p.name, teamId, p.jersey);
    }
  });

  seedAll();
  // Give admin their my_team_id if not set yet
  db.prepare('UPDATE users SET my_team_id = ? WHERE my_team_id IS NULL').run(teamId);
  console.log(`Seeded team "Thunder FC" (id=${teamId}) with ${players.length} players.`);
}

seed();

module.exports = db;
