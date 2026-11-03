const Trade = require('../models/Trade');
const WorkerProfile = require('../models/WorkerProfile');
const Job = require('../models/Job');
const ItiCertificate = require('../models/ItiCertificate');
const ApiError = require('../utils/ApiError');
const { pick } = require('../utils/helpers');

const EDITABLE_FIELDS = ['label', 'plural', 'icon', 'minHourlyRate', 'description', 'active', 'sortOrder'];
const SORT = { sortOrder: 1, label: 1 };

// GET /api/trades — active trades for dropdowns, filters and the home page.
// ?all=true also returns inactive ones, so old jobs and workers in a trade
// that was switched off can still show its name and icon.
async function listTrades(req, res) {
  const filter = req.query.all === 'true' ? {} : { active: true };
  const trades = await Trade.find(filter).sort(SORT);
  res.json({ trades });
}

// How many records point at each trade, keyed by slug.
async function usageBySlug() {
  const [workers, jobs, certificates] = await Promise.all([
    WorkerProfile.aggregate([{ $group: { _id: '$trade', count: { $sum: 1 }, rates: { $push: '$hourlyRate' } } }]),
    Job.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    ItiCertificate.aggregate([{ $group: { _id: '$trade', count: { $sum: 1 } } }]),
  ]);
  const usage = {};
  const entry = (slug) => (usage[slug] ||= { workers: 0, jobs: 0, itiCertificates: 0, rates: [] });
  for (const w of workers) Object.assign(entry(w._id), { workers: w.count, rates: w.rates });
  for (const j of jobs) entry(j._id).jobs = j.count;
  for (const c of certificates) entry(c._id).itiCertificates = c.count;
  return usage;
}

// GET /api/admin/trades — every trade with how often it is used, and how many
// workers currently advertise a rate below its minimum (e.g. after a raise).
async function adminListTrades(_req, res) {
  const [trades, usage] = await Promise.all([Trade.find().sort(SORT).lean(), usageBySlug()]);
  res.json({
    trades: trades.map((t) => {
      const u = usage[t.slug] || { workers: 0, jobs: 0, itiCertificates: 0, rates: [] };
      return {
        ...t,
        usage: {
          workers: u.workers,
          jobs: u.jobs,
          itiCertificates: u.itiCertificates,
          workersBelowMinimum: u.rates.filter((r) => r < t.minHourlyRate).length,
        },
      };
    }),
  });
}

// POST /api/admin/trades
async function createTrade(req, res) {
  const trade = await Trade.create({ slug: req.body.slug, ...pick(req.body, EDITABLE_FIELDS) });
  res.status(201).json({ trade });
}

// PATCH /api/admin/trades/:id — the slug can't be changed, everything else can.
// A new minimum applies to jobs posted (or edited) from now on; existing jobs
// keep the minimum they were posted with.
async function updateTrade(req, res) {
  const trade = await Trade.findById(req.params.id);
  if (!trade) throw ApiError.notFound('Trade not found.');
  Object.assign(trade, pick(req.body, EDITABLE_FIELDS));
  await trade.save();
  res.json({ trade });
}

// DELETE /api/admin/trades/:id — a trade nobody uses is deleted. A trade that
// workers, jobs or certificates point at is deactivated instead, so their
// records keep a valid trade.
async function deleteTrade(req, res) {
  const trade = await Trade.findById(req.params.id);
  if (!trade) throw ApiError.notFound('Trade not found.');

  const [workers, jobs, certificates] = await Promise.all([
    WorkerProfile.countDocuments({ trade: trade.slug }),
    Job.countDocuments({ category: trade.slug }),
    ItiCertificate.countDocuments({ trade: trade.slug }),
  ]);
  if (workers + jobs + certificates === 0) {
    await trade.deleteOne();
    return res.json({ deleted: true, message: `${trade.label} deleted.` });
  }

  trade.active = false;
  await trade.save();
  res.json({
    deleted: false,
    trade,
    message: `${trade.label} is used by ${workers} worker(s), ${jobs} job(s) and ${certificates} ITI certificate(s), so it was deactivated instead of deleted.`,
  });
}

module.exports = { listTrades, adminListTrades, createTrade, updateTrade, deleteTrade };
