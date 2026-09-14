// Attribute clusters that benefit each primary position
const POS_ATTRS = {
  GK:   ['defending', 'physical'],
  DEF:  ['defending', 'physical', 'pace'],
  MID:  ['passing', 'dribbling', 'pace'],
  FWD:  ['shooting', 'pace', 'dribbling'],
  FLEX: ['pace', 'physical'],
};

export const CHEM_STYLES = {
  // ── Attacking ─────────────────────────────────────────────────
  Hunter:     { label: 'Hunter',     emoji: '🎯', category: 'Attacking', attrs: ['pace', 'shooting'] },
  Hawk:       { label: 'Hawk',       emoji: '🦅', category: 'Attacking', attrs: ['pace', 'shooting', 'physical'] },
  Finisher:   { label: 'Finisher',   emoji: '⚡', category: 'Attacking', attrs: ['shooting', 'dribbling'] },
  Deadeye:    { label: 'Deadeye',    emoji: '🎪', category: 'Attacking', attrs: ['shooting', 'passing'] },
  Marksman:   { label: 'Marksman',   emoji: '🏹', category: 'Attacking', attrs: ['shooting', 'dribbling', 'physical'] },
  Sniper:     { label: 'Sniper',     emoji: '🔭', category: 'Attacking', attrs: ['shooting', 'physical'] },
  // ── Midfield ──────────────────────────────────────────────────
  Engine:     { label: 'Engine',     emoji: '⚙️',  category: 'Midfield', attrs: ['pace', 'passing', 'dribbling'] },
  Catalyst:   { label: 'Catalyst',   emoji: '⚗️',  category: 'Midfield', attrs: ['pace', 'passing'] },
  Artist:     { label: 'Artist',     emoji: '🎨',  category: 'Midfield', attrs: ['passing', 'dribbling'] },
  Architect:  { label: 'Architect',  emoji: '📐',  category: 'Midfield', attrs: ['passing', 'physical'] },
  // ── Defending ─────────────────────────────────────────────────
  Shadow:     { label: 'Shadow',     emoji: '🌑',  category: 'Defending', attrs: ['pace', 'defending'] },
  Anchor:     { label: 'Anchor',     emoji: '⚓',  category: 'Defending', attrs: ['pace', 'defending', 'physical'] },
  Sentinel:   { label: 'Sentinel',   emoji: '🛡️',  category: 'Defending', attrs: ['defending', 'physical'] },
  Guardian:   { label: 'Guardian',   emoji: '🧲',  category: 'Defending', attrs: ['dribbling', 'defending'] },
  Powerhouse: { label: 'Powerhouse', emoji: '💪',  category: 'Defending', attrs: ['passing', 'defending'] },
};

export const CHEM_STYLE_LIST = Object.entries(CHEM_STYLES).map(([id, meta]) => ({ id, ...meta }));
export const CHEM_CATEGORIES = ['Attacking', 'Midfield', 'Defending'];

// Effective rating = raw rating boosted by how well the chemistry style
// matches the player's primary position. Perfect match = +8%.
export function getEffectiveRating(player) {
  const { rating = 50, chemistry_style: cs, positions } = player;
  if (!cs || !CHEM_STYLES[cs]) return rating;

  const primaryPos = (positions && positions[0]) || 'FLEX';
  const idealAttrs = POS_ATTRS[primaryPos] ?? [];
  const styleAttrs = CHEM_STYLES[cs].attrs;

  const matchCount = styleAttrs.filter((a) => idealAttrs.includes(a)).length;
  const bonus = 0.08 * (matchCount / styleAttrs.length);
  return Math.round(rating * (1 + bonus) * 10) / 10;
}
