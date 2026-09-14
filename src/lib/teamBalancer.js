import { getEffectiveRating } from './chemistryStyles.js';

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD', 'FLEX'];
export const POS_LABEL = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD', FLEX: 'FLEX' };

// Split `players` (already filtered to is_in === true) into two balanced teams.
// Groups by primary position, sorts by effective rating (raw + chemistry style
// bonus), then greedily assigns each player to the lower-total team.
export function generateTeams(players) {
  const groups = {};
  POSITIONS.forEach((pos) => {
    groups[pos] = [];
  });
  players.forEach((p) => {
    const primary = (p.positions && p.positions[0]) || 'FLEX';
    (groups[primary] || groups.FLEX).push(p);
  });

  const teamA = [];
  const teamB = [];
  let sumA = 0;
  let sumB = 0;
  let flip = false;

  POSITIONS.forEach((pos) => {
    const arr = [...groups[pos]].sort(
      (a, b) => getEffectiveRating(b) - getEffectiveRating(a) || Math.random() - 0.5
    );
    arr.forEach((p) => {
      const eff = getEffectiveRating(p);
      let toA;
      if (sumA < sumB) toA = true;
      else if (sumB < sumA) toA = false;
      else {
        toA = !flip;
        flip = !flip;
      }
      if (toA) {
        teamA.push(p.id);
        sumA += eff;
      } else {
        teamB.push(p.id);
        sumB += eff;
      }
    });
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
