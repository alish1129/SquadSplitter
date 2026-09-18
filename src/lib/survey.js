// ── Casual browser fingerprint ────────────────────────────────────────────────
// Not cryptographically strong — easy to bypass with incognito/different browser.
// Only used for casual duplicate prevention, not strict enforcement.
export function getFingerprint() {
  const raw = [
    navigator.userAgent,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
  ].join('|');
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

// ── localStorage dedup ────────────────────────────────────────────────────────
const key = (id) => `squad_survey_done_${id}`;

export function hasSubmitted(surveyId) {
  try { return !!localStorage.getItem(key(surveyId)); }
  catch { return false; }
}

export function markSubmitted(surveyId) {
  try { localStorage.setItem(key(surveyId), '1'); }
  catch {}
}

// ── Random pair generator ─────────────────────────────────────────────────────
// Generates up to `count` unique pairs from a player list, shuffled.
export function generatePairs(players, count = 10) {
  const all = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      all.push([players[i], players[j]]);
    }
  }
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
}
