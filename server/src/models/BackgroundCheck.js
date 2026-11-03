const mongoose = require('mongoose');
const { CHECK_STATUSES, ID_TYPES } = require('../config/constants');

// Simple format rules per ID type. This is a simulated check: the admin
// reviews the details by hand, no third-party verification API is called.
const ID_PATTERNS = {
  aadhaar: /^\d{12}$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  'voter-id': /^[A-Z]{3}\d{7}$/,
  'driving-licence': /^[A-Z]{2}\d{2}\s?\d{11}$/,
  passport: /^[A-Z]\d{7}$/,
};

const backgroundCheckSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    idType: { type: String, enum: ID_TYPES, required: [true, 'ID type is required'] },
    idNumber: { type: String, required: [true, 'ID number is required'], trim: true, uppercase: true },
    fullNameOnId: { type: String, required: true, trim: true, maxlength: 80 },
    dateOfBirth: { type: Date, required: [true, 'Date of birth is required'] },
    address: {
      line1: { type: String, required: [true, 'Address is required'], trim: true, maxlength: 200 },
      city: { type: String, required: [true, 'City is required'], trim: true, maxlength: 60 },
      state: { type: String, required: [true, 'State is required'], trim: true, maxlength: 60 },
      pincode: { type: String, required: true, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
    },
    consent: { type: Boolean, required: true, validate: [(v) => v === true, 'Consent is required'] },
    status: { type: String, enum: CHECK_STATUSES, default: 'pending' },
    reviewerNotes: { type: String, trim: true, maxlength: 500, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

backgroundCheckSchema.path('idNumber').validate(function (value) {
  const pattern = ID_PATTERNS[this.idType];
  return !pattern || pattern.test(value);
}, 'ID number format does not match the selected ID type');

// Workers must be adults.
backgroundCheckSchema.path('dateOfBirth').validate(function (dob) {
  const eighteen = new Date();
  eighteen.setFullYear(eighteen.getFullYear() - 18);
  return dob <= eighteen;
}, 'Worker must be at least 18 years old');

backgroundCheckSchema.index({ worker: 1, createdAt: -1 });
backgroundCheckSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('BackgroundCheck', backgroundCheckSchema);
