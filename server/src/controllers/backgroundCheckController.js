const BackgroundCheck = require('../models/BackgroundCheck');
const WorkerProfile = require('../models/WorkerProfile');
const ApiError = require('../utils/ApiError');
const { pick } = require('../utils/helpers');

// POST /api/background-checks — a worker submits ID and address details.
async function submitCheck(req, res) {
  const latest = await BackgroundCheck.findOne({ worker: req.user._id }).sort({ createdAt: -1 });
  if (latest?.status === 'pending') throw ApiError.conflict('Your background check is already being reviewed.');
  if (latest?.status === 'approved') throw ApiError.conflict('You are already verified.');

  // A rejected worker may submit again; each attempt is kept as its own record.
  const check = await BackgroundCheck.create({
    ...pick(req.body, ['idType', 'idNumber', 'fullNameOnId', 'dateOfBirth', 'address', 'consent']),
    worker: req.user._id,
  });
  res.status(201).json({ backgroundCheck: check });
}

// GET /api/background-checks/mine — the worker's own submissions, newest first.
async function myChecks(req, res) {
  const checks = await BackgroundCheck.find({ worker: req.user._id }).sort({ createdAt: -1 });
  res.json({ backgroundChecks: checks });
}

// GET /api/admin/background-checks?status=pending
async function listChecks(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const checks = await BackgroundCheck.find(filter)
    .sort({ status: 1, createdAt: 1 })
    .populate('worker', 'name email phone')
    .populate('reviewedBy', 'name');

  const profiles = await WorkerProfile.find({ user: { $in: checks.map((c) => c.worker?._id) } }).select('user trade location');
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

  res.json({
    backgroundChecks: checks.map((c) => ({ ...c.toObject(), workerProfile: profileMap.get(String(c.worker?._id)) || null })),
  });
}

// PATCH /api/admin/background-checks/:id — { status: approved|rejected, reviewerNotes }
// Approving sets the worker's `verified` flag, which unlocks applying for jobs.
async function reviewCheck(req, res) {
  const check = await BackgroundCheck.findById(req.params.id);
  if (!check) throw ApiError.notFound('Background check not found.');
  if (check.status !== 'pending') throw ApiError.badRequest('This check has already been reviewed.');

  check.status = req.body.status;
  check.reviewerNotes = req.body.reviewerNotes || '';
  check.reviewedBy = req.user._id;
  check.reviewedAt = new Date();
  await check.save();

  await WorkerProfile.updateOne({ user: check.worker }, { verified: check.status === 'approved' });

  res.json({ backgroundCheck: check });
}

module.exports = { submitCheck, myChecks, listChecks, reviewCheck };
