import { POS_LABEL } from '../lib/teamBalancer.js';
import { CHEM_STYLES } from '../lib/chemistryStyles.js';

export function PosPill({ positions }) {
  const list = positions && positions.length ? positions : ['FLEX'];
  const primary = list[0];
  const label = list.map((p) => POS_LABEL[p]).join(' / ');
  return (
    <span className={`pos-pill pos-${primary}`}>
      <span className="pos-dot" />
      {label}
    </span>
  );
}

export function RatingBadge({ rating }) {
  return <span className="rating-badge">{rating}</span>;
}

export function ChemStyleBadge({ chemStyle }) {
  if (!chemStyle || !CHEM_STYLES[chemStyle]) return null;
  const { emoji, label, category } = CHEM_STYLES[chemStyle];
  return (
    <span
      className={`chem-badge chem-${category.toLowerCase()}`}
      title={`${label} — ${category}`}
    >
      {emoji} {label}
    </span>
  );
}
