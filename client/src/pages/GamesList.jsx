import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, getResult } from '../api';
import { Spinner, ErrorState, EmptyState, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSeason } from '../context/SeasonContext';

const RESULT = {
  W: { badge: 'bg-emerald-500 text-white', border: 'border-l-emerald-400' },
  L: { badge: 'bg-red-500 text-white',     border: 'border-l-red-400' },
  D: { badge: 'bg-gray-400 text-white',    border: 'border-l-gray-300' },
};

const STATUS_BADGE = {
  scheduled: { label: 'Scheduled', className: 'bg-gray-200 text-gray-600' },
  live:      { label: 'Live',      className: 'bg-emerald-500 text-white' },
  halftime:  { label: 'Half Time', className: 'bg-amber-400 text-pitch-950' },
};

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

function GameCard({ game, primaryTeamId }) {
  const result  = getResult(game, primaryTeamId);
  const styles  = result ? RESULT[result] : null;
  const isLive  = game.status === 'live' || game.status === 'halftime';
  const statusBadge = STATUS_BADGE[game.status];

  const myTeamIsHome = game.home_team === primaryTeamId;
  const myTeamIsAway = game.away_team === primaryTeamId;
  const haLabel = myTeamIsHome ? 'H' : myTeamIsAway ? 'A' : null;

  const scorerMap = (game.goals ?? [])
    .filter(g => g.player_name)
    .reduce((acc, g) => {
      (acc[g.player_id] ??= { name: g.player_name, minutes: [] }).minutes.push(g.minute);
      return acc;
    }, {});

  const scorerLines = Object.values(scorerMap);

  return (
    <Link
      to={`/games/${game.id}`}
      className={`block bg-white rounded-xl border border-l-4 ${
        isLive ? 'border-l-emerald-400' : (styles?.border ?? 'border-l-gray-200')
      } border-gray-200 hover:shadow-md transition-all overflow-hidden`}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-3">
            {isLive && <LiveDot />}
            {statusBadge && (
              <span className={`font-bebas text-xs px-2.5 py-0.5 rounded ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            )}
            {result && (
              <span className={`font-bebas text-xs px-2.5 py-0.5 rounded ${styles.badge}`}>{result}</span>
            )}
            {haLabel && (
              <span className={`font-bebas text-xs px-2 py-0.5 rounded ${
                haLabel === 'H'
                  ? 'bg-pitch-100 text-pitch-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {haLabel === 'H' ? 'Home' : 'Away'}
              </span>
            )}
            <span className="text-xs text-gray-400">{formatDate(game.date)}</span>
          </div>

          {/* Score row — always home left, away right */}
          <div className="flex items-center gap-3">
            <p className="font-bebas text-xl text-pitch-900 text-right flex-1 leading-tight">
              {game.home_team_name}
            </p>
            <div className={`${isLive ? 'bg-emerald-800' : 'bg-pitch-900'} text-white px-4 py-1.5 rounded-lg font-bebas text-2xl flex items-center gap-2 shrink-0`}>
              <span className={myTeamIsHome ? 'text-gold-400' : ''}>{game.home_score}</span>
              <span className="text-pitch-600">—</span>
              <span className={myTeamIsAway ? 'text-gold-400' : ''}>{game.away_score}</span>
            </div>
            <p className="font-bebas text-xl text-pitch-900 flex-1 leading-tight">
              {game.away_team_name}
            </p>
          </div>
        </div>
      </div>

      {/* Goals + POTG footer */}
      {(scorerLines.length > 0 || game.player_of_game || game.created_by_name) && (
        <div className="px-4 pb-3 pt-0 border-t border-gray-100 space-y-1">
          {scorerLines.length > 0 && (
            <p className="text-xs text-gray-500 truncate">
              ⚽ {scorerLines.map(s => `${s.name} ${s.minutes.map(m => `${m}'`).join(' ')}`).join('  ·  ')}
            </p>
          )}
          {game.player_of_game && (
            <p className="text-xs text-gold-600 font-medium">
              ⭐ POTG: {game.player_of_game.player_name}
            </p>
          )}
          {game.created_by_name && (
            <p className="text-[10px] text-gray-400">Added by {game.created_by_name}</p>
          )}
        </div>
      )}
    </Link>
  );
}

export default function GamesList() {
  const { user } = useAuth();
  const { selectedSeasonId, selectedSeason } = useSeason();
  const [games, setGames] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedSeasonId) return;
    Promise.all([api.getGames({ season_id: selectedSeasonId }), api.getTeams()])
      .then(([g, t]) => { setGames(g); setTeams(t); })
      .catch(e => setError(e.message));
  }, [selectedSeasonId]);

  if (error) return <ErrorState message={error} />;
  if (!games) return <Spinner />;

  const primaryTeamId = (teams.find(t => t.id === user?.my_team_id) ?? teams[0])?.id;

  return (
    <div>
      <PageHeader
        eyebrow={selectedSeason?.name ?? 'Season'}
        title="All Games"
        action={
          <Link
            to="/games/new"
            className="bg-gold-500 hover:bg-gold-400 text-pitch-950 font-bold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            + Add Game
          </Link>
        }
      />

      <div className="p-4 md:p-6">
        {games.length === 0 ? (
          <EmptyState
            message="No games recorded yet. Add your first match!"
            action={
              <Link to="/games/new" className="inline-block mt-2 bg-gold-500 text-pitch-950 font-bold text-sm px-4 py-2 rounded-lg">
                Add Game
              </Link>
            }
          />
        ) : (
          <div className="space-y-3 max-w-2xl">
            {games.map(g => (
              <GameCard key={g.id} game={g} primaryTeamId={primaryTeamId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
