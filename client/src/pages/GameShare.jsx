import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatDate } from '../api';
import { Spinner } from '../components/ui';

function abbrevName(name) {
  if (!name) return 'Unknown';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export default function GameShare() {
  const { id } = useParams();
  const [game,  setGame]  = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getGame(id)
      .then(setGame)
      .catch(e => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-pitch-950 flex items-center justify-center p-4">
        <p className="text-pitch-400 text-sm">Game not found.</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-pitch-950 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (game.status !== 'complete') {
    return (
      <div className="min-h-screen bg-pitch-950 flex items-center justify-center p-4">
        <p className="text-pitch-400 text-sm">This match hasn't ended yet.</p>
      </div>
    );
  }

  const homeGoals = (game.goals ?? []).filter(g => g.team_id === game.home_team);
  const awayGoals = (game.goals ?? []).filter(g => g.team_id === game.away_team);

  return (
    <div className="min-h-screen bg-pitch-950 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="bg-pitch-900 px-5 pt-5 pb-4">
          <p className="text-pitch-400 text-[10px] font-bold uppercase tracking-widest text-center mb-1">
            ⚽ Full Time
          </p>
          <p className="text-pitch-500 text-xs text-center mb-4">{formatDate(game.date)}</p>

          <div className="flex items-center justify-center gap-3">
            <div className="text-right flex-1 min-w-0">
              <p className="font-bebas text-white text-xl leading-tight truncate">{game.home_team_name}</p>
              <p className="text-[10px] uppercase tracking-widest text-pitch-500">Home</p>
            </div>
            <div className="bg-pitch-800 rounded-2xl px-4 py-2 shrink-0">
              <p className="font-bebas text-4xl text-white tracking-wider">
                {game.home_score}<span className="text-pitch-600 mx-1">—</span>{game.away_score}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bebas text-white text-xl leading-tight truncate">{game.away_team_name}</p>
              <p className="text-[10px] uppercase tracking-widest text-pitch-500">Away</p>
            </div>
          </div>
        </div>

        {/* Goals */}
        <div className="p-4 space-y-4">
          {(homeGoals.length > 0 || awayGoals.length > 0) ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-pitch-500 mb-1">
                  {game.home_team_name}
                </p>
                {homeGoals.length > 0
                  ? homeGoals.map(g => (
                      <p key={g.id} className="text-sm text-pitch-900">
                        {abbrevName(g.player_name)}{' '}
                        <span className="text-pitch-400">{g.minute}'</span>
                      </p>
                    ))
                  : <p className="text-xs text-gray-300">—</p>
                }
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-pitch-500 mb-1">
                  {game.away_team_name}
                </p>
                {awayGoals.length > 0
                  ? awayGoals.map(g => (
                      <p key={g.id} className="text-sm text-pitch-900">
                        {abbrevName(g.player_name)}{' '}
                        <span className="text-pitch-400">{g.minute}'</span>
                      </p>
                    ))
                  : <p className="text-xs text-gray-300">—</p>
                }
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-2">No goals recorded</p>
          )}

          {game.player_of_game && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">
                🏆 Player of the Game
              </p>
              <p className="font-bold text-pitch-900">{game.player_of_game.player_name}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-3 text-center">
          <p className="text-[11px] text-gray-400">Powered by Matchday</p>
        </div>
      </div>

      <a
        href="/"
        className="mt-4 text-pitch-400 hover:text-white text-sm transition-colors"
      >
        Open Matchday →
      </a>
    </div>
  );
}
