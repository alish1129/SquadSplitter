import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { formatSessionDate } from './SessionPicker.jsx';

function TeamColumn({ label, color, ids, playersById }) {
  const names = ids
    .map((id) => playersById[id]?.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className={`sv-team sv-team--${color}`}>
      <div className="sv-team-label">{label}</div>
      <div className="sv-players">
        {names.map((name) => (
          <div key={name} className="sv-player">{name}</div>
        ))}
      </div>
    </div>
  );
}

export default function SquadView({ dateParam }) {
  const [state, setState] = useState('loading'); // loading | ready | nosplit | error
  const [session, setSession] = useState(null);
  const [split, setSplit] = useState(null);
  const [playersById, setPlayersById] = useState({});

  useEffect(() => {
    async function load() {
      const q = supabase.from('sessions').select('*');
      const { data: sess } = dateParam
        ? await q.eq('session_date', dateParam).maybeSingle()
        : await q.order('session_date', { ascending: false }).limit(1).maybeSingle();

      if (!sess) { setState('error'); return; }
      setSession(sess);

      const [{ data: sp }, { data: pl }] = await Promise.all([
        supabase.from('splits').select('*').eq('session_id', sess.id).maybeSingle(),
        supabase.from('players').select('id, name'),
      ]);

      if (!sp) { setState('nosplit'); return; }
      setSplit(sp);
      setPlayersById(Object.fromEntries((pl ?? []).map((p) => [p.id, p])));
      setState('ready');
    }
    load();
  }, [dateParam]);

  if (state === 'loading') {
    return (
      <div className="sv-root sv-loading">
        <div className="sv-brand">SQUAD SPLIT</div>
        <p>Loading…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="sv-root sv-loading">
        <div className="sv-brand">SQUAD SPLIT</div>
        <p>Session not found.</p>
      </div>
    );
  }

  if (state === 'nosplit') {
    return (
      <div className="sv-root sv-loading">
        <div className="sv-brand">SQUAD SPLIT</div>
        <p>Teams haven't been generated yet for {formatSessionDate(session?.session_date)}.</p>
      </div>
    );
  }

  const venueLabel = session.venue_title || (session.venue_url ? 'View on map' : null);

  return (
    <div className="sv-root">
      <div className="sv-header">
        <div className="sv-brand">SQUAD SPLIT</div>
        <div className="sv-meta">
          <div className="sv-meta-date">{formatSessionDate(session.session_date)}</div>
          <div className="sv-meta-details">
            {session.match_time && <span>{session.match_time}</span>}
            {session.match_time && session.venue_url && <span className="sv-dot">·</span>}
            {venueLabel && (
              session.venue_url
                ? <a href={session.venue_url} target="_blank" rel="noopener noreferrer" className="sv-venue-link">📍 {venueLabel}</a>
                : <span>📍 {venueLabel}</span>
            )}
          </div>
        </div>
      </div>

      <div className="sv-field">
        <TeamColumn
          label="🟠 PINNIES"
          color="pinnies"
          ids={split.team_a}
          playersById={playersById}
        />
        <div className="sv-vs">VS</div>
        <TeamColumn
          label="🔵 SHIRTS"
          color="shirts"
          ids={split.team_b}
          playersById={playersById}
        />
      </div>

      <div className="sv-footer">Squad Split · pickup soccer</div>
    </div>
  );
}
