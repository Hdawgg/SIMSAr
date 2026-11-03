const mongoose = require('mongoose');
const { TRADE_SLUG_PATTERN, JOB_STATUSES } = require('../config/constants');
const { priceBreakdown, minimumBudget } = require('../utils/pricing');
const Trade = require('./Trade');

const jobSchema = new mongoose.Schema(
  {
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 5, maxlength: 100 },
    description: { type: String, required: [true, 'Description is required'], trim: true, minlength: 15, maxlength: 2000 },
    // Trade slug (see models/Trade.js), checked against the trades collection below.
    category: { type: String, required: [true, 'Category is required'], lowercase: true, trim: true, match: [TRADE_SLUG_PATTERN, 'Choose a trade'] },
    budget: { type: Number, required: [true, 'Budget is required'], min: [1, 'Budget must be positive'] },
    estimatedHours: { type: Number, required: true, min: 1, max: 200 },
    location: { type: String, required: [true, 'Location is required'], trim: true, maxlength: 80 },
    pincode: { type: String, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
    scheduledFor: { type: Date },
    // Employer option: only workers with an approved ITI certificate for this trade may apply.
    itiRequired: { type: Boolean, default: false },
    status: { type: String, enum: JOB_STATUSES, default: 'open' },
    assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // The commission and the trade's fair minimum rate are locked in when the
    // job is posted, so changing the config or the trade's rate later never
    // changes the deal on an existing job.
    feePercent: { type: Number, required: true, min: 0, max: 50 },
    minHourlyRate: { type: Number, min: 0 },
    platformFee: { type: Number, min: 0 },
    workerPayout: { type: Number, min: 0 },

    // Set when an employer or admin closes a job.
    closedReason: { type: String, trim: true, maxlength: 300 },
    completedAt: Date,
  },
  { timestamps: true }
);

jobSchema.pre('validate', async function () {
  if (this.budget == null || this.feePercent == null) return;

  // Keep the price breakdown in sync with the budget on every save.
  const { platformFee, workerPayout } = priceBreakdown(this.budget, this.feePercent);
  this.platformFee = platformFee;
  this.workerPayout = workerPayout;

  // The wage floor is checked against the trade's *current* rate when the job
  // is posted or edited by the employer. Status changes (accept, start,
  // complete) skip it, so raising a rate never breaks a job already posted.
  const recheck = this.isNew || this.$locals.recheckWageFloor
    || this.isModified('category') || this.isModified('budget') || this.isModified('estimatedHours');
  if (!recheck && this.minHourlyRate != null) return;

  const trade = await Trade.findBySlug(this.category).lean();
  if (!trade) {
    this.invalidate('category', 'Choose a valid trade');
    return;
  }
  if (!trade.active && (this.isNew || this.isModified('category'))) {
    this.invalidate('category', `${trade.label} jobs are not being accepted on SIMSAR right now`);
    return;
  }
  if (!recheck) return; // an old job without a snapshot: leave it as it was

  this.minHourlyRate = trade.minHourlyRate;
  if (this.estimatedHours && workerPayout / this.estimatedHours < trade.minHourlyRate) {
    const minBudget = minimumBudget(trade.minHourlyRate, this.estimatedHours, this.feePercent);
    this.invalidate('budget',
      `Below the fair minimum: ${trade.plural.toLowerCase()} must earn at least ₹${trade.minHourlyRate}/hr. ` +
      `For ${this.estimatedHours} hr the budget must be at least ₹${minBudget}.`);
  }
});

jobSchema.index({ status: 1, category: 1, createdAt: -1 });
jobSchema.index({ employer: 1, createdAt: -1 });
jobSchema.index({ location: 1 });
jobSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Job', jobSchema);
