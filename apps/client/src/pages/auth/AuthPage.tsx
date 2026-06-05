import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type AuthMode = 'signin' | 'signup';

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [resetError, setResetError] = useState('');

  // Set new password modal (after clicking email link)
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setPasswordError, setSetPasswordError] = useState('');

  useEffect(() => {
    // Check if this is a password recovery redirect
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowSetPassword(true);
      } else if (event === 'SIGNED_IN' && session) {
        navigate('/companies');
      }
    });

    // Already signed in?
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/companies');
    });
  }, [navigate]);

  // Handle sq=connected param after Square OAuth
  const returnTo = searchParams.get('returnTo');

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(authError.message || 'Authentication failed.');
      } else {
        navigate(returnTo ?? '/companies');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReset(e: FormEvent) {
    e.preventDefault();
    setResetError('');
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/auth',
      });
      if (resetErr) { setResetError(resetErr.message); return; }
      setResetStatus('sent');
    } catch {
      setResetError('Could not send reset email. Please try again.');
    }
  }

  async function handleSetNewPassword(e: FormEvent) {
    e.preventDefault();
    setSetPasswordError('');
    if (newPassword !== confirmPassword) { setSetPasswordError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setSetPasswordError('Password must be at least 8 characters.'); return; }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updateErr) { setSetPasswordError(updateErr.message); return; }
    setShowSetPassword(false);
    navigate('/companies');
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-title">Venview Events</span>
            <span className="brand-subtitle">Vendor Intelligence for Events</span>
          </div>

          <h2 className="auth-h2">{mode === 'signin' ? 'Sign In' : 'Sign Up'}</h2>
          <p className="auth-subtitle">
            {mode === 'signin'
              ? 'Welcome back! Sign in to manage your events.'
              : 'Create your account to get started.'}
          </p>

          <form onSubmit={handleAuth}>
            <div className="auth-fields">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>
            <div className="auth-error">{error}</div>
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading && <span className="spinner" />}
              {mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <p className="auth-toggle">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <a href="#" onClick={e => { e.preventDefault(); setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); }}>
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </a>
          </p>

          {mode === 'signin' && (
            <p className="auth-toggle">
              <a href="#" onClick={e => { e.preventDefault(); setResetEmail(email); setShowForgot(true); }} style={{ fontSize: '0.82em', color: 'var(--muted)' }}>
                Forgot Password?
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForgot(false); }}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <button className="modal-close" onClick={() => setShowForgot(false)}>✕</button>
            <h3 style={{ margin: '0 0 8px' }}>Reset Password</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '0 0 16px' }}>
              Enter your email and we'll send a reset link.
            </p>
            {resetStatus === 'sent' ? (
              <p style={{ color: '#166534', fontSize: '0.9rem' }}>
                Reset link sent! Check your email — click the link, then come back here to set your new password.
              </p>
            ) : (
              <form onSubmit={handleSendReset}>
                <div className="form-group">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                {resetError && <p className="form-error">{resetError}</p>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowForgot(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Send Reset Link</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Set New Password Modal */}
      {showSetPassword && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 8px' }}>Set New Password</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '0 0 16px' }}>
              Choose a new password for your account.
            </p>
            <form onSubmit={handleSetNewPassword}>
              <div className="form-group">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {setPasswordError && <p className="form-error">{setPasswordError}</p>}
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
