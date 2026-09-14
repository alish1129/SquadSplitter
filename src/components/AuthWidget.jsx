import { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function AuthWidget({ session, profile }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
        data: name.trim() ? { name: name.trim() } : undefined,
      },
    });
    setSending(false);
    if (signInError) {
      setError(signInError.message);
    } else {
      setSent(true);
    }
  }

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

  if (sent) {
    return (
      <div className="auth-widget">
        <span className="status-pill">Check {email} for a sign-in link</span>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Your name (first time only)"
        aria-label="Your name (first time only)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
      />
      <input
        type="email"
        placeholder="Email address"
        aria-label="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit" className="btn secondary small" disabled={sending}>
        {sending ? 'Sending…' : 'Sign in'}
      </button>
      {error && <span className="error-note">{error}</span>}
    </form>
  );
}
