const Application = require('../models/Application');
const Job = require('../models/Job');
const WorkerProfile = require('../models/WorkerProfile');
const Review = require('../models/Review');
const { requireItiIfNeeded } = require('./jobController');
const ApiError = require('../utils/ApiError');

// Loads an application and checks the current user is the given party.
async function loadApplication(id, user, party) {
  const application = await Application.findById(id);
  if (!application) throw ApiError.notFound('Application not found.');
  if (!application[party].equals(user._id)) throw ApiError.forbidden('This is not your application.');
  const job = await Job.findById(application.job);
  if (!job) throw ApiError.notFound('Job not found.');
  return { application, job };
}

function requireStatus(application, allowed, action) {
  if (!allowed.includes(application.status)) {
    throw ApiError.badRequest(`Cannot ${action} an application that is "${application.status}".`);
  }
}

// GET /api/applications/mine — worker's applications and bookings.
async function myApplications(req, res) {
  const applications = await Application.find({ worker: req.user._id })
    .sort({ updatedAt: -1 })
    .populate({ path: 'job', populate: { path: 'employer', select: 'name ratingAvg ratingCount' } })
    .lean();

  const myReviews = await Review.find({ reviewer: req.user._id }).select('job rating');
  const reviewMap = new Map(myReviews.map((r) => [String(r.job), r.rating]));

  res.json({
    applications: applications
      .filter((a) => a.job) // skip applications whose job was deleted by an admin
      .map((a) => ({ ...a, myRating: reviewMap.get(String(a.job._id)) || null })),
  });
}

// PATCH /api/applications/:id/accept — employer picks this worker.
async function accept(req, res) {
  const { application, job } = await loadApplication(req.params.id, req.user, 'employer');
  requireStatus(application, ['applied'], 'accept');
  if (job.status !== 'open') throw ApiError.badRequest('A worker has already been chosen for this job.');

  const profile = await WorkerProfile.findOne({ user: application.worker });
  if (!profile?.verified) throw ApiError.badRequest('This worker has not passed the background check yet.');
  await requireItiIfNeeded(job, application.worker, 'The worker needs');

  application.status = 'accepted';
  application.acceptedAt = new Date();
  await application.save();

  job.status = 'assigned';
  job.assignedWorker = application.worker;
  await job.save();

  // Everyone else who applied is told the position is filled.
  await Application.updateMany({ job: job._id, _id: { $ne: application._id }, status: 'applied' }, { status: 'rejected' });

  res.json({ application, job });
}

// PATCH /api/applications/:id/reject
async function reject(req, res) {
  const { application } = await loadApplication(req.params.id, req.user, 'employer');
  requireStatus(application, ['applied'], 'reject');
  application.status = 'rejected';
  await application.save();
  res.json({ application });
}

// PATCH /api/applications/:id/start — worker starts the job.
async function start(req, res) {
  const { application, job } = await loadApplication(req.params.id, req.user, 'worker');
  requireStatus(application, ['accepted'], 'start');
  application.status = 'in-progress';
  application.startedAt = new Date();
  await application.save();
  job.status = 'in-progress';
  await job.save();
  res.json({ application, job });
}

// PATCH /api/applications/:id/done — worker marks the work as done.
async function markDone(req, res) {
  const { application } = await loadApplication(req.params.id, req.user, 'worker');
  requireStatus(application, ['in-progress'], 'mark as done');
  if (application.workerDoneAt) throw ApiError.badRequest('You have already marked this work as done.');
  application.workerDoneAt = new Date();
  await application.save();
  res.json({ application });
}

// PATCH /api/applications/:id/complete — employer confirms the job is complete.
async function complete(req, res) {
  const { application, job } = await loadApplication(req.params.id, req.user, 'employer');
  requireStatus(application, ['in-progress'], 'complete');
  const now = new Date();
  application.status = 'completed';
  application.completedAt = now;
  await application.save();
  job.status = 'completed';
  job.completedAt = now;
  await job.save();
  res.json({ application, job });
}

// PATCH /api/applications/:id/cancel — worker withdraws, or employer cancels a booking.
// If an accepted booking is cancelled the job re-opens for other applicants.
async function cancel(req, res) {
  const application = await Application.findById(req.params.id);
  if (!application) throw ApiError.notFound('Application not found.');
  const isWorker = application.worker.equals(req.user._id);
  const isEmployer = application.employer.equals(req.user._id);
  if (!isWorker && !isEmployer) throw ApiError.forbidden('This is not your application.');

  const allowed = isWorker ? ['applied', 'accepted'] : ['accepted', 'in-progress'];
  requireStatus(application, allowed, 'cancel');

  const wasBooked = application.status !== 'applied';
  application.status = 'cancelled';
  application.cancelledAt = new Date();
  await application.save();

  let job = null;
  if (wasBooked) {
    job = await Job.findById(application.job);
    job.status = 'open';
    job.assignedWorker = null;
    await job.save();
  }
  res.json({ application, job });
}

module.exports = { myApplications, accept, reject, start, markDone, complete, cancel };
