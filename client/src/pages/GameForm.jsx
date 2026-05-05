import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { Spinner, ErrorState, PageHeader, Btn } from '../components/ui';

const EMPTY = { date: '', home_team: '', away_team: '', home_score: '0', away_score: '0', notes: '' };

export default function GameForm() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const isEdit     = Boolean(id);

  const [teams,   setTeams]   = useState([]);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetches = [api.getTeams()];
    if (isEdit) fetches.push(api.getGame(id));

    Promise.all(fetches)
      .then(([teams, game]) => {
        setTeams(teams);
        if (game) {
          setForm({
            date:       game.date,
            home_team:  String(game.home_team),
            away_team:  String(game.away_team),
            home_score: String(game.home_score),
            away_score: String(game.away_score),
            notes:      game.notes ?? '',
          });
        } else if (teams.length >= 1) {
          // Pre-select first team as home
          setForm(f => ({ ...f, home_team: String(teams[0].id) }));
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id, isEdit]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      date:       form.date,
      home_team:  Number(form.home_team),
      away_team:  Number(form.away_team),
      home_score: Number(form.home_score),
      away_score: Number(form.away_score),
      notes:      form.notes.trim() || null,
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
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                Home Team
              </label>
              <select
                required
                value={form.home_team}
                onChange={e => set('home_team', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
              >
                <option value="">Select…</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                Away Team
              </label>
              <select
                required
                value={form.away_team}
                onChange={e => set('away_team', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
              >
                <option value="">Select…</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* ── Score ─────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              Final Score
            </label>
            <div className="flex items-center gap-3 bg-pitch-900 rounded-xl px-4 py-4 w-fit">
              <div className="text-center">
                <p className="text-[10px] text-pitch-400 uppercase tracking-widest mb-1">Home</p>
                <input
                  type="number"
                  min="0"
                  max="99"
                  required
                  value={form.home_score}
                  onChange={e => set('home_score', e.target.value)}
                  className="w-16 text-center bg-white/10 text-white font-bebas text-4xl rounded-lg py-1 focus:outline-none focus:bg-white/20 border border-white/10"
                />
              </div>
              <span className="font-bebas text-3xl text-pitch-500 mt-5">—</span>
              <div className="text-center">
                <p className="text-[10px] text-pitch-400 uppercase tracking-widest mb-1">Away</p>
                <input
                  type="number"
                  min="0"
                  max="99"
                  required
                  value={form.away_score}
                  onChange={e => set('away_score', e.target.value)}
                  className="w-16 text-center bg-white/10 text-white font-bebas text-4xl rounded-lg py-1 focus:outline-none focus:bg-white/20 border border-white/10"
                />
              </div>
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
