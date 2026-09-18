import { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function AuthWidget({ session, profile }) {
  const [mode, setMode]       = useState('signin'); // 'signin' | 'signup' | 'reset'
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError]     = useState('');

  function reset() {
    setError(''); setMessage('');
    setName(''); setEmail(''); setPassword('');
  }

  function switchMode(next) {
    reset();
    setMode(next);
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(err.message);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true); setError(''); setMessage('');
    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: name.trim() ? { name: name.trim() } : undefined },
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    // If email confirmation is disabled in Supabase, the user is signed in immediately.
    // If it's still enabled, show a prompt.
    setMessage('Account created! Check your email to confirm, then sign in.');
    switchMode('signin');
  }

  async function handleReset(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setMessage('Password reset email sent — check your inbox.');
  }

  // ── Signed-in state ───────────────────────────────────────
  if (session) {
    return (
      <div className="auth-widget">
        <span className={'status-pill' + (profile?.is_admin ? ' admin-badge' : '')}>
          {profile?.is_admin ? 'Admin · ' : ''}
          {session.user.email}
        </span>
        <button type="button" className="btn secondary small" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  // ── Password reset form ────────────────────────────────────
  if (mode === 'reset') {
    return (
      <form className="auth-form" onSubmit={handleReset}>
        <input
          type="email" placeholder="Email address" aria-label="Email address"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <button type="submit" className="btn secondary small" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
        <button type="button" className="btn secondary small" onClick={() => switchMode('signin')}>
          Back
        </button>
        {error   && <span className="error-note">{error}</span>}
        {message && <span className="auth-note">{message}</span>}
      </form>
    );
  }

  // ── Sign up form ───────────────────────────────────────────
  if (mode === 'signup') {
    return (
      <form className="auth-form" onSubmit={handleSignUp}>
        <input
          type="text" placeholder="Your name" aria-label="Your name"
          value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
        />
        <input
          type="email" placeholder="Email address" aria-label="Email address"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          type="password" placeholder="Password (min 6 chars)" aria-label="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        <button type="submit" className="btn secondary small" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <button type="button" className="auth-switch-btn" onClick={() => switchMode('signin')}>
          Already have an account? Sign in
        </button>
        {error && <span className="error-note">{error}</span>}
      </form>
    );
  }

  // ── Sign in form (default) ────────────────────────────────
  return (
    <form className="auth-form" onSubmit={handleSignIn}>
      <input
        type="email" placeholder="Email address" aria-label="Email address"
        value={email} onChange={(e) => setEmail(e.target.value)} required
      />
      <input
        type="password" placeholder="Password" aria-label="Password"
        value={password} onChange={(e) => setPassword(e.target.value)} required
      />
      <button type="submit" className="btn secondary small" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="auth-links">
        <button type="button" className="auth-switch-btn" onClick={() => switchMode('signup')}>
          New here? Sign up
        </button>
        <button type="button" className="auth-switch-btn" onClick={() => switchMode('reset')}>
          Forgot password?
        </button>
      </div>
      {error   && <span className="error-note">{error}</span>}
      {message && <span className="auth-note">{message}</span>}
    </form>
  );
}
