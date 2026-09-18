import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { POSITIONS, POS_LABEL, computeTeamStats, teamsAsText, TEAMS_CONFIG } from '../lib/teamBalancer.js';
import { CHEM_STYLES } from '../lib/chemistryStyles.js';

function TeamCard({
  teamIdx, ids, playersById, isAdmin, hideRatings,
  dragging, dragOver, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}) {
  const cfg   = TEAMS_CONFIG[teamIdx] ?? { name: `Team ${teamIdx + 1}`, icon: '⚽', cls: 'team-c' };
  const stats = computeTeamStats(ids, playersById);
  const avg   = stats.count ? (stats.total / stats.count).toFixed(1) : '0.0';
  const isDropTarget = isAdmin && dragOver === teamIdx && dragging?.fromIdx !== teamIdx;

  return (
    <div
      className={`team-card ${cfg.cls}${isDropTarget ? ' drag-over' : ''}`}
      onDragOver={isAdmin ? (e) => onDragOver(e, teamIdx) : undefined}
      onDragLeave={isAdmin ? (e) => onDragLeave(e) : undefined}
      onDrop={isAdmin ? (e) => onDrop(e, teamIdx) : undefined}
    >
      <div className="team-head">
        <span className="team-name">{cfg.icon} {cfg.name}</span>
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
            <div className="team-pos-label">{POS_LABEL[pos]} · {stats.byPos[pos].length}</div>
            {stats.byPos[pos].map((p) => {
              const beingDragged = dragging?.playerId === p.id;
              return (
                <div
                  key={p.id}
                  className={`team-player${isAdmin ? ' draggable' : ''}${beingDragged ? ' is-dragging' : ''}`}
                  draggable={isAdmin || undefined}
                  onDragStart={isAdmin ? (e) => onDragStart(e, p.id, teamIdx) : undefined}
                  onDragEnd={isAdmin ? onDragEnd : undefined}
                  title={isAdmin ? 'Drag to move to another team' : undefined}
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

export default function Teams({
  split, players, playersById, onGenerate, isAdmin, hideRatings,
  generating, gameSession, onSplitChange,
}) {
  const [toast, setToast]     = useState('');
  const [dragging, setDragging] = useState(null); // { playerId, fromIdx }
  const [dragOver, setDragOver] = useState(null); // number | null
  const [open, setOpen]       = useState(true);

  if (!split || (!split.team_a?.length && !split.team_b?.length && !split.teams?.length)) return null;

  const allTeams = split.teams ?? [split.team_a, split.team_b];

  const currentInIds = players.filter((p) => p.is_in).map((p) => p.id).sort();
  const splitIds = allTeams.flat().sort();
  const stale = JSON.stringify(currentInIds) !== JSON.stringify(splitIds);

  // ── Drag handlers ─────────────────────────────────────────
  function onDragStart(e, playerId, fromIdx) {
    setDragging({ playerId, fromIdx });
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragEnd() { setDragging(null); setDragOver(null); }

  function onDragOver(e, toIdx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragging && dragging.fromIdx !== toIdx) setDragOver(toIdx);
  }
  function onDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
  }

  async function onDrop(e, toIdx) {
    e.preventDefault();
    setDragOver(null);
    if (!dragging || dragging.fromIdx === toIdx) { setDragging(null); return; }

    const { playerId, fromIdx } = dragging;
    setDragging(null);

    const newTeams = allTeams.map((team, i) => {
      if (i === fromIdx) return team.filter((id) => id !== playerId);
      if (i === toIdx)   return [...team, playerId];
      return team;
    });

    const newSplit = { ...split, teams: newTeams, team_a: newTeams[0] ?? [], team_b: newTeams[1] ?? [] };
    onSplitChange?.(newSplit);

    const { error } = await supabase
      .from('splits')
      .update({ teams: newTeams, team_a: newTeams[0] ?? [], team_b: newTeams[1] ?? [] })
      .eq('session_id', split.session_id);
    if (error) setToast('Save failed — try again');
  }

  // ── Copy / share ──────────────────────────────────────────
  async function copyWithDetails() {
    const text = teamsAsText(split, playersById);
    try { await navigator.clipboard.writeText(text); setToast('Copied — paste it into the chat'); }
    catch { setToast('Could not copy'); }
    setTimeout(() => setToast(''), 2600);
  }

  async function shareSquad() {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'squad');
    if (gameSession?.session_date) url.searchParams.set('date', gameSession.session_date);
    const shareUrl = url.toString();
    if (navigator.share) {
      try { await navigator.share({ url: shareUrl, title: 'Squad Split' }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(shareUrl); setToast('Squad link copied'); }
    catch { setToast('Could not share'); }
    setTimeout(() => setToast(''), 2600);
  }

  const dragProps = { dragging, dragOver, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop };

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
          <h2>Teams</h2>
          <span className="count-badge">{allTeams.length} teams · {allTeams.flat().length} players</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn secondary small" onClick={shareSquad}>Share squad</button>
          {isAdmin && <button type="button" className="btn secondary small" onClick={copyWithDetails}>Copy for chat</button>}
        </div>
      </div>

      {open && (
        <>
          {stale && (
            <div className="empty-note">
              ⚠️ Turnout changed since this split was made.{' '}
              {isAdmin && <button type="button" className="btn small" onClick={onGenerate}>Regenerate</button>}
            </div>
          )}

          {isAdmin && (
            <p className="teams-dnd-hint">Drag a player to move them to another team.</p>
          )}

          <div
            className="teams-grid"
            style={{ gridTemplateColumns: `repeat(${Math.min(allTeams.length, 3)}, 1fr)` }}
          >
            {allTeams.map((ids, i) => (
              <TeamCard
                key={i}
                teamIdx={i}
                ids={ids}
                playersById={playersById}
                isAdmin={isAdmin}
                hideRatings={hideRatings}
                {...dragProps}
              />
            ))}
          </div>

          {isAdmin && (
            <div className="actions-row">
              <button type="button" className="btn secondary small" onClick={onGenerate} disabled={generating}>
                🔀 Regenerate
              </button>
            </div>
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
