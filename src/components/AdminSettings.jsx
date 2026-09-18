import { supabase } from '../supabaseClient.js';

export default function AdminSettings({ hideRatings, onOptimistic }) {
  async function toggle() {
    const next = !hideRatings;
    onOptimistic(next); // instant UI update
    const { error } = await supabase
      .from('app_config')
      .update({ hide_ratings: next })
      .eq('id', 1);
    if (error) onOptimistic(hideRatings); // revert on failure
  }

  const showAll = !hideRatings;

  return (
    <details className="roster-details card">
      <summary>
        <span className="chev">▸</span>
        <h2 style={{ display: 'inline' }}>App settings</h2>
      </summary>
      <div style={{ marginTop: 14 }}>
        <label className="setting-row" onClick={(e) => { e.preventDefault(); toggle(); }}>
          <div>
            <div className="setting-label">Show ratings &amp; chemistry styles to all players</div>
            <div className="setting-hint">
              {showAll
                ? 'On — everyone can see ratings and chemistry styles'
                : 'Off — only admins can see ratings and chemistry styles'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showAll}
            className={'toggle-switch' + (showAll ? ' on' : '')}
          >
            <span className="toggle-thumb" />
          </button>
        </label>
      </div>
    </details>
  );
}
