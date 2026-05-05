import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, formatDate, getResult } from '../api';
import { Spinner, ErrorState, Btn } from '../components/ui';
import { useToast } from '../components/Toast';

const RESULT_LABEL = { W: 'Victory', L: 'Defeat', D: 'Draw' };
const RESULT_COLOR  = { W: 'text-emerald-500', L: 'text-red-500', D: 'text-gray-400' };

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

export default function GameDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const toast    = useToast();

  const [game,     setGame]     = useState(null);
  const [players,  setPlayers]  = useState([]);
  const [teams,    setTeams]    = useState([]);
  const [error,    setError]    = useState(null);

  // Add-goal form state
  const [addOpen,    setAddOpen]    = useState(false);
  const [goalPlayer, setGoalPlayer] = useState('');
  const [goalMinute, setGoalMinute] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);

  // POTG state
  const [potgPlayer,    setPotgPlayer]    = useState('');
  const [settingPotg,   setSettingPotg]   = useState(false);

  const load = useCallback(() =>
    Promise.all([api.getGame(id), api.getPlayers(), api.getTeams()])
      .then(([g, p, t]) => {
        setGame(g);
        setPlayers(p);
        setTeams(t);
        setPotgPlayer(g.player_of_game ? String(g.player_of_game.player_id) : '');
      })
      .catch(e => setError(e.message)),
  [id]);

  useEffect(() => { load(); }, [load]);

  async function deleteGame() {
    if (!window.confirm('Delete this game? This cannot be undone.')) return;
    try {
      await api.deleteGame(id);
      navigate('/games');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function addGoal(e) {
    e.preventDefault();
    setAddingGoal(true);
    try {
      await api.createGoal({ game_id: Number(id), player_id: Number(goalPlayer), minute: Number(goalMinute) });
      setGoalPlayer(''); setGoalMinute(''); setAddOpen(false);
      await load();
      toast('Goal added!');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAddingGoal(false);
    }
  }

  async function removeGoal(goalId) {
    try {
      await api.deleteGoal(goalId);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function savePotg() {
    if (!potgPlayer) return;
    setSettingPotg(true);
    try {
      await api.setPlayerOfGame({ game_id: Number(id), player_id: Number(potgPlayer) });
      await load();
      toast('Player of the Game saved!');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSettingPotg(false);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!game)  return <Spinner />;

  const primaryTeamId = teams[0]?.id;
  const result        = getResult(game, primaryTeamId);

  // Group goals by player
  const scorerMap = (game.goals ?? []).reduce((acc, g) => {
    (acc[g.player_id] ??= { name: g.player_name, jersey: g.jersey_number, minutes: [] }).minutes.push(g.minute);
    return acc;
  }, {});

  // Players from both teams for goal assignment
  const homeTeamPlayers = players.filter(p => p.team_id === game.home_team);
  const awayTeamPlayers = players.filter(p => p.team_id === game.away_team);

  return (
    <div>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="bg-pitch-900 px-4 md:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link to="/games" className="text-pitch-400 hover:text-white text-sm transition-colors">← All Games</Link>
          <div className="flex items-center gap-2">
            <Link
              to={`/games/${id}/edit`}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={deleteGame}
              className="bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        <p className="text-pitch-400 text-xs mb-4">{formatDate(game.date)}</p>

        {/* Scoreboard */}
        <div className="flex items-center justify-center gap-4 md:gap-8 mb-4">
          <div className="text-center flex-1">
            <p className="font-bebas text-white text-2xl md:text-3xl leading-tight">{game.home_team_name}</p>
            <p className="text-pitch-500 text-xs uppercase tracking-widest">Home</p>
          </div>
          <div className="text-center shrink-0">
            <div className="bg-pitch-800 rounded-2xl px-6 py-3 inline-block">
              <p className="font-bebas text-5xl md:text-6xl text-white tracking-wider">
                {game.home_score}
                <span className="text-pitch-600 mx-2">—</span>
                {game.away_score}
              </p>
            </div>
            {result && (
              <p className={`font-bebas text-sm tracking-widest mt-2 ${RESULT_COLOR[result]}`}>
                {RESULT_LABEL[result]}
              </p>
            )}
          </div>
          <div className="text-center flex-1">
            <p className="font-bebas text-white text-2xl md:text-3xl leading-tight">{game.away_team_name}</p>
            <p className="text-pitch-500 text-xs uppercase tracking-widest">Away</p>
          </div>
        </div>

        {game.notes && (
          <p className="text-pitch-400 text-sm text-center italic">"{game.notes}"</p>
        )}
      </div>

      <div className="p-4 md:p-6 space-y-6 max-w-2xl">
        {/* ── Goals ───────────────────────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bebas text-pitch-900 text-xl tracking-wide">⚽ Goals</h2>
            <button
              onClick={() => setAddOpen(v => !v)}
              className="bg-pitch-800 hover:bg-pitch-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            >
              {addOpen ? '✕ Cancel' : '+ Add Goal'}
            </button>
          </div>

          {/* Add goal inline form */}
          {addOpen && (
            <form onSubmit={addGoal} className="px-4 py-3 bg-pitch-50 border-b border-gray-100 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-40">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Player</label>
                <select
                  required
                  value={goalPlayer}
                  onChange={e => setGoalPlayer(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-400"
                >
                  <option value="">Select player…</option>
                  {homeTeamPlayers.length > 0 && (
                    <optgroup label={game.home_team_name}>
                      {homeTeamPlayers.map(p => (
                        <option key={p.id} value={p.id}>#{p.jersey_number} {p.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {awayTeamPlayers.length > 0 && (
                    <optgroup label={game.away_team_name}>
                      {awayTeamPlayers.map(p => (
                        <option key={p.id} value={p.id}>#{p.jersey_number} {p.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div className="w-28">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Minute</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  placeholder="e.g. 34"
                  value={goalMinute}
                  onChange={e => setGoalMinute(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-400"
                />
              </div>
              <Btn type="submit" variant="primary" size="sm" disabled={addingGoal}>
                {addingGoal ? '…' : 'Add'}
              </Btn>
            </form>
          )}

          {/* Goals list */}
          {game.goals?.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No goals recorded yet</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {(game.goals ?? []).map(goal => (
                <div key={goal.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="font-bebas text-pitch-500 text-lg w-10 shrink-0">{goal.minute}'</span>
                  <div className="flex-1">
                    <p className="font-bold text-pitch-900 text-sm">{goal.player_name}</p>
                    <p className="text-xs text-gray-400">#{goal.jersey_number}</p>
                  </div>
                  <button
                    onClick={() => removeGoal(goal.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove goal"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Scorer summary */}
          {Object.keys(scorerMap).length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              {Object.values(scorerMap).map(s => (
                <p key={s.name} className="text-xs text-gray-500">
                  ⚽ <span className="font-medium text-pitch-700">{s.name}</span> — {s.minutes.map(m => `${m}'`).join(', ')}
                </p>
              ))}
            </div>
          )}
        </section>

        {/* ── Player of the Game ──────────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bebas text-pitch-900 text-xl tracking-wide">⭐ Player of the Game</h2>
          </div>

          <div className="p-4 space-y-3">
            {game.player_of_game ? (
              <div className="flex items-center gap-3 bg-gold-500/10 border border-gold-400/30 rounded-xl px-4 py-3">
                <span className="text-2xl">⭐</span>
                <div>
                  <p className="font-bold text-pitch-900">{game.player_of_game.player_name}</p>
                  <p className="text-xs text-gray-500">#{game.player_of_game.jersey_number}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No player of the game selected yet</p>
            )}

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">
                  {game.player_of_game ? 'Change POTG' : 'Select POTG'}
                </label>
                <select
                  value={potgPlayer}
                  onChange={e => setPotgPlayer(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-400"
                >
                  <option value="">Select player…</option>
                  {homeTeamPlayers.length > 0 && (
                    <optgroup label={game.home_team_name}>
                      {homeTeamPlayers.map(p => (
                        <option key={p.id} value={p.id}>#{p.jersey_number} {p.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {awayTeamPlayers.length > 0 && (
                    <optgroup label={game.away_team_name}>
                      {awayTeamPlayers.map(p => (
                        <option key={p.id} value={p.id}>#{p.jersey_number} {p.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <Btn
                variant="primary"
                size="sm"
                onClick={savePotg}
                disabled={!potgPlayer || settingPotg}
              >
                {settingPotg ? '…' : 'Save'}
              </Btn>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
