const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const ItiCertificate = require('../models/ItiCertificate');
const WorkerProfile = require('../models/WorkerProfile');
const Trade = require('../models/Trade');
const ApiError = require('../utils/ApiError');
const { pick } = require('../utils/helpers');
const { uploadDir } = require('../config/env');

const ITI_DIR = path.join(uploadDir, 'iti');
const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' };
const FIELDS = ['trade', 'instituteName', 'instituteState', 'instituteDistrict', 'certificateNumber', 'registrationNumber', 'councilType', 'passingYear', 'grade', 'percentage'];
const ACTIVE = ['pending', 'approved'];

const filePath = (cert) => path.join(ITI_DIR, path.basename(cert.file.storedName));

// POST /api/iti-certificates (multipart) — a worker submits an ITI certificate
// with a scan. Simulated verification: an admin compares the two by hand.
async function submitCertificate(req, res) {
  if (!req.file) {
    throw ApiError.badRequest('Upload a photo or PDF of the certificate.', { certificateFile: 'Upload a photo or PDF of the certificate.' });
  }

  const profile = await WorkerProfile.findOne({ user: req.user._id });
  if (!profile) throw ApiError.badRequest('Complete your worker profile first.');
  const trade = await Trade.findBySlug(profile.trade).lean();

  // A worker has one trade on SIMSAR; the certificate must be for it.
  if (req.body.trade !== profile.trade) {
    const msg = `The certificate's trade must match your trade on SIMSAR (${trade?.label || profile.trade}). Change your trade in My profile first.`;
    throw ApiError.badRequest(msg, { trade: msg });
  }

  if (await ItiCertificate.exists({ worker: req.user._id, trade: profile.trade, status: { $in: ACTIVE } })) {
    throw ApiError.conflict(`You already have an ITI certificate for ${trade?.label || profile.trade} that is pending or approved.`);
  }

  const cert = new ItiCertificate({ ...pick(req.body, FIELDS), worker: req.user._id });
  cert.file = {
    storedName: `${crypto.randomUUID()}${EXTENSIONS[req.file.mimetype]}`,
    originalName: req.file.originalname.slice(-200),
    mimeType: req.file.mimetype,
    size: req.file.size,
  };
  await cert.validate();

  // Clear message for the common case; the unique index is the backstop.
  const claimed = await ItiCertificate.findOne({ certificateNumber: cert.certificateNumber, councilType: cert.councilType, status: { $in: ACTIVE } });
  if (claimed) {
    throw ApiError.conflict(claimed.worker.equals(req.user._id)
      ? 'You have already submitted this ITI certificate.'
      : 'This ITI certificate number is already registered on SIMSAR by another worker.');
  }

  await fs.mkdir(ITI_DIR, { recursive: true });
  await fs.writeFile(filePath(cert), req.file.buffer);
  try {
    await cert.save();
  } catch (err) {
    await fs.unlink(filePath(cert)).catch(() => {});
    throw err;
  }
  res.status(201).json({ itiCertificate: cert });
}

// GET /api/iti-certificates/mine — the worker's own submissions, newest first.
async function myCertificates(req, res) {
  const certificates = await ItiCertificate.find({ worker: req.user._id }).sort({ createdAt: -1 });
  res.json({ itiCertificates: certificates });
}

// GET /api/iti-certificates/:id/file — the scan, for its owner and admins only.
async function certificateFile(req, res) {
  const cert = await ItiCertificate.findById(req.params.id);
  if (!cert) throw ApiError.notFound('Certificate not found.');
  if (req.user.role !== 'admin' && !cert.worker.equals(req.user._id)) {
    throw ApiError.forbidden('Only the worker and SIMSAR admins can see this certificate.');
  }
  res.set({ 'Content-Type': cert.file.mimeType, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' });
  res.sendFile(filePath(cert), (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: 'The certificate file is missing.' });
  });
}

// GET /api/admin/iti-certificates?status=pending
async function listCertificates(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const certificates = await ItiCertificate.find(filter)
    .sort({ status: 1, createdAt: 1 })
    .populate('worker', 'name email phone')
    .populate('reviewedBy', 'name');

  const profiles = await WorkerProfile.find({ user: { $in: certificates.map((c) => c.worker?._id) } }).select('user trade location verified');
  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

  res.json({
    itiCertificates: certificates.map((c) => ({ ...c.toJSON(), workerProfile: profileMap.get(String(c.worker?._id)) || null })),
  });
}

// PATCH /api/admin/iti-certificates/:id — { status: approved|rejected, reviewerNote }
// The note is required when rejecting, so the worker knows what to fix.
async function reviewCertificate(req, res) {
  const cert = await ItiCertificate.findById(req.params.id);
  if (!cert) throw ApiError.notFound('Certificate not found.');
  if (cert.status !== 'pending') throw ApiError.badRequest('This certificate has already been reviewed.');

  cert.status = req.body.status;
  cert.reviewerNote = req.body.reviewerNote || '';
  cert.reviewedBy = req.user._id;
  cert.reviewedAt = new Date();
  await cert.save();
  res.json({ itiCertificate: cert });
}

// Approved ITI trades per worker, for badges on cards and applicant lists.
async function approvedItiByWorker(userIds) {
  const certs = await ItiCertificate.find({ worker: { $in: userIds }, status: 'approved' }).lean();
  const map = new Map();
  for (const c of certs) {
    const key = String(c.worker);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ItiCertificate.publicSummary(c));
  }
  return map;
}

module.exports = { submitCertificate, myCertificates, certificateFile, listCertificates, reviewCertificate, approvedItiByWorker };
