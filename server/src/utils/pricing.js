// The "fair broker" price breakdown. SIMSAR takes one fixed, published
// percentage of the job budget; everything else goes to the worker.
function priceBreakdown(budget, feePercent) {
  const platformFee = Math.round((budget * feePercent) / 100);
  return {
    budget,
    feePercent,
    platformFee,
    workerPayout: budget - platformFee,
  };
}

// Smallest budget whose worker payout meets the wage floor after the platform fee.
function minimumBudget(minHourlyRate, hours, feePercent) {
  if (!hours) return 0;
  let budget = Math.ceil((minHourlyRate * hours) / (1 - feePercent / 100));
  // Rounding of the fee can leave the payout a rupee short; step up until it fits.
  while (priceBreakdown(budget, feePercent).workerPayout < minHourlyRate * hours) budget += 1;
  return budget;
}

module.exports = { priceBreakdown, minimumBudget };
