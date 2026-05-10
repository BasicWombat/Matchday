import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { Spinner, ErrorState, PageHeader, Btn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSeason } from '../context/SeasonContext';

const EMPTY = { date: '', opponent: '', homeAway: 'home', notes: '' };

export default function GameForm() {
  const { user }   = useAuth();
  const { activeSeason } = useSeason();
  const { id }     = useParams();
  const navigate   = useNavigate();
  const isEdit     = Boolean(id);

  const [teams,   setTeams]   = useState([]);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);

  const [addingOpponent,  setAddingOpponent]  = useState(false);
  const [newOpponentName, setNewOpponentName] = useState('');
  const [savingOpponent,  setSavingOpponent]  = useState(false);
  const newOpponentRef = useRef(null);

  useEffect(() => {
    const fetches = [api.getTeams()];
    if (isEdit) fetches.push(api.getGame(id));

    Promise.all(fetches)
      .then(([allTeams, game]) => {
        setTeams(allTeams);
        if (game) {
          const myTeamIsHome = game.home_team === user?.my_team_id;
          setForm({
            date:     game.date,
            opponent: String(myTeamIsHome ? game.away_team : game.home_team),
            homeAway: myTeamIsHome ? 'home' : 'away',
            notes:    game.notes ?? '',
          });
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id, isEdit]);

  useEffect(() => {
    if (addingOpponent) newOpponentRef.current?.focus();
  }, [addingOpponent]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleOpponentChange(e) {
    if (e.target.value === '__new__') {
      setAddingOpponent(true);
    } else {
      set('opponent', e.target.value);
    }
  }

  async function handleAddOpponent() {
    if (!newOpponentName.trim()) return;
    // If a team with this name already exists, select it instead of creating a duplicate
    const existing = teams.find(t => t.name.toLowerCase() === newOpponentName.trim().toLowerCase());
    if (existing) {
      set('opponent', String(existing.id));
      setNewOpponentName('');
      setAddingOpponent(false);
      return;
    }
    setSavingOpponent(true);
    try {
      const team = await api.createTeam({ name: newOpponentName.trim() });
      setTeams(prev => [...prev, team]);
      set('opponent', String(team.id));
      setNewOpponentName('');
      setAddingOpponent(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingOpponent(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    let resolvedOpponentId;

    if (addingOpponent) {
      if (!newOpponentName.trim()) {
        setError('Please add an opponent name or cancel to select an existing team.');
        setSaving(false);
        return;
      }
      // Check for existing team with same name
      const existing = teams.find(t => t.name.toLowerCase() === newOpponentName.trim().toLowerCase());
      if (existing) {
        resolvedOpponentId = existing.id;
        setNewOpponentName('');
        setAddingOpponent(false);
      } else {
        try {
          const team = await api.createTeam({ name: newOpponentName.trim() });
          setTeams(prev => [...prev, team]);
          setNewOpponentName('');
          setAddingOpponent(false);
          resolvedOpponentId = team.id;
        } catch (e) {
          setError(e.message);
          setSaving(false);
          return;
        }
      }
    } else {
      resolvedOpponentId = Number(form.opponent);
    }

    const myTeam   = teams.find(t => t.id === user?.my_team_id) ?? teams[0];
    const myTeamId = myTeam?.id;

    const payload = {
      date:      form.date,
      home_team: form.homeAway === 'home' ? myTeamId : resolvedOpponentId,
      away_team: form.homeAway === 'home' ? resolvedOpponentId : myTeamId,
      notes:     form.notes.trim() || null,
    };

    try {
      const game = isEdit
        ? await api.updateGame(id, payload)
        : await api.createGame(payload);
      navigate(`/games/${game.id}`);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  if (error && loading) return <ErrorState message={error} />;
  if (loading)          return <Spinner />;

  const myTeam        = teams.find(t => t.id === user?.my_team_id);
  const opponentTeams = teams.filter(t => t.id !== user?.my_team_id);
  const selectedOpponent = opponentTeams.find(t => String(t.id) === form.opponent);

  const homeTeamName = form.homeAway === 'home' ? (myTeam?.name ?? 'My Team') : (selectedOpponent?.name ?? '—');
  const awayTeamName = form.homeAway === 'home' ? (selectedOpponent?.name ?? '—') : (myTeam?.name ?? 'My Team');

  return (
    <div>
      <PageHeader
        eyebrow={isEdit ? 'Edit Match' : 'New Match'}
        title={isEdit ? 'Edit Game' : 'Add Game'}
        action={
          <Link
            to={isEdit ? `/games/${id}` : '/games'}
            className="text-white/60 hover:text-white text-sm transition-colors"
          >
            ← Cancel
          </Link>
        }
      />

      <div className="p-4 md:p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Season (read-only, new games only) ───────── */}
          {!isEdit && activeSeason && (
            <div className="flex items-center gap-2 bg-pitch-50 border border-pitch-200 rounded-lg px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-pitch-500">Season</span>
              <span className="text-sm font-semibold text-pitch-800">{activeSeason.name}</span>
            </div>
          )}

          {/* ── Date ──────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              Match Date
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={e => set('date', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
            />
          </div>

          {/* ── Home or Away toggle ───────────────────────── */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              Home or Away?
            </label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => set('homeAway', 'home')}
                className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                  form.homeAway === 'home'
                    ? 'bg-pitch-800 text-white'
                    : 'bg-white text-pitch-700 hover:bg-gray-50'
                }`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => set('homeAway', 'away')}
                className={`flex-1 py-2.5 text-sm font-bold transition-colors border-l border-gray-200 ${
                  form.homeAway === 'away'
                    ? 'bg-pitch-800 text-white'
                    : 'bg-white text-pitch-700 hover:bg-gray-50'
                }`}
              >
                Away
              </button>
            </div>
          </div>

          {/* ── Matchup preview ───────────────────────────── */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0 text-right">
                <p className="font-bebas text-pitch-900 text-lg leading-tight truncate">{homeTeamName}</p>
                <p className="text-[10px] uppercase tracking-widest text-pitch-400">Home</p>
              </div>
              <span className="text-pitch-400 text-sm shrink-0">vs</span>
              <div className="flex-1 min-w-0">
                <p className="font-bebas text-pitch-900 text-lg leading-tight truncate">{awayTeamName}</p>
                <p className="text-[10px] uppercase tracking-widest text-pitch-400">Away</p>
              </div>
            </div>
          </div>

          {/* ── Opponent ──────────────────────────────────── */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              Opponent
            </label>
            {addingOpponent ? (
              <div className="flex gap-1.5">
                <input
                  ref={newOpponentRef}
                  type="text"
                  placeholder="Team name…"
                  value={newOpponentName}
                  onChange={e => setNewOpponentName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddOpponent(); }
                    if (e.key === 'Escape') { setAddingOpponent(false); setNewOpponentName(''); }
                  }}
                  className="flex-1 min-w-0 border border-pitch-400 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddOpponent}
                  disabled={savingOpponent || !newOpponentName.trim()}
                  className="shrink-0 bg-pitch-800 hover:bg-pitch-700 disabled:opacity-50 text-white text-xs font-bold px-2 py-1.5 rounded-lg transition-colors"
                >
                  {savingOpponent ? '…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingOpponent(false); setNewOpponentName(''); }}
                  className="shrink-0 text-gray-400 hover:text-gray-600 text-xs px-1"
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                required
                value={form.opponent}
                onChange={handleOpponentChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
              >
                <option value="">Select opponent…</option>
                {opponentTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                <option value="__new__">+ Add new opponent…</option>
              </select>
            )}
          </div>

          {/* ── Notes ─────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              Notes <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Great team performance, tough conditions…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 resize-none bg-white"
            />
          </div>

          {/* ── Error ─────────────────────────────────────── */}
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* ── Submit ────────────────────────────────────── */}
          <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update Game' : 'Add Game'}
          </Btn>
        </form>
      </div>
    </div>
  );
}
