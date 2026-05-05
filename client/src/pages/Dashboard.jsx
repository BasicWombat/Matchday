import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, getResult } from '../api';
import { Spinner, ErrorState, EmptyState, LeaderRow } from '../components/ui';

const RESULT_STYLES = {
  W: { badge: 'bg-emerald-500 text-white', border: 'border-l-emerald-500' },
  L: { badge: 'bg-red-500 text-white',     border: 'border-l-red-500' },
  D: { badge: 'bg-gray-400 text-white',    border: 'border-l-gray-300' },
};

function StatCard({ label, value, dark, accent }) {
  if (dark) {
    return (
      <div className="bg-pitch-800 rounded-xl p-5">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold-400">{label}</p>
        <p className="font-bebas text-5xl text-white mt-1">{value}</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400">{label}</p>
      <p className={`font-bebas text-5xl mt-1 ${accent ?? 'text-pitch-900'}`}>{value}</p>
    </div>
  );
}

function MiniGameCard({ game, primaryTeamId }) {
  const result = getResult(game, primaryTeamId);
  const styles = result ? RESULT_STYLES[result] : null;

  const scorerMap = (game.goals ?? []).reduce((acc, g) => {
    (acc[g.player_id] ??= { name: g.player_name, minutes: [] }).minutes.push(g.minute);
    return acc;
  }, {});

  return (
    <Link
      to={`/games/${game.id}`}
      className={`block bg-white rounded-xl border border-l-4 ${styles?.border ?? 'border-l-gray-200'} border-gray-200 hover:shadow-md transition-all p-4`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {result && (
            <span className={`font-bebas text-xs px-2 py-0.5 rounded ${styles.badge}`}>{result}</span>
          )}
          <span className="text-xs text-gray-400">{formatDate(game.date)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <p className="font-bebas text-lg text-pitch-900 text-right flex-1 leading-tight">{game.home_team_name}</p>
        <div className="bg-pitch-900 text-white px-3 py-1 rounded-lg font-bebas text-xl flex items-center gap-1.5 shrink-0">
          <span>{game.home_score}</span>
          <span className="text-pitch-600 text-base">—</span>
          <span>{game.away_score}</span>
        </div>
        <p className="font-bebas text-lg text-pitch-900 flex-1 leading-tight">{game.away_team_name}</p>
      </div>

      {Object.keys(scorerMap).length > 0 && (
        <p className="text-[11px] text-gray-400 mt-2.5 text-center truncate">
          ⚽ {Object.values(scorerMap).map(s => `${s.name} ${s.minutes.map(m => `${m}'`).join(' ')}`).join('  ·  ')}
        </p>
      )}
      {game.player_of_game && (
        <p className="text-[11px] text-gold-600 font-medium mt-1 text-center">
          ⭐ {game.player_of_game.player_name}
        </p>
      )}
    </Link>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getGames(), api.getTeams(), api.getTopScorers(), api.getPotgCount()])
      .then(([games, teams, scorers, potg]) => setData({ games, teams, scorers, potg }))
      .catch(e => setError(e.message));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data)  return <Spinner />;

  const { games, teams, scorers, potg } = data;
  const primaryTeam   = teams[0];
  const primaryTeamId = primaryTeam?.id;

  const ourGames = games.filter(g =>
    g.home_team === primaryTeamId || g.away_team === primaryTeamId
  );

  const getScores = g => {
    const isHome = g.home_team === primaryTeamId;
    return { ours: isHome ? g.home_score : g.away_score, theirs: isHome ? g.away_score : g.home_score };
  };

  const wins   = ourGames.filter(g => { const s = getScores(g); return s.ours > s.theirs; }).length;
  const losses = ourGames.filter(g => { const s = getScores(g); return s.ours < s.theirs; }).length;
  const draws  = ourGames.length - wins - losses;
  const totalGoals = ourGames.reduce((sum, g) => sum + getScores(g).ours, 0);

  const recentGames = games.slice(0, 3);
  const topScorers  = scorers.filter(p => p.goals > 0).slice(0, 3);
  const topPotg     = potg.filter(p => p.awards > 0).slice(0, 3);

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <div className="bg-pitch-900 px-6 py-8">
        <p className="text-gold-400 text-[10px] font-bold tracking-[0.2em] uppercase">Season 2024</p>
        <div className="flex items-start justify-between gap-4 mt-1">
          <div>
            <h1 className="font-bebas text-white text-5xl tracking-wide leading-none">
              {primaryTeam?.name ?? 'Matchday'}
            </h1>
            <p className="text-pitch-400 text-sm mt-1">Club Dashboard</p>
          </div>
          <Link
            to="/games/new"
            className="mt-1 shrink-0 bg-gold-500 hover:bg-gold-400 text-pitch-950 font-bold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            + Add Game
          </Link>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-8">
        {/* ── Season stats ────────────────────────────────── */}
        <section>
          <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">Season Summary</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Games Played" value={ourGames.length} dark />
            <StatCard label="Wins"          value={wins}           accent="text-emerald-600" />
            <StatCard label="Goals Scored"  value={totalGoals}     dark />
            <StatCard label="D / L"         value={`${draws} / ${losses}`} />
          </div>
        </section>

        {/* ── Recent results ──────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide">Recent Results</h2>
            <Link to="/games" className="text-sm text-pitch-500 hover:text-pitch-800 font-medium">
              All games →
            </Link>
          </div>
          {recentGames.length === 0 ? (
            <EmptyState
              message="No games yet — add your first result!"
              action={
                <Link to="/games/new" className="inline-block mt-2 bg-gold-500 text-pitch-950 font-bold text-sm px-4 py-2 rounded-lg">
                  Add Game
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {recentGames.map(g => (
                <MiniGameCard key={g.id} game={g} primaryTeamId={primaryTeamId} />
              ))}
            </div>
          )}
        </section>

        {/* ── Leaderboards ────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">⚽ Top Scorers</h2>
            {topScorers.length === 0 ? (
              <EmptyState message="No goals recorded yet" />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {topScorers.map((p, i) => (
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
            {topPotg.length === 0 ? (
              <EmptyState message="No awards given yet" />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {topPotg.map((p, i) => (
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
