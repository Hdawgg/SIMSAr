const User = require('../models/User');
const WorkerProfile = require('../models/WorkerProfile');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Review = require('../models/Review');
const BackgroundCheck = require('../models/BackgroundCheck');
const ItiCertificate = require('../models/ItiCertificate');
const ApiError = require('../utils/ApiError');
const { escapeRegex } = require('../utils/helpers');

// GET /api/admin/stats — numbers for the admin dashboard.
async function stats(_req, res) {
  const [usersByRole, jobsByStatus, ratingAgg, pendingChecks, verifiedWorkers, feeAgg, pendingIti, itiWorkers] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Job.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    BackgroundCheck.countDocuments({ status: 'pending' }),
    WorkerProfile.countDocuments({ verified: true }),
    Job.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, fees: { $sum: '$platformFee' }, payouts: { $sum: '$workerPayout' } } },
    ]),
    ItiCertificate.countDocuments({ status: 'pending' }),
    ItiCertificate.distinct('worker', { status: 'approved' }),
  ]);

  const roles = Object.fromEntries(usersByRole.map((r) => [r._id, r.count]));
  const jobs = Object.fromEntries(jobsByStatus.map((j) => [j._id, j.count]));

  res.json({
    users: {
      total: usersByRole.reduce((sum, r) => sum + r.count, 0),
      workers: roles.worker || 0,
      employers: roles.employer || 0,
      admins: roles.admin || 0,
      verifiedWorkers,
      itiCertifiedWorkers: itiWorkers.length,
    },
    jobs: {
      total: jobsByStatus.reduce((sum, j) => sum + j.count, 0),
      byStatus: jobs,
      completed: jobs.completed || 0,
    },
    reviews: {
      total: ratingAgg[0]?.count || 0,
      averageRating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
    },
    pendingChecks,
    pendingIti,
    money: {
      platformFees: feeAgg[0]?.fees || 0,
      workerPayouts: feeAgg[0]?.payouts || 0,
    },
  });
}

// GET /api/admin/users?role=&q=
async function listUsers(req, res) {
  const { role, q } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  const profiles = await WorkerProfile.find({ user: { $in: users.map((u) => u._id) } }).select('user verified trade').lean();
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));
  const itiTrades = await ItiCertificate.aggregate([
    { $match: { worker: { $in: users.map((u) => u._id) }, status: 'approved' } },
    { $group: { _id: '$worker', trades: { $addToSet: '$trade' } } },
  ]);
  const itiMap = new Map(itiTrades.map((r) => [String(r._id), r.trades]));

  res.json({
    users: users.map(({ passwordHash, __v, ...u }) => ({
      ...u,
      verified: profileMap.get(String(u._id))?.verified ?? null,
      trade: profileMap.get(String(u._id))?.trade ?? null,
      itiTrades: itiMap.get(String(u._id)) || [],
    })),
  });
}

// PATCH /api/admin/users/:id/status — { isActive } suspend or restore an account.
async function setUserStatus(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  if (user.role === 'admin') throw ApiError.badRequest('Admin accounts cannot be suspended here.');
  user.isActive = req.body.isActive;
  await user.save();
  res.json({ user });
}

// GET /api/admin/jobs?status=&q=
async function listAllJobs(req, res) {
  const { status, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');
  const jobs = await Job.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('employer', 'name email')
    .populate('assignedWorker', 'name');
  res.json({ jobs });
}

// PATCH /api/admin/jobs/:id/close — moderation: take a job off the board.
async function moderateCloseJob(req, res) {
  const job = await Job.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found.');
  if (['completed', 'closed'].includes(job.status)) throw ApiError.badRequest(`Job is already ${job.status}.`);
  job.status = 'closed';
  job.closedReason = `Removed by admin: ${req.body.reason}`;
  await job.save();
  await Application.updateMany({ job: job._id, status: 'applied' }, { status: 'rejected' });
  await Application.updateMany(
    { job: job._id, status: { $in: ['accepted', 'in-progress'] } },
    { status: 'cancelled', cancelledAt: new Date() }
  );
  res.json({ job });
}

// DELETE /api/admin/jobs/:id — remove a job that breaks the rules (not completed ones,
// because their reviews belong to the workers' records).
async function deleteJob(req, res) {
  const job = await Job.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found.');
  if (job.status === 'completed') throw ApiError.badRequest('Completed jobs are part of workers\' records and cannot be deleted.');
  await Application.deleteMany({ job: job._id });
  await job.deleteOne();
  res.json({ message: 'Job deleted.' });
}

module.exports = { stats, listUsers, setUserStatus, listAllJobs, moderateCloseJob, deleteJob };
