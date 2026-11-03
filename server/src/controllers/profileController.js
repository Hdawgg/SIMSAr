const mongoose = require('mongoose');
const User = require('../models/User');
const WorkerProfile = require('../models/WorkerProfile');
const EmployerProfile = require('../models/EmployerProfile');
const BackgroundCheck = require('../models/BackgroundCheck');
const Application = require('../models/Application');
const Job = require('../models/Job');
const Review = require('../models/Review');
const ItiCertificate = require('../models/ItiCertificate');
const ApiError = require('../utils/ApiError');
const { escapeRegex, pick, publicUser } = require('../utils/helpers');

const WORKER_FIELDS = ['trade', 'skills', 'experienceYears', 'hourlyRate', 'location', 'pincode', 'bio', 'languages', 'isAvailable', 'availableDays'];
const EMPLOYER_FIELDS = ['company', 'location', 'pincode', 'about'];

function profileModelFor(role) {
  if (role === 'worker') return WorkerProfile;
  if (role === 'employer') return EmployerProfile;
  return null;
}

// GET /api/profile/me
async function getMyProfile(req, res) {
  const Model = profileModelFor(req.user.role);
  const profile = Model ? await Model.findOne({ user: req.user._id }) : null;

  let backgroundCheck = null;
  let itiCertificates = [];
  if (req.user.role === 'worker') {
    [backgroundCheck, itiCertificates] = await Promise.all([
      BackgroundCheck.findOne({ worker: req.user._id }).sort({ createdAt: -1 }),
      ItiCertificate.find({ worker: req.user._id }).sort({ createdAt: -1 }),
    ]);
  }

  res.json({ user: req.user, profile, backgroundCheck, itiCertificates });
}

// PUT /api/profile/me — updates name/phone on the user plus role-specific fields.
async function updateMyProfile(req, res) {
  const user = req.user;
  Object.assign(user, pick(req.body, ['name', 'phone']));
  await user.validate();

  const Model = profileModelFor(user.role);
  if (!Model) throw ApiError.badRequest('Admins do not have a profile.');

  const profile = await Model.findOne({ user: user._id });
  if (!profile) throw ApiError.notFound('Profile not found.');
  const fields = user.role === 'worker' ? WORKER_FIELDS : EMPLOYER_FIELDS;
  Object.assign(profile, pick(req.body, fields));

  // Validate both before saving either, so we never save half an update.
  await profile.validate();
  await user.save();
  await profile.save();

  res.json({ user, profile });
}

// Completed-job stats for a worker: their Work Passport numbers.
async function workerStats(userIds) {
  const rows = await Application.aggregate([
    { $match: { worker: { $in: userIds }, status: 'completed' } },
    { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'job' } },
    { $unwind: '$job' },
    { $group: { _id: '$worker', jobsCompleted: { $sum: 1 }, totalEarned: { $sum: '$job.workerPayout' }, employers: { $addToSet: '$employer' } } },
  ]);
  const map = new Map();
  for (const r of rows) map.set(String(r._id), { jobsCompleted: r.jobsCompleted, totalEarned: r.totalEarned, uniqueEmployers: r.employers.length });
  return map;
}

// GET /api/workers — public worker search.
// Query: trade, location, q (name or skill), verified=true, available=true, iti=true, sort=rating|rate|experience
async function listWorkers(req, res) {
  const { trade, location, q, verified, available, iti, sort = 'rating' } = req.query;

  const match = {};
  if (trade) match.trade = trade;
  if (location) match.location = new RegExp(escapeRegex(location), 'i');
  if (verified === 'true') match.verified = true;
  if (available === 'true') match.isAvailable = true;

  const pipeline = [
    { $match: match },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.isActive': true } },
    // Approved ITI certificates, for the "ITI Certified" badge (no numbers or files).
    {
      $lookup: {
        from: ItiCertificate.collection.name,
        localField: 'user._id',
        foreignField: 'worker',
        pipeline: [{ $match: { status: 'approved' } }, { $project: { trade: 1, councilType: 1, passingYear: 1, instituteName: 1, instituteState: 1 } }],
        as: 'itiCertificates',
      },
    },
  ];
  if (iti === 'true') pipeline.push({ $match: { 'itiCertificates.0': { $exists: true } } });
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    pipeline.push({ $match: { $or: [{ 'user.name': rx }, { skills: rx }, { bio: rx }] } });
  }
  const sorts = {
    rating: { verified: -1, 'user.ratingAvg': -1, 'user.ratingCount': -1 },
    rate: { hourlyRate: 1 },
    experience: { experienceYears: -1 },
  };
  pipeline.push({ $sort: sorts[sort] || sorts.rating }, { $limit: 100 });

  const profiles = await WorkerProfile.aggregate(pipeline);
  const stats = await workerStats(profiles.map((p) => p.user._id));

  res.json({
    workers: profiles.map((p) => ({
      ...p,
      user: publicUser(p.user),
      stats: stats.get(String(p.user._id)) || { jobsCompleted: 0, totalEarned: 0, uniqueEmployers: 0 },
    })),
  });
}

// GET /api/users/:id/profile — public profile of a worker or employer,
// with average rating and recent reviews.
async function getPublicProfile(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('User not found.');
  const user = await User.findById(req.params.id);
  if (!user || user.role === 'admin') throw ApiError.notFound('User not found.');

  const Model = profileModelFor(user.role);
  const profile = await Model.findOne({ user: user._id });

  const reviews = await Review.find({ reviewee: user._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('reviewer', 'name role')
    .populate('job', 'title category');

  let stats;
  let itiCertificates;
  if (user.role === 'worker') {
    const certs = await ItiCertificate.find({ worker: user._id, status: 'approved' }).sort({ passingYear: -1 }).lean();
    itiCertificates = certs.map(ItiCertificate.publicSummary);
    stats = (await workerStats([user._id])).get(String(user._id)) || { jobsCompleted: 0, totalEarned: 0, uniqueEmployers: 0 };
  } else {
    const [jobsPosted, jobsCompleted] = await Promise.all([
      Job.countDocuments({ employer: user._id }),
      Job.countDocuments({ employer: user._id, status: 'completed' }),
    ]);
    stats = { jobsPosted, jobsCompleted };
  }

  res.json({ user: publicUser(user), profile, stats, reviews, ...(itiCertificates ? { itiCertificates } : {}) });
}

module.exports = { getMyProfile, updateMyProfile, listWorkers, getPublicProfile, workerStats };
