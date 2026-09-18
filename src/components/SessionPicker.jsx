import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function formatSessionDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SessionPicker({ gameSession, isAdmin, onNavigate, onSessionUpdated }) {
  const [dateInput, setDateInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  // Match detail fields (admin)
  const [matchTime, setMatchTime] = useState('');
  const [venueUrl, setVenueUrl] = useState('');
  const [detailsSaved, setDetailsSaved] = useState(false);

  useEffect(() => {
    setMatchTime(gameSession?.match_time ?? '');
    setVenueUrl(gameSession?.venue_url ?? '');
    setDetailsSaved(false);
  }, [gameSession?.id]);

  async function handleGo(e) {
    e.preventDefault();
    if (!dateInput) return;
    setBusy(true);
    const { error } = await supabase
      .from('sessions')
      .upsert({ session_date: dateInput }, { onConflict: 'session_date' });
    setBusy(false);
    if (error) { showToast('Error: ' + error.message); return; }
    onNavigate(dateInput);
    setDateInput('');
  }

  async function saveMatchDetails(e) {
    e.preventDefault();
    if (!gameSession) return;
    const { error } = await supabase
      .from('sessions')
      .update({ match_time: matchTime || null, venue_url: venueUrl || null })
      .eq('id', gameSession.id);
    if (error) { showToast('Error: ' + error.message); return; }
    setDetailsSaved(true);
    setTimeout(() => setDetailsSaved(false), 2000);
    onSessionUpdated?.();
  }

  async function copyLink() {
    if (!gameSession) return;
    const url = new URL(window.location.href);
    url.searchParams.set('date', gameSession.session_date);
    url.searchParams.delete('view');
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
          {gameSession && (gameSession.match_time || gameSession.venue_url) && (
            <div className="session-meta">
              {gameSession.match_time && <span>{gameSession.match_time}</span>}
              {gameSession.match_time && gameSession.venue_url && <span> · </span>}
              {gameSession.venue_url && (
                <a
                  href={gameSession.venue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="session-venue-link"
                >
                  📍 Ground
                </a>
              )}
            </div>
          )}
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

      {isAdmin && gameSession && (
        <form className="match-details-form" onSubmit={saveMatchDetails} aria-label="Match details">
          <input
            type="text"
            placeholder="Kick-off time  e.g. 9:00 PM"
            value={matchTime}
            onChange={(e) => setMatchTime(e.target.value)}
            className="match-details-input"
          />
          <input
            type="url"
            placeholder="Google Maps link for the ground"
            value={venueUrl}
            onChange={(e) => setVenueUrl(e.target.value)}
            className="match-details-input"
          />
          <button type="submit" className="btn small">
            {detailsSaved ? '✓ Saved' : 'Save'}
          </button>
        </form>
      )}

      {toast && <div className="session-toast">{toast}</div>}
    </div>
  );
}
