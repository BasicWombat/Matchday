import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Spinner, ErrorState, EmptyState, PageHeader, Btn } from '../components/ui';
import { useToast } from '../components/Toast';

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

const EMPTY_FORM = { name: '', jersey_number: '', team_id: '' };

export default function Players() {
  const toast = useToast();
  const [teams,   setTeams]   = useState([]);
  const [players, setPlayers] = useState([]);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);

  const [form,    setForm]    = useState(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() =>
    Promise.all([api.getTeams(), api.getPlayers()])
      .then(([t, p]) => { setTeams(t); setPlayers(p); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); }),
  []);

  useEffect(() => {
    load();
  }, [load]);

  // Pre-select first team when teams load
  useEffect(() => {
    if (teams.length > 0 && !form.team_id) {
      setForm(f => ({ ...f, team_id: String(teams[0].id) }));
    }
  }, [teams, form.team_id]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function addPlayer(e) {
    e.preventDefault();
    setFormErr(null);
    setSaving(true);
    try {
      await api.createPlayer({
        name:          form.name.trim(),
        team_id:       Number(form.team_id),
        jersey_number: Number(form.jersey_number),
      });
      setForm({ ...EMPTY_FORM, team_id: form.team_id }); // keep team selection
      setShowAdd(false);
      await load();
      toast('Player added!');
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePlayer(id, name) {
    if (!window.confirm(`Remove ${name} from the squad?`)) return;
    try {
      await api.deletePlayer(id);
      await load();
      toast(`${name} removed from squad`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (error)   return <ErrorState message={error} />;
  if (loading) return <Spinner />;

  // Group players by team
  const byTeam = teams.map(team => ({
    ...team,
    players: players.filter(p => p.team_id === team.id).sort((a, b) => a.jersey_number - b.jersey_number),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Squad Management"
        title="Players"
        action={
          <button
            onClick={() => setShowAdd(v => !v)}
            className="bg-gold-500 hover:bg-gold-400 text-pitch-950 font-bold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {showAdd ? '✕ Cancel' : '+ Add Player'}
          </button>
        }
      />

      <div className="p-4 md:p-6 space-y-6 max-w-2xl">
        {/* ── Add player form ────────────────────────────── */}
        {showAdd && (
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-pitch-900 border-b border-pitch-800">
              <h2 className="font-bebas text-white text-xl tracking-wide">New Player</h2>
            </div>
            <form onSubmit={addPlayer} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                  Team
                </label>
                <select
                  required
                  value={form.team_id}
                  onChange={e => set('team_id', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-400"
                >
                  <option value="">Select team…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                    Player Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sam Rivera"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-400"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                    Jersey #
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    required
                    placeholder="e.g. 7"
                    value={form.jersey_number}
                    onChange={e => set('jersey_number', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pitch-400"
                  />
                </div>
              </div>

              {formErr && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formErr}</p>
              )}

              <Btn type="submit" variant="primary" className="w-full" disabled={saving}>
                {saving ? 'Adding…' : 'Add Player'}
              </Btn>
            </form>
          </section>
        )}

        {/* ── Players by team ───────────────────────────── */}
        {byTeam.length === 0 && (
          <EmptyState message="No teams set up yet — the squad will appear here once a team is added 👥" />
        )}
        {byTeam.map(team => (
          <section key={team.id}>
            {/* Team header */}
            <div className="flex items-end justify-between mb-3">
              <div>
                <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide">{team.name}</h2>
                <p className="text-xs text-gray-400">Season {team.season}</p>
              </div>
              <span className="text-xs font-bold text-pitch-400">
                {team.players.length} {team.players.length === 1 ? 'player' : 'players'}
              </span>
            </div>

            {team.players.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-xl p-6 text-center">
                <p className="text-gray-400 text-sm">No players yet — add the first one!</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {team.players.map(player => (
                  <div key={player.id} className="flex items-center gap-3 px-4 py-3 group">
                    {/* Jersey badge */}
                    <div className="w-9 h-9 rounded-lg bg-pitch-900 flex items-center justify-center shrink-0">
                      <span className="font-bebas text-gold-400 text-lg leading-none">
                        {player.jersey_number}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-pitch-900 text-sm truncate">{player.name}</p>
                      <p className="text-xs text-gray-400">#{player.jersey_number} · {team.name}</p>
                    </div>

                    <button
                      onClick={() => deletePlayer(player.id, player.name)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Remove player"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
