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

  const [form, setForm] = useState({
    display_name: user?.display_name ?? '',
    username:     user?.username ?? '',
    email:        user?.email ?? '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving,          setSaving]          = useState(false);
  const [formError,       setFormError]       = useState(null);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError(null);

    if (!form.display_name.trim()) { setFormError('Display name is required'); return; }
    if (!form.username.trim())     { setFormError('Username is required'); return; }
    if (newPassword) {
      if (!currentPassword) { setFormError('Current password is required to set a new password'); return; }
      if (newPassword !== confirmPassword) { setFormError('New passwords do not match'); return; }
    }

    setSaving(true);
    try {
      const payload = {
        display_name: form.display_name.trim(),
        username:     form.username.trim(),
        email:        form.email.trim() || null,
      };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.password         = newPassword;
      }
      const updated = await api.updateUser(user.id, payload);
      setUser(prev => ({ ...prev, ...updated }));
      setForm({ display_name: updated.display_name, username: updated.username, email: updated.email ?? '' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Account updated!');
    } catch (err) {
      setFormError(err.message);
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
      <div className="p-4 md:p-6 max-w-md">
        <form onSubmit={handleSave} className="space-y-5">

          {/* ── Profile ───────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              required
              value={form.display_name}
              onChange={e => set('display_name', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              value={form.username}
              onChange={e => set('username', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
              Email <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
            />
          </div>

          {/* ── Change Password ────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-pitch-600">Change Password</p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Required to change your password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
              />
            </div>
            {newPassword && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-pitch-600 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-400 bg-white"
                />
              </div>
            )}
          </div>

          {/* ── Role (read-only) ───────────────────────────────── */}
          <p className="text-xs text-gray-400">
            Role: <span className="font-mono text-pitch-600">{user?.role}</span>
          </p>

          {formError && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}

          <Btn type="submit" variant="primary" size="md" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Btn>
        </form>
      </div>
    </div>
  );
}
