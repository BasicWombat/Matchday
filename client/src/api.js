const BASE = '';

async function req(path, opts = {}) {
  const token = localStorage.getItem('matchday_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Auth
  login:      (d)      => req('/api/auth/login', { method: 'POST', body: JSON.stringify(d) }),
  logout:     ()       => req('/api/auth/logout', { method: 'POST' }),
  getMe:      ()       => req('/api/auth/me'),

  // Users
  getUsers:   ()       => req('/api/users'),
  createUser: (d)      => req('/api/users', { method: 'POST', body: JSON.stringify(d) }),
  updateUser: (id, d)  => req(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteUser: (id)     => req(`/api/users/${id}`, { method: 'DELETE' }),

  // Teams
  getTeams:     ()       => req('/api/teams'),
  getTeam:      (id)     => req(`/api/teams/${id}`),
  createTeam:   (d)      => req('/api/teams', { method: 'POST', body: JSON.stringify(d) }),
  updateTeam:   (id, d)  => req(`/api/teams/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteTeam:   (id)     => req(`/api/teams/${id}`, { method: 'DELETE' }),
  setMyTeam:    (id)     => req(`/api/teams/${id}/set-my-team`, { method: 'PUT' }),

  // Players
  getPlayers:   (teamId) => req(`/api/players${teamId ? `?team_id=${teamId}` : ''}`),
  createPlayer: (d)      => req('/api/players', { method: 'POST', body: JSON.stringify(d) }),
  deletePlayer: (id)     => req(`/api/players/${id}`, { method: 'DELETE' }),

  // Seasons
  getSeasons:      ()       => req('/api/seasons'),
  createSeason:    (d)      => req('/api/seasons', { method: 'POST', body: JSON.stringify(d) }),
  updateSeason:    (id, d)  => req(`/api/seasons/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  setActiveSeason: (id)     => req(`/api/seasons/${id}/set-active`, { method: 'PUT' }),
  deleteSeason:    (id)     => req(`/api/seasons/${id}`, { method: 'DELETE' }),

  // Games
  getGames:     (params) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return req(`/api/games${q}`);
  },
  getGame:      (id)     => req(`/api/games/${id}`),
  createGame:   (d)      => req('/api/games', { method: 'POST', body: JSON.stringify(d) }),
  updateGame:   (id, d)  => req(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteGame:   (id)     => req(`/api/games/${id}`, { method: 'DELETE' }),

  // Manual score override — pass null values to clear
  setScore:     (id, d)  => req(`/api/games/${id}/score`, { method: 'PATCH', body: JSON.stringify(d) }),

  // Share text (formatted, server-built)
  getShareText: (id)     => req(`/api/games/${id}/share-text`),

  // Game state transitions
  startGame:    (id)     => req(`/api/games/${id}/start`,    { method: 'PATCH' }),
  halftimeGame: (id)     => req(`/api/games/${id}/halftime`, { method: 'PATCH' }),
  restartGame:  (id)     => req(`/api/games/${id}/restart`,  { method: 'PATCH' }),
  fulltimeGame: (id)     => req(`/api/games/${id}/fulltime`, { method: 'PATCH' }),
  reopenGame:   (id)     => req(`/api/games/${id}/reopen`,   { method: 'PATCH' }),

  // Goals — payload: { game_id, team_id, elapsed_seconds, player_id? }
  createGoal:   (d)      => req('/api/goals', { method: 'POST', body: JSON.stringify(d) }),
  deleteGoal:   (id)     => req(`/api/goals/${id}`, { method: 'DELETE' }),

  // Player of the Game
  setPlayerOfGame: (d)   => req('/api/player-of-game', { method: 'POST', body: JSON.stringify(d) }),

  // Stats
  getTopScorers: (params) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return req(`/api/stats/top-scorers${q}`);
  },
  getPotgCount:  (params) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return req(`/api/stats/player-of-game-count${q}`);
  },
};

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function getResult(game, primaryTeamId) {
  if (!primaryTeamId) return null;
  // Only show W/L/D for finished games
  if (game.status && game.status !== 'complete') return null;
  const isHome = game.home_team === primaryTeamId;
  const ours   = isHome ? game.home_score : game.away_score;
  const theirs = isHome ? game.away_score : game.home_score;
  if (ours > theirs) return 'W';
  if (ours < theirs) return 'L';
  return 'D';
}
