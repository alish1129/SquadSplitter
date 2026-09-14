import { POS_LABEL } from '../lib/teamBalancer.js';

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
