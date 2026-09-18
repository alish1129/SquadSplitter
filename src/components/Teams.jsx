import { useState } from 'react';
import { POSITIONS, POS_LABEL, computeTeamStats, teamsAsText } from '../lib/teamBalancer.js';
import { CHEM_STYLES } from '../lib/chemistryStyles.js';

function TeamCard({ cls, name, ids, playersById, isAdmin }) {
  const stats = computeTeamStats(ids, playersById);
  const avg = stats.count ? (stats.total / stats.count).toFixed(1) : '0.0';
  return (
    <div className={`team-card ${cls}`}>
      <div className="team-head">
        <span className="team-name">{name}</span>
        <span className="team-jersey" />
      </div>
      <div className="team-total">
        {isAdmin
          ? `${stats.count} players · total ${stats.total} · avg ${avg}`
          : `${stats.count} players`}
      </div>
      {stats.count === 0 && <p className="empty-note">No players yet.</p>}
      {POSITIONS.map((pos) =>
        stats.byPos[pos].length ? (
          <div className="team-pos-group" key={pos}>
            <div className="team-pos-label">
              {POS_LABEL[pos]} · {stats.byPos[pos].length}
            </div>
            {stats.byPos[pos].map((p) => (
              <div className="team-player" key={p.id}>
                <span>{p.name}</span>
                {(p.chemistry_styles ?? []).length > 0 && (
                  <span className="team-player-chem">
                    {(p.chemistry_styles).map((cs) =>
                      CHEM_STYLES[cs]
                        ? <span key={cs} title={`${CHEM_STYLES[cs].label}: ${CHEM_STYLES[cs].description}`}>{CHEM_STYLES[cs].emoji}</span>
                        : null
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : null
      )}
    </div>
  );
}

export default function Teams({ split, players, playersById, onGenerate, isAdmin, generating }) {
  const [toast, setToast] = useState('');

  if (!split || (!split.team_a?.length && !split.team_b?.length)) return null;

  const currentInIds = players.filter((p) => p.is_in).map((p) => p.id).sort();
  const splitIds = [...split.team_a, ...split.team_b].sort();
  const stale = JSON.stringify(currentInIds) !== JSON.stringify(splitIds);

  async function copy() {
    const text = teamsAsText({ team_a: split.team_a, team_b: split.team_b }, playersById);
    try {
      await navigator.clipboard.writeText(text);
      setToast('Copied — paste it into the chat');
    } catch {
      setToast('Could not copy — select the text manually');
    }
    setTimeout(() => setToast(''), 2600);
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Teams</h2>
        <button type="button" className="btn secondary small" onClick={copy}>
          Copy for chat
        </button>
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
      <div className="teams-grid">
        <TeamCard cls="pinnies" name="Pinnies" ids={split.team_a} playersById={playersById} isAdmin={isAdmin} />
        <TeamCard cls="shirts"  name="Shirts"  ids={split.team_b} playersById={playersById} isAdmin={isAdmin} />
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
