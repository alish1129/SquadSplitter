import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const TYPE_LABEL = {
  overall:  '⭐ Overall (1–10)',
  pairwise: '⚔️ Head-to-head',
};

export default function SurveyManager({ players, gameSession }) {
  const [surveys, setSurveys]         = useState([]);
  const [newType, setNewType]         = useState('overall');
  const [creating, setCreating]       = useState(false);
  const [toast, setToast]             = useState('');
  const [resultsMap, setResultsMap]   = useState({}); // surveyId → results[] | undefined

  useEffect(() => { loadSurveys(); }, [gameSession?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSurveys() {
    if (!gameSession) { setSurveys([]); return; }
    try {
      const { data, error } = await supabase
        .from('player_surveys')
        .select('*')
        .eq('session_id', gameSession.id)
        .order('created_at', { ascending: false });

      if (error || !data?.length) { setSurveys([]); return; }

      const ids = data.map((s) => s.id);
      const { data: counts } = await supabase
        .from('survey_responses')
        .select('survey_id')
        .in('survey_id', ids);

      const countMap = {};
      (counts ?? []).forEach((r) => { countMap[r.survey_id] = (countMap[r.survey_id] ?? 0) + 1; });

      setSurveys(data.map((s) => ({ ...s, response_count: countMap[s.id] ?? 0 })));
    } catch { setSurveys([]); }
  }

  async function createSurvey() {
    if (!gameSession) return;
    setCreating(true);
    const { error } = await supabase
      .from('player_surveys')
      .insert({
        session_id: gameSession.id,
        type:       newType,
        player_ids: players.map((p) => p.id),
        is_open:    true,
      });
    setCreating(false);
    if (error) { showToast('Failed to create survey'); return; }
    await loadSurveys();
  }

  async function toggleOpen(survey) {
    await supabase
      .from('player_surveys')
      .update({ is_open: !survey.is_open })
      .eq('id', survey.id);
    await loadSurveys();
  }

  async function copyLink(surveyId) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('view', 'survey');
    url.searchParams.set('survey', surveyId);
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast('Survey link copied!');
    } catch {
      showToast('Could not copy');
    }
  }

  async function toggleResults(surveyId) {
    if (resultsMap[surveyId] !== undefined) {
      setResultsMap((m) => { const n = { ...m }; delete n[surveyId]; return n; });
      return;
    }
    const { data } = await supabase.rpc('get_survey_results', { p_survey_id: surveyId });
    setResultsMap((m) => ({ ...m, [surveyId]: data ?? [] }));
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  return (
    <details className="roster-details card">
      <summary>
        <span className="chev">▸</span>
        <h2 style={{ display: 'inline' }}>Player surveys</h2>
      </summary>

      <div style={{ marginTop: 12 }}>
        {/* ── Create form ──────────────────────────────────── */}
        <div className="survey-create-form">
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>New survey:</span>
          <select
            className="survey-type-select"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          >
            <option value="overall">⭐ Overall rating (1–10)</option>
            <option value="pairwise">⚔️ Head-to-head picks</option>
          </select>
          <button
            type="button"
            className="btn small"
            disabled={creating || !gameSession || !players.length}
            onClick={createSurvey}
          >
            {creating ? 'Creating…' : 'Create & get link'}
          </button>
        </div>
        {!gameSession && (
          <p className="empty-note" style={{ marginTop: 8 }}>Open a session first to create surveys.</p>
        )}

        {/* ── Survey list ───────────────────────────────────── */}
        {surveys.length > 0 && (
          <div className="survey-manager-list">
            {surveys.map((s) => {
              const res = resultsMap[s.id];
              return (
                <div key={s.id}>
                  <div className="survey-row">
                    <div className="survey-row-meta">
                      <div className="survey-row-type">{TYPE_LABEL[s.type] ?? s.type}</div>
                      <div className="survey-row-count">
                        {s.response_count} response{s.response_count !== 1 ? 's' : ''} · {s.player_ids?.length ?? 0} players
                      </div>
                    </div>
                    <span className={s.is_open ? 'survey-open-badge' : 'survey-closed-badge'}>
                      {s.is_open ? 'Open' : 'Closed'}
                    </span>
                    <div className="survey-row-actions">
                      <button type="button" className="btn secondary small" onClick={() => copyLink(s.id)}>
                        Copy link
                      </button>
                      <button type="button" className="btn secondary small" onClick={() => toggleOpen(s)}>
                        {s.is_open ? 'Close' : 'Reopen'}
                      </button>
                      <button type="button" className="btn secondary small" onClick={() => toggleResults(s.id)}>
                        {res !== undefined ? 'Hide results' : 'Results'}
                      </button>
                    </div>
                  </div>

                  {res !== undefined && (
                    <div className="survey-results-panel">
                      {res.length === 0 ? (
                        <p className="empty-note" style={{ margin: 0 }}>No responses yet.</p>
                      ) : (
                        <>
                          <div className="svy-results-title" style={{ marginBottom: 6 }}>
                            {s.type === 'overall' ? 'Average ratings' : 'Win rates'}
                          </div>
                          {res.map((r, i) => (
                            <div key={r.player_id} className="svy-result-row">
                              <span className="svy-result-rank">{i + 1}</span>
                              <span className="svy-result-name">{r.player_name}</span>
                              <span className="svy-result-score">
                                {s.type === 'overall' ? r.avg_score : `${r.win_pct}%`}
                              </span>
                              <span className="svy-result-count">
                                {s.type === 'overall'
                                  ? `(${r.num_ratings} rated)`
                                  : `${r.wins}W / ${r.appearances} seen`}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </details>
  );
}
