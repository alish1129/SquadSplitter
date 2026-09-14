import { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { PosPill, RatingBadge } from './shared.jsx';

const ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3, FLEX: 4 };

export default function Turnout({ players, session, isAdmin, onGenerate, generating }) {
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState('');

  const sorted = useMemo(
    () =>
      [...players].sort(
        (a, b) => ORDER[a.positions[0]] - ORDER[b.positions[0]] || a.name.localeCompare(b.name)
      ),
    [players]
  );

  const inCount = players.filter((p) => p.is_in).length;
  const canGenerate = inCount >= 2;

  async function toggle(player, nextValue) {
    setError('');
    setToggling(player.id);
    const isSelf = session && player.user_id === session.user.id;
    const { error: rpcError } = isAdmin
      ? await supabase.from('players').update({ is_in: nextValue }).eq('id', player.id)
      : isSelf
        ? await supabase.rpc('toggle_my_in', { target_player_id: player.id, new_value: nextValue })
        : { error: { message: 'Sign in to mark yourself IN.' } };
    setToggling(null);
    if (rpcError) setError(rpcError.message);
  }

  if (players.length === 0) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>This week’s turnout</h2>
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
        <h2>This week’s turnout</h2>
        <span className="count-badge">
          {inCount} of {players.length} IN
        </span>
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
              />
              <span className="name">{p.name}</span>
              {isSelf && <span className="you-tag">YOU</span>}
              <PosPill positions={p.positions} />
              <RatingBadge rating={p.rating} />
            </label>
          );
        })}
      </div>
      {error && <p className="error-note">{error}</p>}
      <div className="actions-row">
        <button type="button" className="btn" disabled={!canGenerate || !isAdmin} onClick={onGenerate}>
          {generating ? 'Splitting…' : '⚽ Generate teams'}
        </button>
        {!canGenerate && <span className="muted">Need at least 2 players IN</span>}
        {canGenerate && !isAdmin && <span className="muted">Only admins can generate teams</span>}
      </div>
    </div>
  );
}
