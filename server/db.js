const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'matchday.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT    NOT NULL,
    season  TEXT    NOT NULL
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
`);

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM teams').get();
  if (existing.count > 0) return;

  const insertTeam = db.prepare('INSERT INTO teams (name, season) VALUES (?, ?)');
  const { lastInsertRowid: teamId } = insertTeam.run('Thunder FC', '2024');

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
  console.log(`Seeded team "Thunder FC" (id=${teamId}) with ${players.length} players.`);
}

seed();

module.exports = db;
