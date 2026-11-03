const mongoose = require('mongoose');
const { APPLICATION_STATUSES } = require('../config/constants');

// A worker's application to a job. Once accepted it becomes the booking and
// moves through: accepted -> in-progress -> completed (or cancelled).
const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Copied from the job so "my bookings" queries for employers need no join.
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coverNote: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'applied' },
    acceptedAt: Date,
    startedAt: Date,
    workerDoneAt: Date, // worker says "work done"; employer then confirms completion
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

// A worker can apply to a job only once.
applicationSchema.index({ job: 1, worker: 1 }, { unique: true });
applicationSchema.index({ worker: 1, status: 1 });
applicationSchema.index({ employer: 1, status: 1 });

module.exports = mongoose.model('Application', applicationSchema);
