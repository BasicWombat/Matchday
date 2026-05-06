import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { PageHeader, Btn } from '../components/ui';
import { useToast } from '../components/Toast';

export default function Account() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    if (password && password !== confirm) {
      toast('Passwords do not match', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { display_name: displayName };
      if (password) payload.password = password;
      const updated = await api.updateUser(user.id, payload);
      setUser(prev => ({ ...prev, display_name: updated.display_name }));
      toast('Account updated!');
      setPassword('');
      setConfirm('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="My Account"
        action={
          <button
            onClick={() => navigate(-1)}
            className="text-white/60 hover:text-white text-sm transition-colors"
          >
            ← Back
          </button>
        }
      />
      <div className="p-4 md:p-6 max-w-md space-y-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              New Password <span className="text-gray-400 normal-case font-normal">(leave blank to keep)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
            />
          </div>
          {password && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm new password…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
              />
            </div>
          )}
          <Btn type="submit" variant="primary" size="md" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Btn>
        </form>
        <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-100">
          <p>Username: <span className="font-mono text-pitch-600">{user?.username}</span></p>
          <p>Role: <span className="font-mono text-pitch-600">{user?.role}</span></p>
        </div>
      </div>
    </div>
  );
}
