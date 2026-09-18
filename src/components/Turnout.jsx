import { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { PosPill, RatingBadge, ChemStyleBadges } from './shared.jsx';

export default function Turnout({ players, session, sessionId, isAdmin, hideRatings, onGenerate, generating }) {
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState('');

  const sorted = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  const inCount = players.filter((p) => p.is_in).length;
  const allIn = inCount === players.length;
  const canGenerate = inCount >= 2;

  async function selectAll(value) {
    setError('');
    const { error: err } = await supabase
      .from('session_turnout')
      .upsert(players.map((p) => ({ session_id: sessionId, player_id: p.id, is_in: value })));
    if (err) setError(err.message);
  }

  async function toggle(player, nextValue) {
    setError('');
    setToggling(player.id);

    const isSelf = session && player.user_id === session.user.id;

    let rpcError;
    if (isAdmin) {
      // Admin: directly upsert into session_turnout
      const { error: err } = await supabase
        .from('session_turnout')
        .upsert({ session_id: sessionId, player_id: player.id, is_in: nextValue });
      rpcError = err;
    } else if (isSelf) {
      // Member: use security-definer RPC that only allows own row
      const { error: err } = await supabase.rpc('toggle_session_in', {
        p_session_id: sessionId,
        p_player_id: player.id,
        p_value: nextValue,
      });
      rpcError = err;
    } else {
      rpcError = { message: 'Sign in to mark yourself IN.' };
    }

    setToggling(null);
    if (rpcError) setError(rpcError.message);
  }

  if (players.length === 0) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>This week's turnout</h2>
        </div>
        <p className="empty-note">
          Nobody on the roster yet. Sign in to add yourself, or ask an admin to add the group.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Who's in?</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <button
              type="button"
              className="btn secondary small"
              onClick={() => selectAll(!allIn)}
              aria-label={allIn ? 'Mark all players out' : 'Mark all players in'}
            >
              {allIn ? 'Clear all' : 'Select all'}
            </button>
          )}
          <span className="count-badge">{inCount} of {players.length} IN</span>
        </div>
      </div>
      <div className="turnout-list">
        {sorted.map((p) => {
          const isSelf = session && p.user_id === session.user.id;
          const canToggle = isAdmin || isSelf;
          return (
            <label key={p.id} className={'turnout-row' + (p.is_in ? '' : ' out')}>
              <input
                type="checkbox"
                checked={p.is_in}
                disabled={!canToggle || toggling === p.id}
                onChange={(e) => toggle(p, e.target.checked)}
                aria-label={`${p.name} — mark ${p.is_in ? 'out' : 'in'}`}
              />
              <span className="name">{p.name}</span>
              {isSelf && <span className="you-tag" aria-label="This is you">YOU</span>}
              <PosPill positions={p.positions} />
              {(isAdmin || !hideRatings) && <RatingBadge rating={p.rating} />}
              {(isAdmin || !hideRatings) && <ChemStyleBadges chemStyles={p.chemistry_styles} />}
            </label>
          );
        })}
      </div>
      {error && <p className="error-note" role="alert">{error}</p>}
      <div className="actions-row">
        <button
          type="button"
          className="btn"
          disabled={!canGenerate || !isAdmin}
          onClick={onGenerate}
          aria-label={generating ? 'Splitting teams…' : 'Generate team split'}
        >
          {generating ? 'Splitting…' : '⚽ Generate teams'}
        </button>
        {!canGenerate && <span className="muted">Need at least 2 players IN</span>}
        {canGenerate && !isAdmin && <span className="muted">Only admins can generate teams</span>}
      </div>
    </div>
  );
}
