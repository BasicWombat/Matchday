const BASE = '';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Teams
  getTeams:     ()       => req('/api/teams'),
  getTeam:      (id)     => req(`/api/teams/${id}`),
  createTeam:   (d)      => req('/api/teams', { method: 'POST', body: JSON.stringify(d) }),

  // Players
  getPlayers:   (teamId) => req(`/api/players${teamId ? `?team_id=${teamId}` : ''}`),
  createPlayer: (d)      => req('/api/players', { method: 'POST', body: JSON.stringify(d) }),
  deletePlayer: (id)     => req(`/api/players/${id}`, { method: 'DELETE' }),

  // Games
  getGames:     ()       => req('/api/games'),
  getGame:      (id)     => req(`/api/games/${id}`),
  createGame:   (d)      => req('/api/games', { method: 'POST', body: JSON.stringify(d) }),
  updateGame:   (id, d)  => req(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteGame:   (id)     => req(`/api/games/${id}`, { method: 'DELETE' }),

  // Goals
  createGoal:   (d)      => req('/api/goals', { method: 'POST', body: JSON.stringify(d) }),
  deleteGoal:   (id)     => req(`/api/goals/${id}`, { method: 'DELETE' }),

  // Player of the Game
  setPlayerOfGame: (d)   => req('/api/player-of-game', { method: 'POST', body: JSON.stringify(d) }),

  // Stats
  getTopScorers: (params) => {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    return req(`/api/stats/top-scorers${q}`);
  },
  getPotgCount: (params) => {
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
  const isHome = game.home_team === primaryTeamId;
  const ours   = isHome ? game.home_score : game.away_score;
  const theirs = isHome ? game.away_score : game.home_score;
  if (ours > theirs) return 'W';
  if (ours < theirs) return 'L';
  return 'D';
}
