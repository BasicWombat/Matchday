# Matchday — Kids Soccer Tracker

A full-stack web app for tracking kids' soccer teams. Log game results, record goal scorers, award Player of the Game, and view season stats — all in a clean, mobile-friendly interface.

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Backend   | Node.js · Express · SQLite (better-sqlite3) |
| Frontend  | React 18 · Vite · Tailwind CSS v3 |
| Fonts     | Bebas Neue (headings) · DM Sans (body) |
| Database  | SQLite file — no separate DB server needed |

---

## Installation

### Prerequisites

Node.js **v18 or later** is required. Install via [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or restart your terminal
nvm install 20
```

### Install dependencies

```bash
cd soccer-tracker
npm install                    # root (concurrently)
npm install --prefix server    # Express + SQLite
npm install --prefix client    # React + Vite + Tailwind
```

---

## Development

Start both servers with a single command:

```bash
npm run dev
```

| Service     | URL                        |
|-------------|---------------------------|
| React app   | http://localhost:5173      |
| Express API | http://localhost:3001/api  |

The Vite dev server proxies `/api` requests to Express, so there are no CORS issues.

On first start the database is seeded automatically with a **Thunder FC** team and 11 players.

---

## Production

### 1. Build the frontend

```bash
npm run build --prefix client
```

This outputs optimised static files to `client/dist/`.

### 2. Run the server

```bash
NODE_ENV=production node server/index.js
```

The Express server will:
- Serve the built React app from `client/dist/`
- Handle all `/api/*` routes
- Fall back to `index.html` for any other path (client-side routing)

Visit **http://localhost:3001** (or the configured `PORT`).

### Environment variables

| Variable    | Default | Description |
|-------------|---------|-------------|
| `PORT`      | `3001`  | Port the Express server listens on |
| `NODE_ENV`  | —       | Set to `production` to enable static file serving |

---

## Project Structure

```
soccer-tracker/
├── package.json             # root — concurrently dev script
├── server/
│   ├── index.js             # Express entry point
│   ├── db.js                # SQLite setup + seed
│   ├── lib/wrap.js          # sync error wrapper for better-sqlite3
│   └── routes/
│       ├── teams.js
│       ├── players.js
│       ├── games.js
│       ├── goals.js
│       ├── playerOfGame.js
│       └── stats.js
└── client/
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── api.js           # centralised fetch wrapper
        ├── App.jsx
        ├── components/
        │   ├── Layout.jsx   # sidebar (desktop) + bottom nav (mobile)
        │   ├── Toast.jsx    # toast notification context
        │   └── ui.jsx       # shared components (Btn, Spinner, etc.)
        └── pages/
            ├── Dashboard.jsx
            ├── GamesList.jsx
            ├── GameForm.jsx
            ├── GameDetail.jsx
            ├── Players.jsx
            └── Stats.jsx
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | List all teams |
| POST | `/api/teams` | Create a team |
| GET | `/api/teams/:id` | Team detail with players |
| GET | `/api/players` | List players (optional `?team_id=`) |
| POST | `/api/players` | Add a player |
| DELETE | `/api/players/:id` | Remove a player |
| GET | `/api/games` | List all games (with goals + POTG embedded) |
| POST | `/api/games` | Create a game |
| GET | `/api/games/:id` | Game detail |
| PUT | `/api/games/:id` | Update a game |
| DELETE | `/api/games/:id` | Delete a game |
| POST | `/api/goals` | Record a goal |
| DELETE | `/api/goals/:id` | Remove a goal |
| POST | `/api/player-of-game` | Set / update POTG for a game |
| GET | `/api/stats/top-scorers` | Goal scorer leaderboard |
| GET | `/api/stats/player-of-game-count` | POTG award leaderboard |
| GET | `/api/health` | Database row counts |

---

## Screenshots

_Coming soon_
