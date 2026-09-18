import { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { PosPill, RatingBadge, ChemStyleBadges } from './shared.jsx';

export default function Turnout({
  players, session, sessionId, isAdmin, hideRatings,
  numTeams, onNumTeamsChange, onGenerate, generating,
}) {
  const [toggling, setToggling] = useState(null);
  const [error, setError]       = useState('');
  const [open, setOpen]         = useState(true);

  const sorted   = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);
  const inCount  = players.filter((p) => p.is_in).length;
  const allIn    = inCount === players.length;
  const canGen   = inCount >= numTeams;
  const perTeam  = inCount >= numTeams ? Math.floor(inCount / numTeams) : null;

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
      const { error: err } = await supabase
        .from('session_turnout')
        .upsert({ session_id: sessionId, player_id: player.id, is_in: nextValue });
      rpcError = err;
    } else if (isSelf) {
      const { error: err } = await supabase.rpc('toggle_session_in', {
        p_session_id: sessionId, p_player_id: player.id, p_value: nextValue,
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
        <div className="card-head"><h2>Who's in?</h2></div>
        <p className="empty-note">Nobody on the roster yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      {/* ── Collapsible header ── */}
      <div
        className="card-head collapsible-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((v) => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`chev${open ? ' open' : ''}`}>▸</span>
          <h2>Who's in?</h2>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isAdmin && (
            <button
              type="button"
              className="btn secondary small"
              onClick={() => selectAll(!allIn)}
            >
              {allIn ? 'Clear all' : 'Select all'}
            </button>
          )}
          <span className="count-badge">{inCount} of {players.length} IN</span>
        </div>
      </div>

      {open && (
        <>
          <div className="turnout-list">
            {sorted.map((p) => {
              const isSelf    = session && p.user_id === session.user.id;
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
                  {isSelf && <span className="you-tag">YOU</span>}
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
              disabled={!canGen || !isAdmin}
              onClick={onGenerate}
            >
              {generating ? 'Splitting…' : '⚽ Generate teams'}
            </button>

            {isAdmin && (
              <label className="num-teams-label">
                <select
                  className="num-teams-select"
                  value={numTeams}
                  onChange={(e) => onNumTeamsChange(Number(e.target.value))}
                  aria-label="Number of teams"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n} teams</option>
                  ))}
                </select>
                {perTeam && (
                  <span className="muted">~{perTeam} per team</span>
                )}
              </label>
            )}

            {!canGen && (
              <span className="muted">Need at least {numTeams} players IN</span>
            )}
            {canGen && !isAdmin && (
              <span className="muted">Only admins can generate teams</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
