// Small display helpers shared by many pages.

export function formatINR(n) {
  return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export function timeAgo(value) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

// Same formula as server/src/utils/pricing.js, so previews match what the
// server will store.
export function priceBreakdown(budget, feePercent) {
  const b = Number(budget) || 0;
  const platformFee = Math.round((b * feePercent) / 100);
  return { budget: b, feePercent, platformFee, workerPayout: b - platformFee };
}

// Smallest budget whose worker payout meets the trade's fair minimum
// (trade.minHourlyRate comes from the database via GET /api/trades).
export function minimumBudget(trade, hours, feePercent) {
  if (!trade || !hours) return 0;
  let budget = Math.ceil((trade.minHourlyRate * hours) / (1 - feePercent / 100));
  while (priceBreakdown(budget, feePercent).workerPayout < trade.minHourlyRate * hours) budget += 1;
  return budget;
}

export function formatBytes(n) {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}
