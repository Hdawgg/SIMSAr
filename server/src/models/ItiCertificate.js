const mongoose = require('mongoose');
const { CHECK_STATUSES, COUNCIL_TYPES, ITI_FIRST_YEAR, TRADE_SLUG_PATTERN } = require('../config/constants');

// An ITI (Industrial Training Institute) certificate a worker submits as an
// extra credential, separate from the background check. This is SIMULATED:
// a SIMSAR admin compares the details with the uploaded scan by hand. No
// government system (NCVT MIS or a state council) is contacted.

// Certificate numbers are stored without spaces, slashes or hyphens and in
// upper case, so "ncvt/2014-1234 5678" and "NCVT201412345678" count as the same
// certificate for the duplicate check.
const normaliseNumber = (v) => (v == null ? v : String(v).toUpperCase().replace(/[\s/-]/g, ''));

const itiCertificateSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Trade slug; must match the worker's trade (checked in the controller).
    trade: { type: String, required: [true, 'Trade is required'], lowercase: true, trim: true, match: [TRADE_SLUG_PATTERN, 'Choose a valid trade'] },
    instituteName: { type: String, required: [true, 'Institute name is required'], trim: true, minlength: 3, maxlength: 120 },
    instituteState: { type: String, required: [true, 'State is required'], trim: true, minlength: 2, maxlength: 60 },
    instituteDistrict: { type: String, required: [true, 'District is required'], trim: true, minlength: 2, maxlength: 60 },
    certificateNumber: {
      type: String,
      required: [true, 'Certificate number is required'],
      set: normaliseNumber,
      match: [/^(?=.*\d)[A-Z0-9]{8,20}$/, 'Certificate number must be 8–20 letters and digits, with at least one digit'],
    },
    registrationNumber: {
      type: String,
      set: normaliseNumber,
      match: [/^[A-Z0-9]{6,20}$/, 'Registration number must be 6–20 letters and digits'],
    },
    councilType: { type: String, enum: { values: COUNCIL_TYPES, message: 'Council must be NCVT or SCVT' }, required: [true, 'Council is required'] },
    passingYear: {
      type: Number,
      required: [true, 'Passing year is required'],
      min: [ITI_FIRST_YEAR, `Passing year must be ${ITI_FIRST_YEAR} or later`],
      validate: [
        (y) => Number.isInteger(y) && y <= new Date().getFullYear(),
        'Passing year cannot be in the future',
      ],
    },
    grade: { type: String, trim: true, maxlength: 20 },
    percentage: { type: Number, min: [0, 'Percentage must be 0–100'], max: [100, 'Percentage must be 0–100'] },
    // The uploaded scan, stored under server/uploads/iti/ with a random name.
    // Served only to the owner and admins through GET /api/iti-certificates/:id/file.
    file: {
      storedName: { type: String, required: [true, 'Upload the certificate'] },
      originalName: { type: String, maxlength: 200 },
      mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf'] },
      size: Number,
    },
    status: { type: String, enum: CHECK_STATUSES, default: 'pending' },
    reviewerNote: { type: String, trim: true, maxlength: 500, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  {
    timestamps: true,
    id: false,
    toObject: { virtuals: true },
    // The stored file name never leaves the server; clients use the /file route.
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        if (ret.file) delete ret.file.storedName;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// "ref Trade" through the slug: .populate('tradeInfo') loads the Trade document.
itiCertificateSchema.virtual('tradeInfo', {
  ref: 'Trade',
  localField: 'trade',
  foreignField: 'slug',
  justOne: true,
});

itiCertificateSchema.path('reviewerNote').validate(function (note) {
  return this.status !== 'rejected' || Boolean(note && note.trim());
}, 'Add a note telling the worker why the certificate was rejected');

// The same certificate can't be claimed by two workers. Rejected submissions
// are left out of the index, so a false claim that was rejected never blocks
// the real owner, and a worker can re-submit after fixing a mistake.
itiCertificateSchema.index(
  { certificateNumber: 1, councilType: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'approved'] } } }
);
itiCertificateSchema.index({ worker: 1, createdAt: -1 });
itiCertificateSchema.index({ worker: 1, trade: 1, status: 1 });
itiCertificateSchema.index({ status: 1, createdAt: 1 });

itiCertificateSchema.statics.normaliseNumber = normaliseNumber;

// What anyone may see about a worker's approved certificates (no numbers, no file).
itiCertificateSchema.statics.publicSummary = function (cert) {
  return { _id: cert._id, trade: cert.trade, councilType: cert.councilType, passingYear: cert.passingYear, instituteName: cert.instituteName, instituteState: cert.instituteState };
};

module.exports = mongoose.model('ItiCertificate', itiCertificateSchema);
