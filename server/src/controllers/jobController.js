const Job = require('../models/Job');
const Application = require('../models/Application');
const WorkerProfile = require('../models/WorkerProfile');
const EmployerProfile = require('../models/EmployerProfile');
const Review = require('../models/Review');
const Trade = require('../models/Trade');
const ItiCertificate = require('../models/ItiCertificate');
const { approvedItiByWorker } = require('./itiController');
const ApiError = require('../utils/ApiError');
const { escapeRegex, pick, publicUser } = require('../utils/helpers');
const { platformFeePercent } = require('../config/env');

const EDITABLE_FIELDS = ['title', 'description', 'category', 'budget', 'estimatedHours', 'location', 'pincode', 'scheduledFor', 'itiRequired'];

async function findOwnJob(jobId, employerId) {
  const job = await Job.findById(jobId);
  if (!job) throw ApiError.notFound('Job not found.');
  if (!job.employer.equals(employerId)) throw ApiError.forbidden('This is not your job.');
  return job;
}

// GET /api/jobs — public job board.
// Query: category, location, minBudget, maxBudget, q, status (default open)
async function listJobs(req, res) {
  const { category, location, minBudget, maxBudget, q, status = 'open' } = req.query;
  const filter = { status };
  if (category) filter.category = category;
  if (location) filter.location = new RegExp(escapeRegex(location), 'i');
  if (minBudget || maxBudget) {
    filter.budget = {};
    if (minBudget) filter.budget.$gte = Number(minBudget);
    if (maxBudget) filter.budget.$lte = Number(maxBudget);
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { description: rx }];
  }

  const jobs = await Job.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('employer', 'name role ratingAvg ratingCount');

  res.json({ jobs });
}

// GET /api/jobs/:id — public job detail with the employer's profile.
async function getJob(req, res) {
  const job = await Job.findById(req.params.id)
    .populate('employer', 'name role ratingAvg ratingCount createdAt')
    .populate('assignedWorker', 'name role ratingAvg ratingCount');
  if (!job) throw ApiError.notFound('Job not found.');

  const employerProfile = await EmployerProfile.findOne({ user: job.employer._id }).select('company location');
  const applicationCount = await Application.countDocuments({ job: job._id });

  res.json({ job, employerProfile, applicationCount });
}

// GET /api/jobs/mine — employer's own jobs, with applicant counts and review state.
async function myJobs(req, res) {
  const jobs = await Job.find({ employer: req.user._id })
    .sort({ createdAt: -1 })
    .populate('assignedWorker', 'name ratingAvg ratingCount')
    .lean();

  const jobIds = jobs.map((j) => j._id);
  const [counts, myReviews, bookings] = await Promise.all([
    Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: '$job', total: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] } } } },
    ]),
    Review.find({ job: { $in: jobIds }, reviewer: req.user._id }).select('job rating'),
    // The booked application (if any) for each job, so the dashboard can show
    // "worker says done" and the complete / rate buttons.
    Application.find({ job: { $in: jobIds }, status: { $in: ['accepted', 'in-progress', 'completed'] } })
      .select('job status workerDoneAt'),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c]));
  const reviewMap = new Map(myReviews.map((r) => [String(r.job), r.rating]));
  const bookingMap = new Map(bookings.map((b) => [String(b.job), b]));

  res.json({
    jobs: jobs.map((j) => ({
      ...j,
      applicants: countMap.get(String(j._id))?.total || 0,
      pendingApplicants: countMap.get(String(j._id))?.pending || 0,
      myRating: reviewMap.get(String(j._id)) || null,
      booking: bookingMap.get(String(j._id)) || null,
    })),
  });
}

// POST /api/jobs — employer posts a job. The commission % is copied from config.
async function createJob(req, res) {
  const job = await Job.create({
    ...pick(req.body, EDITABLE_FIELDS),
    employer: req.user._id,
    feePercent: platformFeePercent,
  });
  res.status(201).json({ job });
}

// PUT /api/jobs/:id — edit, only while the job is still open.
async function updateJob(req, res) {
  const job = await findOwnJob(req.params.id, req.user._id);
  if (job.status !== 'open') throw ApiError.badRequest('Only open jobs can be edited.');
  Object.assign(job, pick(req.body, EDITABLE_FIELDS));
  // An edit is a re-post: check the budget against the trade's current minimum.
  job.$locals.recheckWageFloor = true;
  await job.save();
  res.json({ job });
}

// PATCH /api/jobs/:id/close — employer withdraws the job before work starts.
async function closeJob(req, res) {
  const job = await findOwnJob(req.params.id, req.user._id);
  if (!['open', 'assigned'].includes(job.status)) {
    throw ApiError.badRequest('Jobs that are in progress or completed cannot be closed.');
  }
  job.status = 'closed';
  job.closedReason = req.body.reason || 'Closed by employer';
  await job.save();

  await Application.updateMany({ job: job._id, status: 'applied' }, { status: 'rejected' });
  await Application.updateMany({ job: job._id, status: 'accepted' }, { status: 'cancelled', cancelledAt: new Date() });

  res.json({ job });
}

// GET /api/jobs/:id/applications — the employer sees who applied.
async function jobApplications(req, res) {
  const job = await findOwnJob(req.params.id, req.user._id);
  const applications = await Application.find({ job: job._id })
    .sort({ createdAt: 1 })
    .populate('worker', 'name ratingAvg ratingCount phone')
    .lean();

  const profiles = await WorkerProfile.find({ user: { $in: applications.map((a) => a.worker._id) } })
    .select('user trade hourlyRate experienceYears location verified skills')
    .lean();
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));
  const itiMap = await approvedItiByWorker(applications.map((a) => a.worker._id));

  res.json({
    applications: applications.map((a) => {
      // A worker's phone number is shared with the employer only after acceptance.
      const shareContact = ['accepted', 'in-progress', 'completed'].includes(a.status);
      return {
        ...a,
        worker: shareContact ? a.worker : publicUser(a.worker),
        workerProfile: profileMap.get(String(a.worker._id)) || null,
        itiCertificates: itiMap.get(String(a.worker._id)) || [],
      };
    }),
  });
}

// Jobs marked "ITI-certified workers only" need an approved ITI certificate
// for the job's trade. This is on top of the background check, never instead of it.
async function requireItiIfNeeded(job, workerId, who = 'You need') {
  if (!job.itiRequired) return;
  if (await ItiCertificate.exists({ worker: workerId, trade: job.category, status: 'approved' })) return;
  const trade = await Trade.findBySlug(job.category).lean();
  const plural = trade ? trade.plural.toLowerCase() : 'workers';
  throw ApiError.forbidden(`This job is for ITI-certified ${plural} only. ${who} an approved ITI certificate for ${trade?.label || job.category}.`);
}

// POST /api/jobs/:id/apply — verified workers only.
async function applyToJob(req, res) {
  const job = await Job.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found.');
  if (job.status !== 'open') throw ApiError.badRequest('This job is no longer taking applications.');

  const profile = await WorkerProfile.findOne({ user: req.user._id });
  if (!profile) throw ApiError.badRequest('Complete your worker profile first.');
  if (!profile.verified) {
    throw ApiError.forbidden('You need an approved background check before you can apply for jobs.');
  }
  await requireItiIfNeeded(job, req.user._id);

  const existing = await Application.findOne({ job: job._id, worker: req.user._id });
  if (existing) {
    if (existing.status !== 'cancelled') throw ApiError.conflict('You have already applied to this job.');
    // Re-applying after withdrawing reuses the same record (one per job/worker).
    existing.status = 'applied';
    existing.coverNote = req.body.coverNote || '';
    existing.cancelledAt = undefined;
    await existing.save();
    return res.status(201).json({ application: existing });
  }

  const application = await Application.create({
    job: job._id,
    worker: req.user._id,
    employer: job.employer,
    coverNote: req.body.coverNote,
  });
  res.status(201).json({ application });
}

module.exports = { listJobs, getJob, myJobs, createJob, updateJob, closeJob, jobApplications, applyToJob, requireItiIfNeeded };
