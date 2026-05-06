import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { Spinner, ErrorState, PageHeader, Btn } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const EMPTY = { date: '', home_team: '', away_team: '', notes: '' };

export default function GameForm() {
  const { user }   = useAuth();
  const { id }     = useParams();
  const navigate   = useNavigate();
  const isEdit     = Boolean(id);

  const [teams,   setTeams]   = useState([]);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Inline "add new opponent" state
  const [addingOpponent,    setAddingOpponent]    = useState(false);
  const [newOpponentName,   setNewOpponentName]   = useState('');
  const [savingOpponent,    setSavingOpponent]    = useState(false);
  const newOpponentRef = useRef(null);

  useEffect(() => {
    const fetches = [api.getTeams()];
    if (isEdit) fetches.push(api.getGame(id));

    Promise.all(fetches)
      .then(([allTeams, game]) => {
        setTeams(allTeams);
        if (game) {
          setForm({
            date:      game.date,
            home_team: String(game.home_team),
            away_team: String(game.away_team),
            notes:     game.notes ?? '',
          });
        } else {
          // Default home team to "my team"
          const myTeam = allTeams.find(t => t.id === user?.my_team_id) ?? allTeams[0];
          if (myTeam) setForm(f => ({ ...f, home_team: String(myTeam.id) }));
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id, isEdit]);

  // Focus the new opponent input when it appears
  useEffect(() => {
    if (addingOpponent) newOpponentRef.current?.focus();
  }, [addingOpponent]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleAwayChange(e) {
    if (e.target.value === '__new__') {
      setAddingOpponent(true);
    } else {
      set('away_team', e.target.value);
    }
  }

  async function handleAddOpponent() {
    if (!newOpponentName.trim()) return;
    setSavingOpponent(true);
    try {
      const team = await api.createTeam({ name: newOpponentName.trim() });
      setTeams(prev => [...prev, team]);
      set('away_team', String(team.id));
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

    const payload = {
      date:      form.date,
      home_team: Number(form.home_team),
      away_team: Number(form.away_team),
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

  const myTeam     = teams.find(t => t.id === user?.my_team_id);
  // Away team options: all teams except my team (they're opponents)
  const awayTeams  = teams.filter(t => t.id !== user?.my_team_id || (isEdit && String(t.id) === form.away_team));

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

          {/* ── Teams ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Home team — locked to My Team */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                Home Team
              </label>
              {isEdit ? (
                <select
                  required
                  value={form.home_team}
                  onChange={e => set('home_team', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                >
                  <option value="">Select…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              ) : (
                <div className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-pitch-700 flex items-center gap-1.5">
                  <span className="text-gold-500">⭐</span>
                  {myTeam?.name ?? 'My Team'}
                </div>
              )}
            </div>

            {/* Away team — opponents only + add new inline */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                Away Team
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
                  value={form.away_team}
                  onChange={handleAwayChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                >
                  <option value="">Select…</option>
                  {awayTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  <option value="__new__">+ Add new opponent…</option>
                </select>
              )}
            </div>
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
