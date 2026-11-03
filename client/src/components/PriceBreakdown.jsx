import { formatINR, priceBreakdown } from '../utils/format';

// The "fair broker" breakdown shown on every job: budget, SIMSAR's fixed fee,
// and what the worker takes home. Passing `hours` adds a per-hour line.
export default function PriceBreakdown({ budget, feePercent, hours }) {
  const p = priceBreakdown(budget, feePercent);
  return (
    <dl className="small mb-0">
      <div className="d-flex justify-content-between">
        <dt className="text-slate fw-normal">Job budget</dt>
        <dd className="fw-medium mb-1">{formatINR(p.budget)}</dd>
      </div>
      <div className="d-flex justify-content-between">
        <dt className="text-slate fw-normal">SIMSAR fee ({feePercent}%)</dt>
        <dd className="fw-medium mb-1">− {formatINR(p.platformFee)}</dd>
      </div>
      <div className="d-flex justify-content-between align-items-baseline pt-2" style={{ borderTop: '1px dashed var(--line)' }}>
        <dt className="fw-semibold">Worker payout</dt>
        <dd className="fw-bold fs-5 mb-0">{formatINR(p.workerPayout)}</dd>
      </div>
      {hours > 0 && (
        <p className="text-slate mb-0 text-end">≈ {formatINR(p.workerPayout / hours)}/hr for {hours} hr</p>
      )}
    </dl>
  );
}
