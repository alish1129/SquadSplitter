import { getEffectiveRating } from './chemistryStyles.js';

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD', 'FLEX'];
export const POS_LABEL = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD', FLEX: 'FLEX' };

export const TEAMS_CONFIG = [
  { name: 'Pinnies', icon: '🟠', cls: 'pinnies' },
  { name: 'Shirts',  icon: '🔵', cls: 'shirts'  },
  { name: 'Bibs',   icon: '🟢', cls: 'team-c'  },
  { name: 'Reds',   icon: '🔴', cls: 'team-d'  },
  { name: 'Darks',  icon: '⚫', cls: 'team-e'  },
  { name: 'Yellows',icon: '🟡', cls: 'team-f'  },
];

// LPT greedy split into numTeams balanced teams.
// GK distribution: each team gets at most ceil(gkTotal/numTeams) goalkeepers.
// Results are fully deterministic — effective rating breaks ties, then name.
export function generateTeams(players, numTeams = 2) {
  const primaryPos = (p) => (p.positions && p.positions[0]) || 'FLEX';
  const gkTotal    = players.filter((p) => primaryPos(p) === 'GK').length;
  const gkPerTeam  = Math.ceil(gkTotal / numTeams);

  const sorted = [...players].sort((a, b) => {
    const d = getEffectiveRating(b) - getEffectiveRating(a);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  const teams    = Array.from({ length: numTeams }, () => []);
  const sums     = new Array(numTeams).fill(0);
  const gkCounts = new Array(numTeams).fill(0);

  const bestIdx = (pool) =>
    pool.reduce((best, i) =>
      sums[i] < sums[best] || (sums[i] === sums[best] && teams[i].length < teams[best].length)
        ? i : best
    );

  sorted.forEach((p) => {
    const eff  = getEffectiveRating(p);
    const isGK = primaryPos(p) === 'GK';
    const all  = teams.map((_, i) => i);

    let toIdx;
    if (isGK) {
      const eligible = all.filter((i) => gkCounts[i] < gkPerTeam);
      toIdx = bestIdx(eligible.length ? eligible : all);
      gkCounts[toIdx]++;
    } else {
      toIdx = bestIdx(all);
    }

    teams[toIdx].push(p.id);
    sums[toIdx] += eff;
  });

  return { teams, team_a: teams[0] ?? [], team_b: teams[1] ?? [] };
}

export function computeTeamStats(ids, playersById) {
  const byPos = { GK: [], DEF: [], MID: [], FWD: [], FLEX: [] };
  let total = 0, count = 0;
  ids.forEach((id) => {
    const p = playersById[id];
    if (!p) return;
    byPos[(p.positions && p.positions[0]) || 'FLEX'].push(p);
    total += p.rating;
    count++;
  });
  return { byPos, total, count };
}

export function teamsAsText(split, playersById) {
  const allTeams = split.teams ?? [split.team_a, split.team_b];
  return allTeams.map((ids, i) => {
    const cfg   = TEAMS_CONFIG[i] ?? { name: `Team ${i + 1}`, icon: '⚽' };
    const stats = computeTeamStats(ids, playersById);
    const avg   = stats.count ? (stats.total / stats.count).toFixed(1) : '0.0';
    const lines = [`${cfg.icon} ${cfg.name.toUpperCase()} — avg ${avg}`];
    POSITIONS.forEach((pos) => stats.byPos[pos].forEach((p) => lines.push(`${POS_LABEL[pos]}: ${p.name}`)));
    return lines.join('\n');
  }).join('\n\n');
}
