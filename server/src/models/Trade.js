const mongoose = require('mongoose');
const { TRADE_SLUG_PATTERN } = require('../config/constants');

// A trade and its fair minimum hourly rate (the wage floor). Admins edit these
// from the dashboard; nothing in the code hardcodes the list or the rates.
//
// Other collections reference a trade by its `slug` (WorkerProfile.trade,
// Job.category, ItiCertificate.trade). The slug can never change after the
// trade is created, so those references can't go stale.
const tradeSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      immutable: true,
      match: [TRADE_SLUG_PATTERN, 'Slug must be 2–30 lowercase letters, digits or hyphens, starting with a letter'],
    },
    label: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 40 },
    plural: { type: String, required: [true, 'Plural name is required'], trim: true, minlength: 2, maxlength: 40 },
    // A Bootstrap Icons class name, e.g. "bi-lightning-charge-fill".
    icon: { type: String, trim: true, default: 'bi-tools', match: [/^bi-[a-z0-9-]+$/, 'Icon must be a Bootstrap Icons class, e.g. bi-tools'] },
    minHourlyRate: { type: Number, required: [true, 'Minimum hourly rate is required'], min: [0, 'Minimum hourly rate cannot be negative'] },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    // Inactive trades disappear from dropdowns, but existing workers and jobs keep them.
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0, max: 999 },
  },
  { timestamps: true }
);

tradeSchema.index({ active: 1, sortOrder: 1 });

tradeSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug: String(slug || '').toLowerCase() });
};

module.exports = mongoose.model('Trade', tradeSchema);
