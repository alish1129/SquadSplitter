import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { getFingerprint, hasSubmitted, markSubmitted, generatePairs } from '../lib/survey.js';

function ResultsBoard({ survey, results }) {
  if (!results || results.length === 0) return null;
  return (
    <div className="svy-results">
      <div className="svy-results-title">
        {survey.type === 'overall' ? 'Community ratings so far' : 'Head-to-head standings so far'}
      </div>
      {results.map((r, i) => (
        <div key={r.player_id} className="svy-result-row">
          <span className="svy-result-rank">{i + 1}</span>
          <span className="svy-result-name">{r.player_name}</span>
          <span className="svy-result-score">
            {survey.type === 'overall' ? r.avg_score : `${r.win_pct}%`}
          </span>
          <span className="svy-result-count">
            {survey.type === 'overall'
              ? `(${r.num_ratings} rated)`
              : `${r.wins}W / ${r.appearances} matchups`}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SurveyPage({ surveyId }) {
  const [state, setState] = useState('loading'); // loading | ready | done | closed | notfound
  const [survey, setSurvey] = useState(null);
  const [players, setPlayers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);

  // Overall mode
  const [ratings, setRatings] = useState({});   // { playerId → 1-10 }

  // Pairwise mode
  const [pairs, setPairs] = useState([]);
  const [pairIdx, setPairIdx] = useState(0);
  const [picks, setPicks] = useState({});        // { "aId|bId" → winnerId }

  // Stable random order for overall mode
  const shuffledPlayers = useMemo(() => {
    if (!players.length) return [];
    const arr = [...players];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [players]);

  useEffect(() => {
    async function load() {
      const { data: sv } = await supabase
        .from('player_surveys')
        .select('*')
        .eq('id', surveyId)
        .maybeSingle();

      if (!sv) { setState('notfound'); return; }
      setSurvey(sv);

      const { data: pl } = sv.player_ids?.length
        ? await supabase.from('players').select('id, name').in('id', sv.player_ids)
        : await supabase.from('players').select('id, name').order('name');
      const playerList = pl ?? [];
      setPlayers(playerList);

      // Already submitted — skip straight to results
      if (hasSubmitted(surveyId)) {
        const { data: res } = await supabase.rpc('get_survey_results', { p_survey_id: surveyId });
        setResults(res ?? []);
        setState('done');
        return;
      }

      if (!sv.is_open) { setState('closed'); return; }

      if (sv.type === 'pairwise') {
        setPairs(generatePairs(playerList, 10));
      }

      setState('ready');
    }
    load();
  }, [surveyId]);

  const allRated  = players.length > 0 && Object.keys(ratings).length === players.length;
  const allPicked = pairs.length  > 0 && Object.keys(picks).length  === pairs.length;

  async function submit() {
    setSubmitting(true);
    const fp = getFingerprint();

    const { data: resp, error } = await supabase
      .from('survey_responses')
      .insert({ survey_id: surveyId, fingerprint: fp })
      .select('id')
      .single();

    if (error || !resp) { setSubmitting(false); return; }

    if (survey.type === 'overall') {
      await supabase.from('survey_ratings').insert(
        Object.entries(ratings).map(([player_id, score]) => ({
          response_id: resp.id, player_id, score,
        }))
      );
    } else {
      await supabase.from('survey_picks').insert(
        Object.entries(picks).map(([pairKey, winner_id]) => {
          const [player_a_id, player_b_id] = pairKey.split('|');
          return { response_id: resp.id, player_a_id, player_b_id, winner_id };
        })
      );
    }

    markSubmitted(surveyId);
    const { data: res } = await supabase.rpc('get_survey_results', { p_survey_id: surveyId });
    setResults(res ?? []);
    setState('done');
    setSubmitting(false);
  }

  // ── Static states ──────────────────────────────────────────────────────────
  if (state === 'loading') return (
    <div className="svy-root">
      <div className="svy-brand">SQUAD SPLIT</div>
      <div className="svy-card"><p className="svy-center-note">Loading…</p></div>
    </div>
  );

  if (state === 'notfound') return (
    <div className="svy-root">
      <div className="svy-brand">SQUAD SPLIT</div>
      <div className="svy-card"><p className="svy-center-note">Survey not found.</p></div>
    </div>
  );

  if (state === 'closed') return (
    <div className="svy-root">
      <div className="svy-brand">SQUAD SPLIT</div>
      <div className="svy-card">
        <p className="svy-center-note">
          <strong>This survey is closed.</strong><br />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ratings are no longer being collected.</span>
        </p>
      </div>
    </div>
  );

  if (state === 'done') return (
    <div className="svy-root">
      <div className="svy-brand">SQUAD SPLIT</div>
      <div className="svy-card">
        <div className="svy-thank-you">
          <div className="svy-thank-icon">✅</div>
          <div className="svy-thank-title">Thanks for rating!</div>
          <div className="svy-thank-text">Your input has been recorded anonymously.</div>
        </div>
        <ResultsBoard survey={survey} results={results} />
      </div>
    </div>
  );

  // ── Active survey form ─────────────────────────────────────────────────────
  const typeLabel = survey.type === 'overall' ? 'Overall Rating (1–10)' : 'Head-to-Head Picks';

  return (
    <div className="svy-root">
      <div className="svy-header">
        <div className="svy-brand">SQUAD SPLIT</div>
        <h1 className="svy-title">Player Survey</h1>
        <p className="svy-subtitle">{typeLabel} · Anonymous · See results after you submit</p>
      </div>

      <div className="svy-card">
        {survey.type === 'overall' ? (
          // ── Overall: chip-row per player ─────────────────────────────────
          <>
            {shuffledPlayers.map((p) => (
              <div key={p.id} className="svy-player-row">
                <span className="svy-player-name">{p.name}</span>
                <div className="svy-score-chips">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`svy-chip${ratings[p.id] === n ? ' active' : ''}`}
                      onClick={() => setRatings((r) => ({ ...r, [p.id]: n }))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="svy-submit-row">
              <button
                type="button"
                className="btn"
                disabled={!allRated || submitting}
                onClick={submit}
              >
                {submitting
                  ? 'Submitting…'
                  : allRated
                  ? 'Submit ratings'
                  : `Rate all ${players.length} players to submit`}
              </button>
            </div>
          </>
        ) : (
          // ── Pairwise: one pair at a time ──────────────────────────────────
          (() => {
            const pair    = pairs[pairIdx];
            if (!pair) return null;
            const [a, b]  = pair;
            const pairKey = `${a.id}|${b.id}`;
            const picked  = picks[pairKey];
            const done    = Object.keys(picks).length;
            const pct     = (done / pairs.length) * 100;

            function pick(winnerId) {
              const next = { ...picks, [pairKey]: winnerId };
              setPicks(next);
              if (pairIdx < pairs.length - 1) setPairIdx((i) => i + 1);
            }

            return (
              <>
                <p className="svy-pair-question">Who is the better player?</p>
                <div className="svy-pair-choices">
                  <button
                    type="button"
                    className={`svy-pair-btn${picked === a.id ? ' picked' : ''}`}
                    onClick={() => pick(a.id)}
                  >
                    {a.name}
                  </button>
                  <span className="svy-pair-vs">VS</span>
                  <button
                    type="button"
                    className={`svy-pair-btn${picked === b.id ? ' picked' : ''}`}
                    onClick={() => pick(b.id)}
                  >
                    {b.name}
                  </button>
                </div>
                <div className="svy-progress-bar">
                  <div className="svy-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="svy-progress-label">
                  {done} of {pairs.length} answered
                  {pairIdx > 0 && (
                    <button
                      type="button"
                      className="svy-back-btn"
                      onClick={() => setPairIdx((i) => Math.max(0, i - 1))}
                    >
                      ← Back
                    </button>
                  )}
                </p>
                {allPicked && (
                  <div className="svy-submit-row">
                    <button
                      type="button"
                      className="btn"
                      disabled={submitting}
                      onClick={submit}
                    >
                      {submitting ? 'Submitting…' : 'Submit picks'}
                    </button>
                  </div>
                )}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
