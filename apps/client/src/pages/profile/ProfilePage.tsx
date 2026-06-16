import { useState } from 'react';
import { supabase, showToast, useAuth } from '@org/data';

export function ProfilePage() {
  const { user, loading } = useAuth();

  const initialName = (user?.user_metadata?.['name'] as string)
    ?? (user?.user_metadata?.['full_name'] as string)
    ?? '';

  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  async function saveName() {
    setSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: name.trim() } });
      if (error) throw error;
      showToast('Profile updated!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update profile', 'error');
    } finally { setSavingName(false); }
  }

  async function changePassword() {
    if (newPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'error'); return; }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showToast('Password changed!', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to change password', 'error');
    } finally { setSavingPw(false); }
  }

  return (
    <>
      <div className="card">
        <div className="mb-4">
          <h2 className="mt-0 mb-1 text-[#0B2A4A]">👤 Profile</h2>
          <p className="text-[#64748b] text-[0.86rem] m-0">Manage your personal account details.</p>
        </div>

        {loading && <p className="text-[#64748b] text-[0.88rem]">Loading…</p>}

        {!loading && (
          <>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={user?.email ?? ''} disabled style={{ background: '#f1f5f9', color: 'var(--muted)' }} />
            </div>
            <div className="form-group">
              <label>Display name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>
            <button className="btn-primary" onClick={saveName} disabled={savingName}>
              {savingName && <span className="spinner" />} <span>Save Profile</span>
            </button>
          </>
        )}
      </div>

      {!loading && (
        <div className="card">
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Change password</p>
          <div className="form-group">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" />
          </div>
          <button className="btn-primary" onClick={changePassword} disabled={savingPw || !newPassword || !confirmPassword}>
            {savingPw && <span className="spinner" />} <span>Change Password</span>
          </button>
        </div>
      )}
    </>
  );
}
