import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Spinner, ErrorState, PageHeader, Btn } from '../components/ui';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useSeason } from '../context/SeasonContext';

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

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

let nextRowId = 1;

export default function Settings() {
  const toast = useToast();
  const { user: currentUser, setUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const { seasons, refreshSeasons, setSelectedSeasonId } = useSeason();

  const [tab, setTab] = useState('teams');

  // Seasons
  const [seasonEditingId,   setSeasonEditingId]   = useState(null);
  const [seasonEditName,    setSeasonEditName]     = useState('');
  const [seasonEditYear,    setSeasonEditYear]     = useState('');
  const [seasonEditSaving,  setSeasonEditSaving]   = useState(false);
  const [newSeason,         setNewSeason]          = useState({ name: '', year: '' });
  const [addingSeason,      setAddingSeason]       = useState(false);
  const [justCreated,       setJustCreated]        = useState(null);
  const [settingActiveId,   setSettingActiveId]    = useState(null);
  const seasonEditRef = useRef(null);

  useEffect(() => {
    if (seasonEditingId !== null) seasonEditRef.current?.focus();
  }, [seasonEditingId]);

  // Teams
  const [teams,   setTeams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Inline edit
  const [editingId,  setEditingId]  = useState(null);
  const [editName,   setEditName]   = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const editInputRef = useRef(null);

  // Create Team form
  const [showCreate,  setShowCreate]  = useState(false);
  const [createForm,  setCreateForm]  = useState({ name: '', season: '' });
  const [playerRows,  setPlayerRows]  = useState([]);
  const [creating,    setCreating]    = useState(false);

  // Users (admin only)
  const [users,        setUsers]        = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUser,      setNewUser]      = useState({ username: '', display_name: '', email: '', password: '', confirmPassword: '', role: 'member' });
  const [addingUser,   setAddingUser]   = useState(false);
  const [addUserError, setAddUserError] = useState(null);

  // Edit user modal
  const [editingUser,    setEditingUser]    = useState(null);
  const [editUserForm,   setEditUserForm]   = useState(null);
  const [editUserSaving, setEditUserSaving] = useState(false);
  const [editUserError,  setEditUserError]  = useState(null);

  useEffect(() => {
    api.getTeams()
      .then(setTeams)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    api.getUsers().then(setUsers).catch(e => toast(e.message, 'error')).finally(() => setLoadingUsers(false));
  }, [isAdmin]);

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus();
  }, [editingId]);

  // ── My Team ────────────────────────────────────────────────────────────────

  async function handleSetMyTeam(id) {
    try {
      const updatedUser = await api.setMyTeam(id);
      setUser(updatedUser);
      toast('My Team updated!');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Team edit / delete ─────────────────────────────────────────────────────

  function startEdit(team) { setEditingId(team.id); setEditName(team.name); }
  function cancelEdit()    { setEditingId(null); setEditName(''); }

  async function saveEdit(id) {
    if (!editName.trim()) return;
    setEditSaving(true);
    try {
      const updated = await api.updateTeam(id, { name: editName.trim() });
      setTeams(prev => prev.map(t => t.id === id ? { ...t, name: updated.name } : t));
      setEditingId(null);
      toast('Team name updated!');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteTeam(team) {
    if (!window.confirm(
      `Delete ${team.name}? This will also delete all players on this team. Games they appeared in will be kept.`
    )) return;
    try {
      await api.deleteTeam(team.id);
      setTeams(prev => prev.filter(t => t.id !== team.id));
      toast(`"${team.name}" deleted.`);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Create Team ────────────────────────────────────────────────────────────

  function addPlayerRow() {
    setPlayerRows(prev => [...prev, { id: nextRowId++, name: '', jersey: '' }]);
  }

  function removePlayerRow(id) {
    setPlayerRows(prev => prev.filter(r => r.id !== id));
  }

  function updatePlayerRow(id, field, value) {
    setPlayerRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function cancelCreate() {
    setShowCreate(false);
    setCreateForm({ name: '', season: '' });
    setPlayerRows([]);
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const team = await api.createTeam({ name: createForm.name.trim(), season: createForm.season.trim() });
      const validPlayers = playerRows.filter(r => r.name.trim() && r.jersey !== '');
      for (const p of validPlayers) {
        await api.createPlayer({ name: p.name.trim(), team_id: team.id, jersey_number: Number(p.jersey) });
      }
      setTeams(prev => [...prev, team]);
      cancelCreate();
      toast(`"${team.name}" created!`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  // ── Seasons ────────────────────────────────────────────────────────────────

  function startSeasonEdit(s) {
    setSeasonEditingId(s.id);
    setSeasonEditName(s.name);
    setSeasonEditYear(s.year ? String(s.year) : '');
  }
  function cancelSeasonEdit() { setSeasonEditingId(null); }

  async function saveSeasonEdit(id) {
    if (!seasonEditName.trim()) return;
    setSeasonEditSaving(true);
    try {
      await api.updateSeason(id, { name: seasonEditName.trim(), year: seasonEditYear || null });
      await refreshSeasons();
      setSeasonEditingId(null);
      toast('Season updated!');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSeasonEditSaving(false);
    }
  }

  async function handleSetActiveSeason(id) {
    setSettingActiveId(id);
    try {
      await api.setActiveSeason(id);
      await refreshSeasons();
      setSelectedSeasonId(id);
      toast('Active season updated!');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSettingActiveId(null);
    }
  }

  async function handleDeleteSeason(s) {
    if (!window.confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    try {
      await api.deleteSeason(s.id);
      await refreshSeasons();
      toast(`"${s.name}" deleted.`);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleAddSeason(e) {
    e.preventDefault();
    if (!newSeason.name.trim()) return;
    setAddingSeason(true);
    try {
      const created = await api.createSeason({ name: newSeason.name.trim(), year: newSeason.year || null });
      await refreshSeasons();
      setNewSeason({ name: '', year: '' });
      setJustCreated(created);
      toast(`"${created.name}" created!`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAddingSeason(false);
    }
  }

  async function handleSetJustCreatedActive() {
    if (!justCreated) return;
    await handleSetActiveSeason(justCreated.id);
    setJustCreated(null);
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  async function handleAddUser(e) {
    e.preventDefault();
    setAddUserError(null);
    if (newUser.password !== newUser.confirmPassword) {
      setAddUserError('Passwords do not match');
      return;
    }
    setAddingUser(true);
    try {
      const { confirmPassword: _, ...payload } = newUser;
      const created = await api.createUser({ ...payload, email: payload.email || null });
      setUsers(prev => [...prev, created]);
      setNewUser({ username: '', display_name: '', email: '', password: '', confirmPassword: '', role: 'member' });
      toast(`User "${created.display_name}" created!`);
    } catch (err) {
      setAddUserError(err.message);
    } finally {
      setAddingUser(false);
    }
  }

  async function handleDeleteUser(u) {
    if (!window.confirm(
      `Delete "${u.display_name}"? This cannot be undone. Their game and goal records will be kept.`
    )) return;
    try {
      await api.deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast(`User "${u.display_name}" deleted.`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function startEditUser(u) {
    setEditingUser(u);
    setEditUserForm({
      display_name:    u.display_name,
      username:        u.username,
      email:           u.email ?? '',
      role:            u.role,
      newPassword:     '',
      confirmPassword: '',
    });
    setEditUserError(null);
  }

  function cancelEditUser() {
    setEditingUser(null);
    setEditUserForm(null);
    setEditUserError(null);
  }

  async function handleEditUser(e) {
    e.preventDefault();
    setEditUserError(null);
    if (!editUserForm.display_name.trim()) { setEditUserError('Display name is required'); return; }
    if (!editUserForm.username.trim())     { setEditUserError('Username is required'); return; }
    if (editUserForm.newPassword && editUserForm.newPassword !== editUserForm.confirmPassword) {
      setEditUserError('Passwords do not match');
      return;
    }
    setEditUserSaving(true);
    try {
      const payload = {
        display_name: editUserForm.display_name.trim(),
        username:     editUserForm.username.trim(),
        email:        editUserForm.email.trim() || null,
        role:         editUserForm.role,
      };
      if (editUserForm.newPassword) payload.password = editUserForm.newPassword;
      const updated = await api.updateUser(editingUser.id, payload);
      setUsers(prev => prev.map(u => u.id === editingUser.id ? updated : u));
      if (editingUser.id === currentUser.id) {
        setUser(prev => ({ ...prev, ...updated }));
      }
      cancelEditUser();
      toast(`User "${updated.display_name}" updated!`);
    } catch (err) {
      setEditUserError(err.message);
    } finally {
      setEditUserSaving(false);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  if (error && loading) return <ErrorState message={error} />;
  if (loading)          return <Spinner />;

  const myTeam = teams.find(t => t.id === currentUser?.my_team_id);
  const tabs   = isAdmin ? ['teams', 'seasons', 'users'] : null;

  return (
    <div>
      <PageHeader eyebrow="App" title="Settings" />

      {/* ── Tabs ────────────────────────────────────────────── */}
      {tabs && (
        <div className="px-4 md:px-6 border-b border-gray-200">
          <div className="flex gap-0">
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${
                  tab === t
                    ? 'border-pitch-900 text-pitch-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 max-w-lg space-y-8">

        {/* ══ Teams tab ═══════════════════════════════════════ */}
        {tab === 'teams' && (
          <>
            {/* My Team */}
            <section>
              <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">My Team</h2>
              {myTeam ? (
                <div className="bg-gold-500/10 border border-gold-400/30 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">⭐</span>
                  <div>
                    <p className="font-bold text-pitch-900">{myTeam.name}</p>
                    {myTeam.season && <p className="text-xs text-gray-500">Season {myTeam.season}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No team set — click "Set as My Team" below.</p>
              )}
            </section>

            {/* All Teams */}
            <section>
              <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">All Teams</h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {teams.map(team => {
                  const isMyTeam = team.id === currentUser?.my_team_id;
                  return (
                    <div key={team.id} className="px-4 py-3">
                      {editingId === team.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  { e.preventDefault(); saveEdit(team.id); }
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="flex-1 min-w-0 border border-pitch-400 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                          />
                          {isMyTeam && (
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gold-600 bg-gold-100 border border-gold-300 px-1.5 py-0.5 rounded">
                              ⭐ My Team
                            </span>
                          )}
                          <Btn size="sm" variant="primary" onClick={() => saveEdit(team.id)} disabled={editSaving || !editName.trim()}>
                            {editSaving ? '…' : 'Save'}
                          </Btn>
                          <Btn size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Btn>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-pitch-900 text-sm truncate">{team.name}</p>
                              {isMyTeam && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gold-600 bg-gold-100 border border-gold-300 px-1.5 py-0.5 rounded">
                                  ⭐ My Team
                                </span>
                              )}
                            </div>
                            {team.season && <p className="text-xs text-gray-400">Season {team.season}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!isMyTeam && (
                              <Btn variant="secondary" size="sm" onClick={() => handleSetMyTeam(team.id)}>
                                Set as My Team
                              </Btn>
                            )}
                            <button
                              onClick={() => startEdit(team)}
                              className="p-1.5 text-gray-400 hover:text-pitch-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit team name"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team)}
                              disabled={isMyTeam}
                              title={isMyTeam ? 'Switch My Team first before deleting this team' : 'Delete team'}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {teams.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No teams yet.</p>
                )}
              </div>
            </section>

            {/* Create Team */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide">Add Team</h2>
                {!showCreate && (
                  <Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Team</Btn>
                )}
              </div>

              {showCreate && (
                <form onSubmit={handleCreateTeam} className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                  {/* Name + Season */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">
                        Team Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Thunder FC"
                        value={createForm.name}
                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">
                        Season <span className="text-gray-400 normal-case font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2024"
                        value={createForm.season}
                        onChange={e => setCreateForm(f => ({ ...f, season: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                      />
                    </div>
                  </div>

                  {/* Players */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600">
                        Players <span className="text-gray-400 normal-case font-normal">(optional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={addPlayerRow}
                        className="text-xs font-semibold text-pitch-700 hover:text-pitch-900 transition-colors"
                      >
                        + Add Player
                      </button>
                    </div>

                    {playerRows.length > 0 ? (
                      <div className="space-y-2">
                        {playerRows.map(row => (
                          <div key={row.id} className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="99"
                              placeholder="#"
                              value={row.jersey}
                              onChange={e => updatePlayerRow(row.id, 'jersey', e.target.value)}
                              className="w-14 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                            />
                            <input
                              type="text"
                              placeholder="Player name"
                              value={row.name}
                              onChange={e => updatePlayerRow(row.id, 'name', e.target.value)}
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => removePlayerRow(row.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        No players — fine for opponent teams.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Btn type="submit" variant="primary" size="sm" disabled={creating || !createForm.name.trim()}>
                      {creating ? 'Creating…' : 'Create Team'}
                    </Btn>
                    <Btn type="button" variant="ghost" size="sm" onClick={cancelCreate}>
                      Cancel
                    </Btn>
                  </div>
                </form>
              )}
            </section>
          </>
        )}

        {/* ══ Seasons tab (admin only) ════════════════════════ */}
        {tab === 'seasons' && isAdmin && (
          <>
            {/* Season list */}
            <section>
              <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">Seasons</h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {seasons.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No seasons yet.</p>
                )}
                {seasons.map(s => {
                  const isActive  = s.is_active === 1;
                  const hasGames  = s.game_count > 0;
                  const canDelete = !isActive && !hasGames;
                  const deleteTitle = isActive
                    ? 'Cannot delete the active season'
                    : hasGames
                    ? `Cannot delete: ${s.game_count} game${s.game_count !== 1 ? 's' : ''} attached`
                    : 'Delete season';

                  return (
                    <div key={s.id} className="px-4 py-3">
                      {seasonEditingId === s.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              ref={seasonEditRef}
                              type="text"
                              value={seasonEditName}
                              onChange={e => setSeasonEditName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  { e.preventDefault(); saveSeasonEdit(s.id); }
                                if (e.key === 'Escape') cancelSeasonEdit();
                              }}
                              placeholder="Season name"
                              className="flex-1 min-w-0 border border-pitch-400 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                            />
                            <input
                              type="number"
                              value={seasonEditYear}
                              onChange={e => setSeasonEditYear(e.target.value)}
                              placeholder="Year"
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Btn size="sm" variant="primary" onClick={() => saveSeasonEdit(s.id)} disabled={seasonEditSaving || !seasonEditName.trim()}>
                              {seasonEditSaving ? '…' : 'Save'}
                            </Btn>
                            <Btn size="sm" variant="ghost" onClick={cancelSeasonEdit}>Cancel</Btn>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-pitch-900 text-sm">{s.name}</p>
                              {isActive && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {s.year ? `${s.year} · ` : ''}{s.game_count} game{s.game_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!isActive && (
                              <Btn
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSetActiveSeason(s.id)}
                                disabled={settingActiveId === s.id}
                              >
                                {settingActiveId === s.id ? '…' : 'Set Active'}
                              </Btn>
                            )}
                            <button
                              onClick={() => startSeasonEdit(s)}
                              className="p-1.5 text-gray-400 hover:text-pitch-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit season"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={() => canDelete && handleDeleteSeason(s)}
                              disabled={!canDelete}
                              title={deleteTitle}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* "Set as active?" prompt after creation */}
            {justCreated && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-900 mb-3">
                  Set <strong>{justCreated.name}</strong> as the active season?
                </p>
                <div className="flex gap-2">
                  <Btn variant="primary" size="sm" onClick={handleSetJustCreatedActive}>Yes, set active</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setJustCreated(null)}>No, keep current</Btn>
                </div>
              </div>
            )}

            {/* Add Season form */}
            <section>
              <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">Add Season</h2>
              <form onSubmit={handleAddSeason} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Spring 2025"
                      value={newSeason.name}
                      onChange={e => setNewSeason(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">
                      Year <span className="text-gray-400 normal-case font-normal">(optional)</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 2025"
                      value={newSeason.year}
                      onChange={e => setNewSeason(f => ({ ...f, year: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                    />
                  </div>
                </div>
                <Btn type="submit" variant="primary" size="sm" disabled={addingSeason || !newSeason.name.trim()}>
                  {addingSeason ? 'Creating…' : 'Create Season'}
                </Btn>
              </form>
            </section>
          </>
        )}

        {/* ══ Users tab (admin only) ═══════════════════════════ */}
        {tab === 'users' && isAdmin && (
          <>
            {/* User list */}
            <section>
              <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-3">Users</h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {loadingUsers ? (
                  <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
                ) : users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-pitch-900 text-sm truncate">{u.display_name}</p>
                        {u.role === 'admin' ? (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gold-600 bg-gold-100 border border-gold-300 px-1.5 py-0.5 rounded">
                            Admin
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                            Member
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">@{u.username}</p>
                      {u.email
                        ? <p className="text-xs text-gray-400">{u.email}</p>
                        : <p className="text-xs text-gray-300 italic">No email set</p>
                      }
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEditUser(u)}
                        className="p-1.5 text-gray-400 hover:text-pitch-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit user"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={u.id === currentUser.id}
                        title={u.id === currentUser.id ? 'You cannot delete your own account' : 'Delete user'}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
                {!loadingUsers && users.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No users.</p>
                )}
              </div>
            </section>

            {/* Add User */}
            <section>
              <h2 className="font-bebas text-pitch-900 text-2xl tracking-wide mb-1">Add User</h2>
              <form onSubmit={handleAddUser} className="space-y-3">
                {addUserError && (
                  <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addUserError}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Display Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Smith"
                      value={newUser.display_name}
                      onChange={e => setNewUser(p => ({ ...p, display_name: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      placeholder="jsmith"
                      value={newUser.username}
                      onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">
                    Email <span className="text-gray-400 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={newUser.email}
                    onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      value={newUser.password}
                      onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Confirm"
                      value={newUser.confirmPassword}
                      onChange={e => setNewUser(p => ({ ...p, confirmPassword: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Btn type="submit" variant="primary" size="sm" disabled={addingUser}>
                  {addingUser ? '…' : 'Add User'}
                </Btn>
              </form>
            </section>
          </>
        )}

      </div>

      {/* ── Edit User Modal ─────────────────────────────────── */}
      {editingUser && editUserForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-pitch-900">Edit User</h3>
              <button onClick={cancelEditUser} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">✕</button>
            </div>
            <form onSubmit={handleEditUser} className="px-5 py-4 space-y-3">
              {editUserError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editUserError}</p>
              )}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editUserForm.display_name}
                  onChange={e => setEditUserForm(f => ({ ...f, display_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editUserForm.username}
                  onChange={e => setEditUserForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">
                  Email <span className="text-gray-400 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={editUserForm.email}
                  onChange={e => setEditUserForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Role</label>
                <select
                  value={editUserForm.role}
                  onChange={e => setEditUserForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">
                  New Password <span className="text-gray-400 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                  value={editUserForm.newPassword}
                  onChange={e => setEditUserForm(f => ({ ...f, newPassword: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                />
                <p className="text-[10px] text-gray-400 mt-1">Leave blank to keep the current password unchanged</p>
              </div>
              {editUserForm.newPassword && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-pitch-600 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={editUserForm.confirmPassword}
                    onChange={e => setEditUserForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                  />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Btn type="submit" variant="primary" size="sm" disabled={editUserSaving}>
                  {editUserSaving ? 'Saving…' : 'Save Changes'}
                </Btn>
                <Btn type="button" variant="ghost" size="sm" onClick={cancelEditUser}>Cancel</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
