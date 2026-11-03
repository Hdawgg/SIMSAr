const mongoose = require('mongoose');
const Review = require('../models/Review');
const Job = require('../models/Job');
const ApiError = require('../utils/ApiError');

// POST /api/reviews — { jobId, rating, comment }
// The server works out who is being reviewed: the employer rates the assigned
// worker, the assigned worker rates the employer. Nobody else can review.
async function createReview(req, res) {
  const { jobId, rating, comment } = req.body;
  const job = await Job.findById(jobId);
  if (!job) throw ApiError.notFound('Job not found.');
  if (job.status !== 'completed') throw ApiError.badRequest('You can leave a review only after the job is completed.');

  let reviewee;
  if (job.employer.equals(req.user._id)) reviewee = job.assignedWorker;
  else if (job.assignedWorker?.equals(req.user._id)) reviewee = job.employer;
  else throw ApiError.forbidden('Only the employer and the worker on this job can review it.');

  if (await Review.exists({ job: job._id, reviewer: req.user._id })) {
    throw ApiError.conflict('You have already reviewed this job.');
  }

  const review = await Review.create({
    job: job._id,
    reviewer: req.user._id,
    reviewee,
    reviewerRole: req.user.role,
    rating,
    comment,
  });
  res.status(201).json({ review });
}

// GET /api/reviews/user/:id — every review a user has received.
async function reviewsForUser(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('User not found.');
  const reviews = await Review.find({ reviewee: req.params.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('reviewer', 'name role')
    .populate('job', 'title category');
  res.json({ reviews });
}

module.exports = { createReview, reviewsForUser };
