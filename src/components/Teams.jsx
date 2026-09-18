import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { POSITIONS, POS_LABEL, computeTeamStats, teamsAsText } from '../lib/teamBalancer.js';
import { CHEM_STYLES } from '../lib/chemistryStyles.js';

function TeamCard({
  cls, name, teamKey, ids, playersById, isAdmin, hideRatings,
  dragging, dragOver, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}) {
  const stats = computeTeamStats(ids, playersById);
  const avg = stats.count ? (stats.total / stats.count).toFixed(1) : '0.0';
  const isDropTarget = isAdmin && dragOver === teamKey && dragging?.fromTeam !== teamKey;

  return (
    <div
      className={`team-card ${cls}${isDropTarget ? ' drag-over' : ''}`}
      onDragOver={isAdmin ? (e) => onDragOver(e, teamKey) : undefined}
      onDragLeave={isAdmin ? (e) => onDragLeave(e) : undefined}
      onDrop={isAdmin ? (e) => onDrop(e, teamKey) : undefined}
    >
      <div className="team-head">
        <span className="team-name">{name}</span>
        <span className="team-jersey" />
      </div>
      <div className="team-total">
        {(isAdmin || !hideRatings)
          ? `${stats.count} players · total ${stats.total} · avg ${avg}`
          : `${stats.count} players`}
      </div>
      {stats.count === 0 && (
        <p className="empty-note" style={{ minHeight: 48 }}>
          {isDropTarget ? '⬇ Drop here' : 'No players yet.'}
        </p>
      )}
      {POSITIONS.map((pos) =>
        stats.byPos[pos].length ? (
          <div className="team-pos-group" key={pos}>
            <div className="team-pos-label">
              {POS_LABEL[pos]} · {stats.byPos[pos].length}
            </div>
            {stats.byPos[pos].map((p) => {
              const beingDragged = dragging?.playerId === p.id;
              return (
                <div
                  key={p.id}
                  className={`team-player${isAdmin ? ' draggable' : ''}${beingDragged ? ' is-dragging' : ''}`}
                  draggable={isAdmin || undefined}
                  onDragStart={isAdmin ? (e) => onDragStart(e, p.id, teamKey) : undefined}
                  onDragEnd={isAdmin ? onDragEnd : undefined}
                  title={isAdmin ? 'Drag to move to the other team' : undefined}
                >
                  <span>{p.name}</span>
                  {(isAdmin || !hideRatings) && (p.chemistry_styles ?? []).length > 0 && (
                    <span className="team-player-chem">
                      {p.chemistry_styles.map((cs) =>
                        CHEM_STYLES[cs]
                          ? <span key={cs} title={`${CHEM_STYLES[cs].label}: ${CHEM_STYLES[cs].description}`}>{CHEM_STYLES[cs].emoji}</span>
                          : null
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null
      )}
    </div>
  );
}

export default function Teams({ split, players, playersById, onGenerate, isAdmin, hideRatings, generating, gameSession, onSplitChange }) {
  const [toast, setToast] = useState('');
  const [dragging, setDragging] = useState(null); // { playerId, fromTeam: 'a'|'b' }
  const [dragOver, setDragOver] = useState(null); // 'a' | 'b' | null

  if (!split || (!split.team_a?.length && !split.team_b?.length)) return null;

  const currentInIds = players.filter((p) => p.is_in).map((p) => p.id).sort();
  const splitIds = [...split.team_a, ...split.team_b].sort();
  const stale = JSON.stringify(currentInIds) !== JSON.stringify(splitIds);

  // ── Drag handlers ─────────────────────────────────────────
  function onDragStart(e, playerId, fromTeam) {
    setDragging({ playerId, fromTeam });
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd() {
    setDragging(null);
    setDragOver(null);
  }

  function onDragOver(e, toTeam) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragging && dragging.fromTeam !== toTeam) setDragOver(toTeam);
  }

  function onDragLeave(e) {
    // Only clear when leaving the card element itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
  }

  async function onDrop(e, toTeam) {
    e.preventDefault();
    setDragOver(null);
    if (!dragging || dragging.fromTeam === toTeam) { setDragging(null); return; }

    const { playerId } = dragging;
    setDragging(null);

    const newA = toTeam === 'a'
      ? [...split.team_a, playerId]
      : split.team_a.filter((id) => id !== playerId);
    const newB = toTeam === 'b'
      ? [...split.team_b, playerId]
      : split.team_b.filter((id) => id !== playerId);

    // Optimistic update so UI snaps immediately
    onSplitChange?.({ ...split, team_a: newA, team_b: newB });

    const { error } = await supabase
      .from('splits')
      .update({ team_a: newA, team_b: newB })
      .eq('session_id', split.session_id);

    if (error) setToast('Save failed — try again');
  }

  // ── Copy / share ──────────────────────────────────────────
  async function copyWithDetails() {
    const text = teamsAsText({ team_a: split.team_a, team_b: split.team_b }, playersById);
    try {
      await navigator.clipboard.writeText(text);
      setToast('Copied — paste it into the chat');
    } catch {
      setToast('Could not copy — select the text manually');
    }
    setTimeout(() => setToast(''), 2600);
  }

  async function shareSquad() {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'squad');
    if (gameSession?.session_date) url.searchParams.set('date', gameSession.session_date);
    const shareUrl = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl, title: 'Squad Split' });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast('Squad link copied');
    } catch {
      setToast('Could not share');
    }
    setTimeout(() => setToast(''), 2600);
  }

  // ── Render ────────────────────────────────────────────────
  const dragProps = { dragging, dragOver, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop };

  return (
    <div className="card">
      <div className="card-head">
        <h2>Teams</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary small" onClick={shareSquad}>
            Share squad
          </button>
          {isAdmin && (
            <button type="button" className="btn secondary small" onClick={copyWithDetails}>
              Copy for chat
            </button>
          )}
        </div>
      </div>

      {stale && (
        <div className="empty-note">
          ⚠️ Turnout changed since this split was made.{' '}
          {isAdmin && (
            <button type="button" className="btn small" onClick={onGenerate}>
              Regenerate
            </button>
          )}
        </div>
      )}

      {isAdmin && (
        <p className="teams-dnd-hint">Drag a player to the other team to move them.</p>
      )}

      <div className="teams-grid">
        <TeamCard cls="pinnies" name="Pinnies" teamKey="a" ids={split.team_a}
          playersById={playersById} isAdmin={isAdmin} hideRatings={hideRatings} {...dragProps} />
        <TeamCard cls="shirts"  name="Shirts"  teamKey="b" ids={split.team_b}
          playersById={playersById} isAdmin={isAdmin} hideRatings={hideRatings} {...dragProps} />
      </div>

      {isAdmin && (
        <div className="actions-row">
          <button type="button" className="btn secondary small" onClick={onGenerate} disabled={generating}>
            🔀 Regenerate
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
