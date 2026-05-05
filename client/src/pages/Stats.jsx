import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, getResult } from '../api';
import { Spinner, ErrorState, EmptyState, PageHeader, LeaderRow } from '../components/ui';

const BADGE_COLOR = { W: 'bg-emerald-500', L: 'bg-red-500', D: 'bg-gray-400' };

function FormBadge({ game, primaryTeamId }) {
  const result = getResult(game, primaryTeamId);
  if (!result) return null;
  const opponent = game.home_team === primaryTeamId ? game.away_team_name : game.home_team_name;
  const score = `${game.home_score}–${game.away_score}`;

  return (
    <Link
      to={`/games/${game.id}`}
      className="flex flex-col items-center gap-1.5 group"
      title={`${game.home_team_name} ${score} ${game.away_team_name} · ${formatDate(game.date)}`}
    >
      <div className={`w-12 h-12 rounded-xl ${BADGE_COLOR[result]} flex items-center justify-center group-hover:opacity-75 transition-opacity`}>
        <span className="font-bebas text-white text-2xl leading-none">{result}</span>
      </div>
      <span className="text-[10px] text-gray-500 font-medium truncate max-w-[56px] text-center leading-tight">{opponent}</span>
      <span className="text-[10px] text-gray-400 font-mono">{score}</span>
    </Link>
  );
}

export default function Stats() {
  const [data,  setData]  = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getGames(), api.getTeams(), api.getTopScorers(), api.getPotgCount()])
      .then(([games, teams, scorers, potg]) => setData({ games, teams, scorers, potg }))
      .catch(e => setError(e.message));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data)  return <Spinner />;

  const { games, teams, scorers, potg } = data;
  const primaryTeamId = teams[0]?.id;

  const ourGames   = games.filter(g => g.home_team === primaryTeamId || g.away_team === primaryTeamId);
  const formGuide  = ourGames.slice(0, 5);

  const allScorers = scorers.filter(p => p.goals > 0);
  const allPotg    = potg.filter(p => p.awards > 0);

  return (
    <div>
      <PageHeader eyebrow="Season 2024" title="Statistics" />

      <div className="p-4 md:p-6 space-y-8 max-w-2xl">
        {/* ── Form Guide ──────────────────────────────────── */}
        <section>
          <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">Form Guide</h2>
          {formGuide.length === 0 ? (
            <EmptyState message="No games played yet — results will appear here once you log your first match ⚽" />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Last {formGuide.length} result{formGuide.length !== 1 ? 's' : ''} · most recent first
                </p>
              </div>
              <div className="px-4 py-5 flex gap-4 flex-wrap">
                {formGuide.map(g => (
                  <FormBadge key={g.id} game={g} primaryTeamId={primaryTeamId} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Leaderboards ────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">⚽ Goal Scorers</h2>
            {allScorers.length === 0 ? (
              <EmptyState message="No goals recorded yet — they'll appear after you log your first game ⚽" />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {allScorers.map((p, i) => (
                  <LeaderRow
                    key={p.id}
                    rank={i + 1}
                    name={p.name}
                    jersey={p.jersey_number}
                    teamName={p.team_name}
                    value={p.goals}
                    unit="goals"
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">⭐ Player of the Game</h2>
            {allPotg.length === 0 ? (
              <EmptyState message="No awards given yet — award a POTG after your next game! ⭐" />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {allPotg.map((p, i) => (
                  <LeaderRow
                    key={p.id}
                    rank={i + 1}
                    name={p.name}
                    jersey={p.jersey_number}
                    teamName={p.team_name}
                    value={p.awards}
                    unit="awards"
                    gold
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
