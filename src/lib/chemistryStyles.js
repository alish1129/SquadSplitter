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
  Hunter: {
    label: 'Hunter', emoji: '🎯', category: 'Attacking',
    attrs: ['pace', 'shooting'],
    description: 'Pure pace & finishing — breaks in behind and converts chances.',
  },
  Hawk: {
    label: 'Hawk', emoji: '🦅', category: 'Attacking',
    attrs: ['pace', 'shooting', 'physical'],
    description: 'Physical striker who wins aerial duels, runs channels and finishes.',
  },
  Finisher: {
    label: 'Finisher', emoji: '⚡', category: 'Attacking',
    attrs: ['shooting', 'dribbling'],
    description: 'Technical scorer — dribbles into pockets of space then shoots.',
  },
  Deadeye: {
    label: 'Deadeye', emoji: '🎪', category: 'Attacking',
    attrs: ['shooting', 'passing'],
    description: 'Creates and converts — links play with sharp passes and clinical finishing.',
  },
  Marksman: {
    label: 'Marksman', emoji: '🏹', category: 'Attacking',
    attrs: ['shooting', 'dribbling', 'physical'],
    description: 'Powerful forward — holds up play, shrugs off defenders and finishes.',
  },
  Sniper: {
    label: 'Sniper', emoji: '🔭', category: 'Attacking',
    attrs: ['shooting', 'physical'],
    description: 'Clinical in front of goal — powerful strikes from any distance.',
  },
  // ── Midfield ──────────────────────────────────────────────────
  Engine: {
    label: 'Engine', emoji: '⚙️', category: 'Midfield',
    attrs: ['pace', 'passing', 'dribbling'],
    description: 'Box-to-box dynamo — covers every blade of grass, passes and carries.',
  },
  Catalyst: {
    label: 'Catalyst', emoji: '⚗️', category: 'Midfield',
    attrs: ['pace', 'passing'],
    description: 'Fast midfielder who drives forward and keeps the ball moving quickly.',
  },
  Artist: {
    label: 'Artist', emoji: '🎨', category: 'Midfield',
    attrs: ['passing', 'dribbling'],
    description: 'Technical playmaker — threads killer passes and dribbles out of tight spots.',
  },
  Architect: {
    label: 'Architect', emoji: '📐', category: 'Midfield',
    attrs: ['passing', 'physical'],
    description: 'Deep-lying playmaker — dictates tempo, wins second balls and recycles play.',
  },
  // ── Defending ─────────────────────────────────────────────────
  Shadow: {
    label: 'Shadow', emoji: '🌑', category: 'Defending',
    attrs: ['pace', 'defending'],
    description: 'Speedy defender who tracks runners, intercepts and recovers quickly.',
  },
  Anchor: {
    label: 'Anchor', emoji: '⚓', category: 'Defending',
    attrs: ['pace', 'defending', 'physical'],
    description: 'Dominant centre-back — pace, aerial ability and physicality all in one.',
  },
  Sentinel: {
    label: 'Sentinel', emoji: '🛡️', category: 'Defending',
    attrs: ['defending', 'physical'],
    description: 'Solid, physical stopper — wins duels, holds the line and clears danger.',
  },
  Guardian: {
    label: 'Guardian', emoji: '🧲', category: 'Defending',
    attrs: ['dribbling', 'defending'],
    description: 'Ball-playing defender — dribbles out of pressure instead of just booting it.',
  },
  Powerhouse: {
    label: 'Powerhouse', emoji: '💪', category: 'Defending',
    attrs: ['passing', 'defending'],
    description: 'Defensive midfielder — breaks up play, recycles possession and covers the backline.',
  },
};

export const CHEM_STYLE_LIST = Object.entries(CHEM_STYLES).map(([id, meta]) => ({ id, ...meta }));
export const CHEM_CATEGORIES = ['Attacking', 'Midfield', 'Defending'];

// Effective rating = raw rating boosted by how well the assigned chemistry
// styles match the player's primary position. Each style contributes up to
// +8%; bonuses are summed and capped at +10% so three weak styles never
// beat one perfect match by much.
export function getEffectiveRating(player) {
  const { rating = 50, chemistry_styles: styles, positions } = player;
  if (!styles || styles.length === 0) return rating;

  const primaryPos = (positions && positions[0]) || 'FLEX';
  const idealAttrs = POS_ATTRS[primaryPos] ?? [];

  let totalBonus = 0;
  for (const cs of styles) {
    const style = CHEM_STYLES[cs];
    if (!style) continue;
    const matchCount = style.attrs.filter((a) => idealAttrs.includes(a)).length;
    totalBonus += 0.08 * (matchCount / style.attrs.length);
  }

  const bonus = Math.min(totalBonus, 0.10);
  return Math.round(rating * (1 + bonus) * 10) / 10;
}
