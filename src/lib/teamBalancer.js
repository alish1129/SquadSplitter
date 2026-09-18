import { getEffectiveRating } from './chemistryStyles.js';

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD', 'FLEX'];
export const POS_LABEL = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD', FLEX: 'FLEX' };

// Split `players` (already filtered to is_in === true) into two balanced teams.
//
// All players are sorted globally by effective rating (highest first), then
// assigned one at a time to whichever team has the lower running total (LPT).
// This guarantees the #1-rated player and the #2-rated player always end up on
// opposite teams — each subsequent player continues to balance the totals.
// Chemistry style bonuses (via getEffectiveRating) act as the natural
// tiebreaker when raw ratings are equal.
//
// The only position constraint enforced is GK stacking: each team receives at
// most ceil(gkCount/2) goalkeepers regardless of where they fall in the sort.
// Results are fully deterministic — name breaks any remaining ties.
export function generateTeams(players) {
  const primaryPos = (p) => (p.positions && p.positions[0]) || 'FLEX';

  const gkTotal = players.filter((p) => primaryPos(p) === 'GK').length;
  const gkMax   = Math.ceil(gkTotal / 2);

  // Single global sort by effective rating — top players are processed first
  const sorted = [...players].sort((a, b) => {
    const d = getEffectiveRating(b) - getEffectiveRating(a);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  const teamA = [], teamB = [];
  let sumA = 0, sumB = 0;
  let gkA  = 0, gkB  = 0;

  sorted.forEach((p) => {
    const eff  = getEffectiveRating(p);
    const isGK = primaryPos(p) === 'GK';

    let toA;
    if      (isGK && gkA >= gkMax) toA = false; // A's GK slots full
    else if (isGK && gkB >= gkMax) toA = true;  // B's GK slots full
    else toA = sumA < sumB || (sumA === sumB && teamA.length <= teamB.length);

    if (toA) { teamA.push(p.id); sumA += eff; if (isGK) gkA++; }
    else      { teamB.push(p.id); sumB += eff; if (isGK) gkB++; }
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

export function teamsAsSquadList(teams, playersById) {
  if (!teams) return '';
  const block = (label, ids) => {
    const names = ids
      .map((id) => playersById[id]?.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return [label, ...names].join('\n');
  };
  return `${block('🟠 PINNIES', teams.team_a)}\n\n${block('🔵 SHIRTS', teams.team_b)}`;
}
