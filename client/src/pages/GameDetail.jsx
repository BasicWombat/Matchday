import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, formatDate, getResult } from '../api';
import { Spinner, ErrorState, Btn } from '../components/ui';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

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

function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function PlayerPickerModal({ players, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative bg-white rounded-t-2xl w-full max-w-md p-4 pb-safe"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bebas text-pitch-900 text-2xl tracking-wide">Who Scored?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-xl leading-none">✕</button>
        </div>
        {players.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No players on this team yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pb-4">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:bg-pitch-50 hover:border-pitch-300 text-left transition-colors"
              >
                <span className="font-bebas text-pitch-500 text-xl w-8 text-center shrink-0">
                  #{p.jersey_number}
                </span>
                <span className="font-medium text-pitch-900 text-sm leading-tight">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalRow({ goal, canDelete, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="font-bebas text-pitch-400 text-base w-10 shrink-0 text-right">
        {goal.minute}'
      </span>
      <div className="flex-1 min-w-0">
        {goal.player_name
          ? <p className="font-medium text-pitch-900 text-sm truncate">{goal.player_name}</p>
          : <p className="text-sm text-gray-400 italic">Unknown scorer</p>
        }
      </div>
      {canDelete && (
        <button
          onClick={() => onDelete(goal.id)}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

// Inline score editor — manages its own open/closed state
function ScoreEditor({ game, onSave }) {
  const [editing, setEditing] = useState(false);
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [saving, setSaving] = useState(false);

  function open() {
    setHome(String(game.home_score));
    setAway(String(game.away_score));
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    await onSave(Number(home), Number(away));
    setSaving(false);
    setEditing(false);
  }

  async function reset() {
    setSaving(true);
    await onSave(null, null);
    setSaving(false);
    setEditing(false);
  }

  const isOverridden = game.score_home_override != null || game.score_away_override != null;

  if (editing) {
    return (
      <div className="bg-pitch-800 rounded-2xl px-4 py-3 shrink-0 text-center">
        <div className="flex items-center justify-center gap-2">
          <input
            type="number" min="0" value={home}
            onChange={e => setHome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            className="w-14 text-center font-bebas text-4xl bg-transparent text-white border-b-2 border-pitch-500 focus:border-gold-400 outline-none"
            autoFocus
          />
          <span className="font-bebas text-pitch-600 text-4xl">—</span>
          <input
            type="number" min="0" value={away}
            onChange={e => setAway(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            className="w-14 text-center font-bebas text-4xl bg-transparent text-white border-b-2 border-pitch-500 focus:border-gold-400 outline-none"
          />
        </div>
        <div className="flex justify-center gap-3 mt-2.5">
          <button onClick={save} disabled={saving} className="text-gold-400 text-xs font-bold disabled:opacity-50">
            ✓ Save
          </button>
          {isOverridden && (
            <button onClick={reset} disabled={saving} className="text-pitch-400 hover:text-pitch-200 text-xs disabled:opacity-50">
              Reset
            </button>
          )}
          <button onClick={() => setEditing(false)} className="text-pitch-500 hover:text-pitch-300 text-xs">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 flex flex-col items-center gap-1">
      <div className="bg-pitch-800 rounded-2xl px-6 py-3">
        <p className="font-bebas text-5xl text-white tracking-wider">
          {game.home_score}
          <span className="text-pitch-600 mx-2">—</span>
          {game.away_score}
        </p>
      </div>
      <button
        onClick={open}
        className="text-[10px] text-pitch-500 hover:text-pitch-300 transition-colors leading-none"
      >
        {isOverridden ? '✎ edited' : '✎ edit score'}
      </button>
    </div>
  );
}

export default function GameDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const toast    = useToast();
  const { user } = useAuth();

  const [game,     setGame]     = useState(null);
  const [players,  setPlayers]  = useState([]);
  const [teams,    setTeams]    = useState([]);
  const [error,    setError]    = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [confirmHalftime,  setConfirmHalftime]  = useState(false);
  const [confirmFulltime,  setConfirmFulltime]  = useState(false);
  const [potgPlayer,     setPotgPlayer]     = useState('');
  const [settingPotg,    setSettingPotg]    = useState(false);
  const [actioning,      setActioning]      = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Which goal panel is awaiting a goal log (home or away)
  const [pendingGoalSide, setPendingGoalSide] = useState(null); // 'home' | 'away'

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

  useEffect(() => {
    if (!game) return;
    setTimerSeconds(game.elapsed_seconds ?? 0);
  }, [game?.id, game?.status]);

  useEffect(() => {
    if (!game || game.status !== 'live') return;
    const interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [game?.status]);

  // Derived team info
  const myTeam       = teams.find(t => t.id === user?.my_team_id);
  const myTeamIsHome = game?.home_team === myTeam?.id;
  const myTeamPlayers = players.filter(p => p.team_id === myTeam?.id);

  // ── Action handlers ──────────────────────────────────────────────────────────

  async function gameAction(fn, successMsg) {
    setActioning(true);
    try {
      const g = await fn();
      setGame(g);
      if (successMsg) toast(successMsg);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setActioning(false);
    }
  }

  const startGame      = () => gameAction(() => api.startGame(id),    'Game started!');
  const handleHalftime = async () => {
    setConfirmHalftime(false);
    await gameAction(() => api.halftimeGame(id), 'Half time!');
  };
  const handleRestart  = () => gameAction(() => api.restartGame(id),  'Second half started!');
  const handleFulltime = async () => {
    setConfirmFulltime(false);
    await gameAction(() => api.fulltimeGame(id), 'Full time!');
  };
  const handleReopen   = () => gameAction(() => api.reopenGame(id),   'Game reopened');

  async function saveScore(homeScore, awayScore) {
    try {
      const g = await api.setScore(id, { home_score: homeScore, away_score: awayScore });
      setGame(g);
      toast(homeScore == null ? 'Score reset to goals' : 'Score updated');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // Open player picker for My Team's panel; log anonymous goal for opponent panel
  function handleGoalButtonClick(side) {
    const sideTeamId = side === 'home' ? game?.home_team : game?.away_team;
    const isMyTeam   = sideTeamId === myTeam?.id;
    if (isMyTeam) {
      setPendingGoalSide(side);
      setShowPlayerPicker(true);
    } else {
      logGoal({ team_id: sideTeamId });
    }
  }

  async function logGoal({ player, team_id }) {
    setShowPlayerPicker(false);
    setPendingGoalSide(null);
    try {
      await api.createGoal({
        game_id:         Number(id),
        player_id:       player?.id ?? undefined,
        team_id:         team_id ?? myTeam?.id,
        elapsed_seconds: timerSeconds,
      });
      await load();
      if (player) toast(`Goal! ${player.name} ${Math.floor(timerSeconds / 60) + 1}'`);
      else        toast('Goal logged');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function handlePlayerSelected(player) {
    const team_id = pendingGoalSide === 'home' ? game?.home_team : game?.away_team;
    logGoal({ player, team_id });
  }

  async function removeGoal(goalId) {
    try {
      await api.deleteGoal(goalId);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function savePotg() {
    if (!potgPlayer) return;
    setSettingPotg(true);
    try {
      await api.setPlayerOfGame({ game_id: Number(id), player_id: Number(potgPlayer) });
      await load();
      toast('Player of the Game saved!');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSettingPotg(false);
    }
  }

  async function deleteGame() {
    if (!window.confirm('Delete this game? This cannot be undone.')) return;
    try {
      await api.deleteGame(id);
      navigate('/games');
    } catch (e) {
      toast(e.message, 'error');
    }
  }


  // ── Render ───────────────────────────────────────────────────────────────────

  if (error) return <ErrorState message={error} />;
  if (!game)  return <Spinner />;

  const isScheduled = game.status === 'scheduled';
  const isLive      = game.status === 'live';
  const isHalftime  = game.status === 'halftime';
  const isComplete  = game.status === 'complete';
  const canEdit     = !isComplete;

  const homeGoals = (game.goals ?? []).filter(g => g.team_id === game.home_team);
  const awayGoals = (game.goals ?? []).filter(g => g.team_id === game.away_team);
  const result    = getResult(game, myTeam?.id);

  // ── Scheduled ────────────────────────────────────────────────────────────────
  if (isScheduled) {
    return (
      <div>
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

          <p className="text-pitch-400 text-xs mb-4">
            <span className="bg-gray-600 text-gray-200 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mr-2">
              Scheduled
            </span>
            {formatDate(game.date)}
          </p>

          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="text-right flex-1">
              <p className="font-bebas text-white text-2xl leading-tight">{game.home_team_name}</p>
              <p className="text-[10px] uppercase tracking-widest text-pitch-500">Home</p>
            </div>
            <span className="font-bebas text-pitch-500 text-3xl shrink-0">vs</span>
            <div className="flex-1">
              <p className="font-bebas text-white text-2xl leading-tight">{game.away_team_name}</p>
              <p className="text-[10px] uppercase tracking-widest text-pitch-500">Away</p>
            </div>
          </div>

          {game.notes && (
            <p className="text-pitch-400 text-sm text-center italic mt-3">"{game.notes}"</p>
          )}
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          <p className="text-gray-400 text-sm">Game has not started yet</p>
          <Btn variant="primary" size="lg" onClick={startGame} disabled={actioning}>
            ▶ Start Game
          </Btn>
        </div>
      </div>
    );
  }

  // ── Live ─────────────────────────────────────────────────────────────────────
  if (isLive) {
    const homeIsMyTeam = game.home_team === myTeam?.id;

    return (
      <div>
        {/* Header */}
        <div className="bg-pitch-900 px-4 md:px-6 py-5">
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

          {/* Live badge + half-time/full-time controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Live</span>
            </div>

            {!confirmHalftime && !confirmFulltime && (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmHalftime(true)}
                  disabled={actioning}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  ⏸ Half Time
                </button>
                <button
                  onClick={() => setConfirmFulltime(true)}
                  disabled={actioning}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  ✓ Full Time
                </button>
              </div>
            )}
            {confirmHalftime && (
              <div className="flex items-center gap-2">
                <span className="text-amber-300 text-xs">End first half?</span>
                <button onClick={handleHalftime} className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Yes</button>
                <button onClick={() => setConfirmHalftime(false)} className="bg-white/10 text-white text-xs font-bold px-2 py-1.5 rounded-lg">Cancel</button>
              </div>
            )}
            {confirmFulltime && (
              <div className="flex items-center gap-2">
                <span className="text-emerald-300 text-xs">End the match?</span>
                <button onClick={handleFulltime} className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Yes</button>
                <button onClick={() => setConfirmFulltime(false)} className="bg-white/10 text-white text-xs font-bold px-2 py-1.5 rounded-lg">Cancel</button>
              </div>
            )}
          </div>

          {/* Timer */}
          <div className="text-center mb-4">
            <p className="font-bebas text-5xl text-white tracking-widest">{formatTimer(timerSeconds)}</p>
            <p className="text-pitch-500 text-[10px] uppercase tracking-widest mt-0.5">{formatDate(game.date)}</p>
          </div>

          {/* Score — always home left, away right */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-right flex-1">
              <p className="font-bebas text-white text-xl md:text-2xl leading-tight">{game.home_team_name}</p>
              <p className="text-[10px] uppercase tracking-widest text-pitch-500">Home</p>
            </div>
            <ScoreEditor game={game} onSave={saveScore} />
            <div className="flex-1">
              <p className="font-bebas text-white text-xl md:text-2xl leading-tight">{game.away_team_name}</p>
              <p className="text-[10px] uppercase tracking-widest text-pitch-500">Away</p>
            </div>
          </div>
        </div>

        {/* Goal panels — always home left, away right; My Team panel has player picker */}
        <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200">
          {[
            { side: 'home', name: game.home_team_name, goals: homeGoals, isMyTeam: homeIsMyTeam },
            { side: 'away', name: game.away_team_name, goals: awayGoals, isMyTeam: !homeIsMyTeam },
          ].map(panel => (
            <div key={panel.side} className="p-4">
              <p className="font-bebas text-pitch-900 text-lg tracking-wide mb-2 truncate">{panel.name}</p>
              <div className="divide-y divide-gray-100 mb-3">
                {panel.goals.length === 0
                  ? <p className="text-gray-300 text-xs py-2">No goals yet</p>
                  : panel.goals.map(g => (
                      <GoalRow key={g.id} goal={g} canDelete={canEdit} onDelete={removeGoal} />
                    ))
                }
              </div>
              {panel.isMyTeam ? (
                <button
                  onClick={() => handleGoalButtonClick(panel.side)}
                  className="w-full bg-pitch-800 hover:bg-pitch-700 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                >
                  + Goal
                </button>
              ) : (
                <button
                  onClick={() => handleGoalButtonClick(panel.side)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-pitch-700 text-xs font-bold py-2 rounded-lg transition-colors"
                >
                  + Goal
                </button>
              )}
            </div>
          ))}
        </div>

        {/* POTG */}
        <div className="p-4 md:p-6 max-w-2xl">
          <PotgSection
            game={game}
            myTeamPlayers={myTeamPlayers}
            potgPlayer={potgPlayer}
            setPotgPlayer={setPotgPlayer}
            settingPotg={settingPotg}
            savePotg={savePotg}
          />
        </div>

        {showPlayerPicker && (
          <PlayerPickerModal
            players={myTeamPlayers}
            onSelect={handlePlayerSelected}
            onClose={() => { setShowPlayerPicker(false); setPendingGoalSide(null); }}
          />
        )}
      </div>
    );
  }

  // ── Halftime ─────────────────────────────────────────────────────────────────
  if (isHalftime) {
    return (
      <div>
        <div className="bg-pitch-900 px-4 md:px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <Link to="/games" className="text-pitch-400 hover:text-white text-sm transition-colors">← All Games</Link>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
              Half Time
            </span>
            <span className="text-pitch-500 text-xs">{formatDate(game.date)}</span>
          </div>

          <div className="text-center mb-4">
            <p className="text-pitch-500 text-[10px] font-bold uppercase tracking-widest">First Half</p>
            <p className="font-bebas text-5xl text-amber-300 tracking-widest">{formatTimer(timerSeconds)}</p>
          </div>

          {/* Score — always home left, away right */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-right flex-1">
              <p className="font-bebas text-white text-xl leading-tight">{game.home_team_name}</p>
              <p className="text-[10px] uppercase tracking-widest text-pitch-500">Home</p>
            </div>
            <ScoreEditor game={game} onSave={saveScore} />
            <div className="flex-1">
              <p className="font-bebas text-white text-xl leading-tight">{game.away_team_name}</p>
              <p className="text-[10px] uppercase tracking-widest text-pitch-500">Away</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-2xl space-y-6">
          <Btn variant="primary" size="lg" className="w-full" onClick={handleRestart} disabled={actioning}>
            ▶ Start Second Half
          </Btn>

          {(homeGoals.length > 0 || awayGoals.length > 0) && (
            <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h2 className="font-bebas text-pitch-900 text-xl tracking-wide">⚽ First Half Goals</h2>
              </div>
              <div className="divide-y divide-gray-100 px-4">
                {[...homeGoals, ...awayGoals]
                  .sort((a, b) => a.elapsed_seconds - b.elapsed_seconds)
                  .map(g => (
                    <GoalRow key={g.id} goal={g} canDelete={true} onDelete={removeGoal} />
                  ))
                }
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ── Complete ──────────────────────────────────────────────────────────────────
  const myScore  = myTeamIsHome ? game.home_score : game.away_score;
  const oppScore = myTeamIsHome ? game.away_score : game.home_score;
  const oppName  = myTeamIsHome ? game.away_team_name : game.home_team_name;

  return (
    <div>
      <div className="bg-pitch-900 px-4 md:px-6 py-5">
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

        <div className="flex items-center gap-2 mb-4">
          <span className="bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
            Full Time
          </span>
          <span className="text-pitch-500 text-xs">{formatDate(game.date)}</span>
        </div>

        {timerSeconds > 0 && (
          <div className="text-center mb-4">
            <p className="text-pitch-500 text-[10px] font-bold uppercase tracking-widest">Match Duration</p>
            <p className="font-bebas text-4xl text-pitch-300 tracking-widest">{formatTimer(timerSeconds)}</p>
          </div>
        )}

        {/* Score — always home left, away right */}
        <div className="flex items-center justify-center gap-4">
          <div className="text-right flex-1">
            <p className="font-bebas text-white text-xl md:text-2xl leading-tight">{game.home_team_name}</p>
            <p className="text-[10px] uppercase tracking-widest text-pitch-500">Home</p>
          </div>
          <ScoreEditor game={game} onSave={saveScore} />
          <div className="flex-1">
            <p className="font-bebas text-white text-xl md:text-2xl leading-tight">{game.away_team_name}</p>
            <p className="text-[10px] uppercase tracking-widest text-pitch-500">Away</p>
          </div>
        </div>

        {result && (
          <p className={`font-bebas text-base tracking-widest text-center mt-3 ${RESULT_COLOR[result]}`}>
            {myTeam?.name} — {RESULT_LABEL[result]} {myScore}–{oppScore} {oppName}
          </p>
        )}

        {game.notes && (
          <p className="text-pitch-400 text-sm text-center italic mt-3">"{game.notes}"</p>
        )}
      </div>

      <div className="p-4 md:p-6 max-w-2xl space-y-6">
        <div className="flex gap-3">
          <Btn variant="secondary" onClick={() => setShowShareModal(true)}>📋 Share Result</Btn>
          {user?.role === 'admin' && (
            <Btn variant="ghost" onClick={handleReopen} disabled={actioning}>Reopen Game</Btn>
          )}
        </div>

        {(game.goals ?? []).length > 0 && (
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-bebas text-pitch-900 text-xl tracking-wide">⚽ Goals</h2>
            </div>
            <div className="divide-y divide-gray-100 px-4">
              {(game.goals ?? []).map(g => (
                <GoalRow key={g.id} goal={g} canDelete={false} onDelete={null} />
              ))}
            </div>
          </section>
        )}

        <PotgSection
          game={game}
          myTeamPlayers={myTeamPlayers}
          potgPlayer={potgPlayer}
          setPotgPlayer={setPotgPlayer}
          settingPotg={settingPotg}
          savePotg={savePotg}
        />

        {game.created_by_name && (
          <p className="text-[11px] text-gray-400 text-center">Added by {game.created_by_name}</p>
        )}
      </div>

      {showShareModal && (
        <ShareModal gameId={id} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
}

function ShareModal({ gameId, onClose }) {
  const [shareText,  setShareText]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const shareUrl = `${window.location.origin}/games/${gameId}/share`;

  useEffect(() => {
    api.getShareText(gameId)
      .then(({ text }) => { setShareText(text); setLoading(false); })
      .catch(e => { setFetchError(e.message); setLoading(false); });
  }, [gameId]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch { /* ignore */ }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch { /* ignore */ }
  }

  async function nativeShare() {
    const lines = shareText?.split('\n') ?? [];
    const title = `Matchday Result — ${lines[2] ?? 'Match'}`;
    try {
      await navigator.share({ title, text: shareText, url: shareUrl });
    } catch { /* user cancelled */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-5 pb-safe md:pb-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bebas text-pitch-900 text-2xl tracking-wide">Share Result</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-xl leading-none">✕</button>
        </div>

        {loading && <div className="flex justify-center py-8"><Spinner /></div>}
        {fetchError && <p className="text-red-500 text-sm text-center py-4">{fetchError}</p>}

        {shareText && (
          <>
            <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-pitch-800 whitespace-pre-wrap font-mono leading-relaxed mb-4 max-h-64 overflow-y-auto">
              {shareText}
            </pre>
            <div className="flex flex-col gap-2">
              <button
                onClick={copyText}
                className="w-full bg-pitch-800 hover:bg-pitch-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {copiedText ? '✓ Copied!' : '📋 Copy Text'}
              </button>
              <button
                onClick={copyLink}
                className="w-full bg-gray-100 hover:bg-gray-200 text-pitch-900 font-bold py-3 rounded-xl transition-colors"
              >
                {copiedLink ? '✓ Copied!' : '🔗 Copy Link'}
              </button>
              {typeof navigator.share === 'function' && (
                <button
                  onClick={nativeShare}
                  className="w-full bg-pitch-50 hover:bg-pitch-100 text-pitch-800 font-bold py-3 rounded-xl transition-colors"
                >
                  ↗ Share
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PotgSection({ game, myTeamPlayers, potgPlayer, setPotgPlayer, settingPotg, savePotg }) {
  return (
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
              {myTeamPlayers.map(p => (
                <option key={p.id} value={p.id}>#{p.jersey_number} {p.name}</option>
              ))}
            </select>
          </div>
          <Btn variant="primary" size="sm" onClick={savePotg} disabled={!potgPlayer || settingPotg}>
            {settingPotg ? '…' : 'Save'}
          </Btn>
        </div>
      </div>
    </section>
  );
}
