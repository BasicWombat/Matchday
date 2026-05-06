import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, getResult } from '../api';
import { Spinner, ErrorState, EmptyState, LeaderRow } from '../components/ui';
import { useAuth } from '../context/AuthContext';

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

  const myTeamIsHome = game.home_team === primaryTeamId;
  const myTeamIsAway = game.away_team === primaryTeamId;
  const haLabel = myTeamIsHome ? 'Home' : myTeamIsAway ? 'Away' : null;

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
          {haLabel && (
            <span className={`font-bebas text-xs px-2 py-0.5 rounded ${
              haLabel === 'Home' ? 'bg-pitch-100 text-pitch-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {haLabel}
            </span>
          )}
          <span className="text-xs text-gray-400">{formatDate(game.date)}</span>
        </div>
      </div>

      {/* Score — always home left, away right */}
      <div className="flex items-center justify-center gap-3">
        <p className="font-bebas text-lg text-pitch-900 text-right flex-1 leading-tight">{game.home_team_name}</p>
        <div className="bg-pitch-900 text-white px-3 py-1 rounded-lg font-bebas text-xl flex items-center gap-1.5 shrink-0">
          <span className={myTeamIsHome ? 'text-gold-400' : ''}>{game.home_score}</span>
          <span className="text-pitch-600 text-base">—</span>
          <span className={myTeamIsAway ? 'text-gold-400' : ''}>{game.away_score}</span>
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
      {game.created_by_name && (
        <p className="text-[10px] text-gray-400 mt-1 text-center">Added by {game.created_by_name}</p>
      )}
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
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
  const primaryTeam   = teams.find(t => t.id === user?.my_team_id) ?? teams[0];
  const primaryTeamId = primaryTeam?.id;

  const ourGames = games.filter(g =>
    g.home_team === primaryTeamId || g.away_team === primaryTeamId
  );

  const getScores = g => {
    const isHome = g.home_team === primaryTeamId;
    return { ours: isHome ? g.home_score : g.away_score, theirs: isHome ? g.away_score : g.home_score };
  };

  const wins       = ourGames.filter(g => { const s = getScores(g); return s.ours > s.theirs; }).length;
  const losses     = ourGames.filter(g => { const s = getScores(g); return s.ours < s.theirs; }).length;
  const draws      = ourGames.length - wins - losses;
  const totalGoals = ourGames.reduce((sum, g) => sum + getScores(g).ours, 0);

  // Home / Away breakdown — completed games only
  const completedGames = ourGames.filter(g => g.status === 'complete');
  const homeGames = completedGames.filter(g => g.home_team === primaryTeamId);
  const awayGames = completedGames.filter(g => g.away_team === primaryTeamId);

  const homeRecord = {
    w: homeGames.filter(g => g.home_score > g.away_score).length,
    d: homeGames.filter(g => g.home_score === g.away_score).length,
    l: homeGames.filter(g => g.home_score < g.away_score).length,
  };
  const awayRecord = {
    w: awayGames.filter(g => g.away_score > g.home_score).length,
    d: awayGames.filter(g => g.away_score === g.home_score).length,
    l: awayGames.filter(g => g.away_score < g.home_score).length,
  };

  const recentGames = games.slice(0, 3);
  const topScorers  = scorers.filter(p => p.goals > 0).slice(0, 3);
  const topPotg     = potg.filter(p => p.awards > 0).slice(0, 3);

  const liveGame = games.find(g => g.status === 'live' || g.status === 'halftime');
  const liveMyTeamIsHome = liveGame?.home_team === primaryTeamId;
  const liveMyTeamIsAway = liveGame?.away_team === primaryTeamId;

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
        {/* ── Live Now card ───────────────────────────────── */}
        {liveGame && (
          <section>
            <Link
              to={`/games/${liveGame.id}`}
              className="block bg-emerald-800 border border-emerald-600 rounded-xl p-4 hover:bg-emerald-700 transition-colors"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                </span>
                <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest">
                  {liveGame.status === 'halftime' ? 'Half Time' : 'Live Now'}
                </span>
                {(liveMyTeamIsHome || liveMyTeamIsAway) && (
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">
                    · {liveMyTeamIsHome ? 'Home' : 'Away'}
                  </span>
                )}
              </div>
              {/* Score — always home left, away right */}
              <div className="flex items-center justify-center gap-3">
                <p className="font-bebas text-white text-xl text-right flex-1 leading-tight">{liveGame.home_team_name}</p>
                <div className="bg-emerald-900 text-white px-4 py-1.5 rounded-lg font-bebas text-2xl flex items-center gap-2 shrink-0">
                  <span className={liveMyTeamIsHome ? 'text-gold-400' : ''}>{liveGame.home_score}</span>
                  <span className="text-emerald-600">—</span>
                  <span className={liveMyTeamIsAway ? 'text-gold-400' : ''}>{liveGame.away_score}</span>
                </div>
                <p className="font-bebas text-white text-xl flex-1 leading-tight">{liveGame.away_team_name}</p>
              </div>
              <p className="text-emerald-500 text-xs text-center mt-2">Tap to open →</p>
            </Link>
          </section>
        )}

        {/* ── Season stats ────────────────────────────────── */}
        <section>
          <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">Season Summary</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <StatCard label="Games Played" value={ourGames.length} dark />
            <StatCard label="Wins"          value={wins}           accent="text-emerald-600" />
            <StatCard label="Goals Scored"  value={totalGoals}     dark />
            <StatCard label="D / L"         value={`${draws} / ${losses}`} />
          </div>
          {/* Home / Away breakdown */}
          {completedGames.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bebas text-[10px] uppercase tracking-widest text-pitch-500">Home</span>
                <span className="font-bebas text-sm text-emerald-600">W{homeRecord.w}</span>
                <span className="font-bebas text-sm text-gray-400">D{homeRecord.d}</span>
                <span className="font-bebas text-sm text-red-500">L{homeRecord.l}</span>
              </div>
              <span className="text-gray-300 self-center">|</span>
              <div className="flex items-center gap-2">
                <span className="font-bebas text-[10px] uppercase tracking-widest text-pitch-500">Away</span>
                <span className="font-bebas text-sm text-emerald-600">W{awayRecord.w}</span>
                <span className="font-bebas text-sm text-gray-400">D{awayRecord.d}</span>
                <span className="font-bebas text-sm text-red-500">L{awayRecord.l}</span>
              </div>
            </div>
          )}
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
