import { getEffectiveRating } from './chemistryStyles.js';

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD', 'FLEX'];
export const POS_LABEL = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD', FLEX: 'FLEX' };

// Split `players` (already filtered to is_in === true) into two balanced teams.
// Uses the LPT (Longest Processing Time) greedy algorithm: sort all players by
// effective rating descending, then assign each to whichever team currently has
// the lower running total. Chemistry style bonuses are already included in
// getEffectiveRating, so they naturally act as the tiebreaker for equal ratings.
export function generateTeams(players) {
  const sorted = [...players].sort((a, b) => {
    const diff = getEffectiveRating(b) - getEffectiveRating(a);
    return diff !== 0 ? diff : a.name.localeCompare(b.name); // deterministic tiebreak
  });

  const teamA = [];
  const teamB = [];
  let sumA = 0;
  let sumB = 0;

  sorted.forEach((p) => {
    const eff = getEffectiveRating(p);
    // Assign to lower-total team; break exact ties by team size then always A.
    const toA = sumA < sumB || (sumA === sumB && teamA.length <= teamB.length);
    if (toA) {
      teamA.push(p.id);
      sumA += eff;
    } else {
      teamB.push(p.id);
      sumB += eff;
    }
  });

  return { team_a: teamA, team_b: teamB };
}

export function computeTeamStats(ids, playersById) {
  const byPos = { GK: [], DEF: [], MID: [], FWD: [], FLEX: [] };
  let total = 0;
  let count = 0;
  ids.forEach((id) => {
    const p = playersById[id];
    if (!p) return;
    const primary = (p.positions && p.positions[0]) || 'FLEX';
    byPos[primary].push(p);
    total += p.rating;
    count += 1;
  });
  return { byPos, total, count };
}

export function teamsAsText(teams, playersById) {
  if (!teams) return '';
  const block = (label, ids) => {
    const stats = computeTeamStats(ids, playersById);
    const avg = stats.count ? (stats.total / stats.count).toFixed(1) : '0.0';
    const lines = [`${label} — avg ${avg}`];
    POSITIONS.forEach((pos) => {
      stats.byPos[pos].forEach((p) => lines.push(`${POS_LABEL[pos]}: ${p.name}`));
    });
    return lines.join('\n');
  };
  return `${block('🟠 PINNIES', teams.team_a)}\n\n${block('🔵 SHIRTS', teams.team_b)}`;
}
