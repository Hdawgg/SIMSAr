const mongoose = require('mongoose');

// Two-way rating. After a job is completed the employer reviews the worker
// and the worker reviews the employer — two documents for the same job.
const reviewSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewerRole: { type: String, enum: ['worker', 'employer'], required: true },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be 1 to 5'],
      max: [5, 'Rating must be 1 to 5'],
      validate: [Number.isInteger, 'Rating must be a whole number'],
    },
    comment: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

// One review per party per job — enforced by the database, not just the UI.
reviewSchema.index({ job: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ reviewee: 1, createdAt: -1 });

// Recalculate the reviewee's cached average after every new review.
reviewSchema.statics.refreshUserRating = async function (userId) {
  const [stats] = await this.aggregate([
    { $match: { reviewee: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: '$reviewee', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await mongoose.model('User').updateOne(
    { _id: userId },
    { ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0, ratingCount: stats ? stats.count : 0 }
  );
};

reviewSchema.post('save', async function () {
  await this.constructor.refreshUserRating(this.reviewee);
});

module.exports = mongoose.model('Review', reviewSchema);
