import { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function formatSessionDate(dateStr) {
  if (!dateStr) return '';
  // Append noon time to avoid UTC-offset date shifts
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SessionPicker({ gameSession, isAdmin, onNavigate }) {
  const [dateInput, setDateInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  async function handleGo(e) {
    e.preventDefault();
    if (!dateInput) return;
    setBusy(true);
    const { error } = await supabase
      .from('sessions')
      .upsert({ session_date: dateInput }, { onConflict: 'session_date' });
    setBusy(false);
    if (error) { setToast('Error: ' + error.message); return; }
    onNavigate(dateInput);
    setDateInput('');
  }

  async function copyLink() {
    if (!gameSession) return;
    const url = new URL(window.location.href);
    url.searchParams.set('date', gameSession.session_date);
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast('Link copied — paste it in your group chat!');
    } catch {
      showToast(url.toString());
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div className="session-bar card">
      <div className="session-bar-row">
        <div className="session-info">
          <div className="session-label">Game day</div>
          <div className="session-date-display">
            {gameSession
              ? formatSessionDate(gameSession.session_date)
              : 'No session selected'}
          </div>
        </div>

        {gameSession && (
          <button
            type="button"
            className="btn secondary small"
            onClick={copyLink}
            aria-label="Copy shareable link for this session"
          >
            🔗 Share link
          </button>
        )}
      </div>

      {isAdmin && (
        <form className="session-form" onSubmit={handleGo} aria-label="Go to a game date">
          <label className="sr-only" htmlFor="session-date-input">Select game date</label>
          <input
            id="session-date-input"
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            required
          />
          <button type="submit" className="btn small" disabled={busy || !dateInput}>
            {busy ? 'Creating…' : 'Go to date →'}
          </button>
        </form>
      )}

      {toast && <div className="session-toast">{toast}</div>}
    </div>
  );
}
