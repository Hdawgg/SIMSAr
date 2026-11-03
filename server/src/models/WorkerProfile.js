const mongoose = require('mongoose');
const { TRADE_SLUG_PATTERN, WEEKDAYS } = require('../config/constants');
const Trade = require('./Trade');

const workerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Trade slug (see models/Trade.js), checked against the trades collection below.
    trade: { type: String, required: [true, 'Trade is required'], lowercase: true, trim: true, match: [TRADE_SLUG_PATTERN, 'Choose a valid trade'] },
    skills: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      validate: [(arr) => arr.length <= 15, 'At most 15 skills'],
    },
    experienceYears: { type: Number, min: 0, max: 60, default: 0 },
    hourlyRate: { type: Number, required: [true, 'Hourly rate is required'], min: 1 },
    location: { type: String, required: [true, 'Location is required'], trim: true, maxlength: 80 },
    pincode: { type: String, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
    bio: { type: String, trim: true, maxlength: 600, default: '' },
    languages: [{ type: String, trim: true, maxlength: 30 }],
    // Availability: a quick on/off switch plus the days the worker usually works.
    isAvailable: { type: Boolean, default: true },
    availableDays: [{ type: String, enum: WEEKDAYS }],
    // Set to true only by an admin approving a BackgroundCheck.
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// The wage floor applies to the worker's own advertised rate too. It is
// checked when the trade or the rate changes, against the trade's current
// minimum, so flipping "taking new jobs" never fails after an admin raises a rate.
workerProfileSchema.pre('validate', async function () {
  if (!this.isNew && !this.isModified('trade') && !this.isModified('hourlyRate')) return;

  const trade = await Trade.findBySlug(this.trade).lean();
  if (!trade) {
    this.invalidate('trade', 'Choose a valid trade');
    return;
  }
  if (!trade.active && (this.isNew || this.isModified('trade'))) {
    this.invalidate('trade', `${trade.label} is not open for new workers on SIMSAR right now`);
    return;
  }
  if (this.hourlyRate != null && this.hourlyRate < trade.minHourlyRate) {
    this.invalidate('hourlyRate', `Hourly rate is below the fair minimum of ₹${trade.minHourlyRate}/hr for ${trade.plural.toLowerCase()}`);
  }
});

workerProfileSchema.index({ trade: 1, verified: 1 });
workerProfileSchema.index({ location: 1 });

module.exports = mongoose.model('WorkerProfile', workerProfileSchema);
