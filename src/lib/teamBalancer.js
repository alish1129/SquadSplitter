import { getEffectiveRating } from './chemistryStyles.js';

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD', 'FLEX'];
export const POS_LABEL = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD', FLEX: 'FLEX' };

// Split `players` (already filtered to is_in === true) into two balanced teams.
//
// Two-phase strategy:
//   1. Distribute GKs first, alternating by running total, so each team gets
//      at most ceil(gkCount/2) goalkeepers. This primes sumA/sumB.
//   2. Run LPT (Longest Processing Time) greedy on the remaining outfield
//      players — assign each to whichever team currently has the lower total.
//      Chemistry style bonuses (via getEffectiveRating) act as the tiebreaker
//      when raw ratings are equal.
//
// Results are deterministic: name is the final tiebreaker, no randomness.
export function generateTeams(players) {
  const primaryPos = (p) => (p.positions && p.positions[0]) || 'FLEX';

  const sortByEff = (arr) =>
    [...arr].sort((a, b) => {
      const d = getEffectiveRating(b) - getEffectiveRating(a);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });

  const gks      = sortByEff(players.filter((p) => primaryPos(p) === 'GK'));
  const outfield = sortByEff(players.filter((p) => primaryPos(p) !== 'GK'));

  const teamA = [];
  const teamB = [];
  let sumA = 0;
  let sumB = 0;

  function assign(p) {
    const eff = getEffectiveRating(p);
    const toA = sumA < sumB || (sumA === sumB && teamA.length <= teamB.length);
    if (toA) { teamA.push(p.id); sumA += eff; }
    else      { teamB.push(p.id); sumB += eff; }
  }

  gks.forEach(assign);      // phase 1 — keeps GKs split across teams
  outfield.forEach(assign); // phase 2 — LPT balances rating totals

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
