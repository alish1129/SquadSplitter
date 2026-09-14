import { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { POSITIONS, POS_LABEL } from '../lib/teamBalancer.js';

const ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3, FLEX: 4 };

function PositionToggle({ positions, onToggle }) {
  return (
    <div className="pos-toggle">
      {POSITIONS.map((pos) => (
        <button
          key={pos}
          type="button"
          className={'pos-chip' + (positions.includes(pos) ? ' active' : '')}
          onClick={() => onToggle(pos)}
        >
          {POS_LABEL[pos]}
        </button>
      ))}
    </div>
  );
}

export default function RosterManager({ players }) {
  const [draftRatings, setDraftRatings] = useState({});
  const [pendingPositions, setPendingPositions] = useState([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const sorted = useMemo(
    () =>
      [...players].sort(
        (a, b) => ORDER[a.positions[0]] - ORDER[b.positions[0]] || a.name.localeCompare(b.name)
      ),
    [players]
  );

  async function run(promise) {
    setError('');
    const { error: err } = await promise;
    if (err) setError(err.message);
  }

  function togglePlayerPosition(player, pos) {
    const current = player.positions;
    let next;
    if (current.includes(pos)) {
      if (current.length <= 1) return; // keep at least one
      next = current.filter((p) => p !== pos);
    } else {
      if (current.length >= 2) return; // at most two
      next = [...current, pos];
    }
    run(supabase.from('players').update({ positions: next }).eq('id', player.id));
  }

  function commitRating(playerId, value) {
    setDraftRatings((d) => {
      const copy = { ...d };
      delete copy[playerId];
      return copy;
    });
    run(supabase.from('players').update({ rating: value }).eq('id', playerId));
  }

  function removePlayer(player) {
    run(supabase.from('players').delete().eq('id', player.id));
  }

  function togglePendingPosition(pos) {
    setPendingPositions((prev) => {
      if (prev.includes(pos)) return prev.filter((p) => p !== pos);
      if (prev.length >= 2) return prev;
      return [...prev, pos];
    });
  }

  async function addPlayer(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const positions = pendingPositions.length ? pendingPositions : ['FLEX'];
    setError('');
    const { error: err } = await supabase
      .from('players')
      .insert({ name, positions, rating: 50, is_in: false });
    if (err) {
      setError(err.message);
    } else {
      setNewName('');
      setPendingPositions([]);
    }
  }

  return (
    <details className="roster-details card">
      <summary>
        <span className="chev">▸</span>
        <h2 style={{ display: 'inline' }}>Manage roster</h2>
        <span className="count-badge">{players.length}</span>
      </summary>
      <div style={{ marginTop: 14 }}>
        {players.length === 0 && <p className="empty-note">No players yet — add your crew below.</p>}
        {sorted.map((p) => (
          <div className="roster-row" key={p.id}>
            <span className="name">
              {p.name}
              {!p.user_id && <span className="unclaimed"> (no account)</span>}
            </span>
            <PositionToggle positions={p.positions} onToggle={(pos) => togglePlayerPosition(p, pos)} />
            <span className="rating-edit">
              <input
                type="range"
                min={1}
                max={100}
                value={draftRatings[p.id] ?? p.rating}
                onChange={(e) =>
                  setDraftRatings((d) => ({ ...d, [p.id]: Number(e.target.value) }))
                }
                onMouseUp={(e) => commitRating(p.id, Number(e.target.value))}
                onTouchEnd={(e) => commitRating(p.id, Number(e.target.value))}
                onKeyUp={(e) => commitRating(p.id, Number(e.target.value))}
                aria-label={`Rating for ${p.name}, out of 100`}
              />
              <span className="rating-num-display">{draftRatings[p.id] ?? p.rating}</span>
            </span>
            <button type="button" className="btn ghost small" onClick={() => removePlayer(p)}>
              Remove
            </button>
          </div>
        ))}
        <form className="add-form" onSubmit={addPlayer}>
          <input
            type="text"
            placeholder="Player name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={40}
            required
          />
          <PositionToggle positions={pendingPositions} onToggle={togglePendingPosition} />
          <button type="submit" className="btn">
            Add player
          </button>
          <p className="muted" style={{ width: '100%', margin: '2px 0 0', fontSize: '.78rem' }}>
            For a friend without an account yet — anyone who signs in gets added automatically. Pick up to
            2 positions; rating starts at 50.
          </p>
        </form>
        {error && <p className="error-note">{error}</p>}
      </div>
    </details>
  );
}
