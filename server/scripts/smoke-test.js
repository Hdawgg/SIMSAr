// npm run smoke — end-to-end test of the main flows against the running API.
// Start the server first (npm run dev, or npm start), and seed once (npm run seed).
// Creates throwaway users, walks a job through its whole life, then deletes
// everything it created so the seeded demo data is left untouched (trade
// rates it changes are put back, uploaded test certificates are deleted).
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { mongoUri, uploadDir, authRateLimit, authRateLimitFor } = require('../src/config/env');

const BASE = process.env.API_URL || 'http://localhost:5000/api';
const stamp = Date.now();
const created = { users: [], jobs: [], trades: [], restoreRates: {} };
let passed = 0;
let failed = 0;

// A real 1x1 PNG, for certificate uploads.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// multipart/form-data POST, as the browser sends the ITI certificate form.
async function upload(path, { token, fields = {}, file } = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  if (file) form.append('certificateFile', new Blob([file.bytes], { type: file.type }), file.name);
  const res = await fetch(BASE + path, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function register(body) {
  const res = await call('POST', '/auth/register', { body });
  if (res.data.user?._id) created.users.push(res.data.user._id);
  return res;
}

// Submits and approves a background check so the worker can apply for jobs.
async function verifyWorker(token, adminToken, idNumber) {
  const bc = await call('POST', '/background-checks', {
    token,
    body: { idType: 'aadhaar', idNumber, fullNameOnId: 'Smoke Worker', dateOfBirth: '1990-01-01', address: { line1: '1 Test Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400070' }, consent: true },
  });
  return call('PATCH', `/admin/background-checks/${bc.data.backgroundCheck?._id}`, { token: adminToken, body: { status: 'approved', reviewerNotes: 'Smoke test' } });
}

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`API not reachable at ${BASE}. Start it with "npm run dev" first.`);
    process.exit(1);
  }

  console.log('\nAuth & roles');
  const workerBody = {
    role: 'worker', name: 'Smoke Worker', email: `smoke.worker.${stamp}@test.simsar`, phone: '9876500001',
    password: 'Smoke1234', location: 'Kurla', trade: 'plumber', hourlyRate: 340, experienceYears: 4, skills: ['Leak repair'],
  };
  const lowRate = await call('POST', '/auth/register', { body: { ...workerBody, hourlyRate: 200 } });
  check('worker rate below the fair minimum is rejected', lowRate.status === 400 && /fair minimum/.test(lowRate.data.message), JSON.stringify(lowRate.data));

  const regW = await call('POST', '/auth/register', { body: workerBody });
  check('worker registers', regW.status === 201, JSON.stringify(regW.data));
  check('password hash is never returned', !JSON.stringify(regW.data).includes('passwordHash'));
  const workerToken = regW.data.token;
  const workerId = regW.data.user?._id;
  created.users.push(workerId);

  const regE = await call('POST', '/auth/register', {
    body: { role: 'employer', name: 'Smoke Employer', email: `smoke.employer.${stamp}@test.simsar`, phone: '9876500002', password: 'Smoke1234', location: 'Kurla', company: 'Smoke Co' },
  });
  check('employer registers', regE.status === 201, JSON.stringify(regE.data));
  const employerToken = regE.data.token;
  created.users.push(regE.data.user?._id);

  const regA = await call('POST', '/auth/register', { body: { ...workerBody, role: 'admin', email: `x${stamp}@test.simsar` } });
  check('nobody can register as admin', regA.status === 400);

  const dup = await call('POST', '/auth/register', { body: workerBody });
  check('duplicate email is rejected', dup.status === 409);

  const wrongRole = await call('POST', '/auth/login', { body: { email: workerBody.email, password: 'Smoke1234', role: 'employer' } });
  check('worker cannot use the employer login', wrongRole.status === 403);
  const badPw = await call('POST', '/auth/login', { body: { email: workerBody.email, password: 'wrong-pass1', role: 'worker' } });
  check('wrong password is rejected', badPw.status === 401);
  const adminLogin = await call('POST', '/auth/login', { body: { email: 'admin@simsar.in', password: 'Admin@123', role: 'admin' } });
  check('seeded admin logs in through the admin login', adminLogin.status === 200, '(did you run npm run seed?)');
  const adminToken = adminLogin.data.token;

  check('no token -> 401', (await call('GET', '/jobs/mine')).status === 401);
  check('worker calling an employer route -> 403', (await call('GET', '/jobs/mine', { token: workerToken })).status === 403);
  check('employer calling an admin route -> 403', (await call('GET', '/admin/stats', { token: employerToken })).status === 403);

  console.log('\nTrades and wage rates (stored in MongoDB)');
  const tradeList = await call('GET', '/trades');
  check('public trade list loads from the database', tradeList.status === 200 && tradeList.data.trades?.length >= 7 && tradeList.data.trades.every((t) => t.active && typeof t.minHourlyRate === 'number'));
  const plumber = tradeList.data.trades?.find((t) => t.slug === 'plumber');
  check('plumber minimum is ₹320/hr, as seeded', plumber?.minHourlyRate === 320, '(did you run npm run seed?)');
  const tradeBody = { slug: `smoke-${stamp}`, label: 'Smoke Fitter', plural: 'Smoke Fitters', icon: 'bi-wrench', minHourlyRate: 300, sortOrder: 900 };
  check('no token -> 401 on trade admin', (await call('POST', '/admin/trades', { body: tradeBody })).status === 401);
  check('worker cannot create a trade (403)', (await call('POST', '/admin/trades', { token: workerToken, body: tradeBody })).status === 403);
  check('employer cannot change a rate (403)', (await call('PATCH', `/admin/trades/${plumber?._id}`, { token: employerToken, body: { minHourlyRate: 1 } })).status === 403);
  check('employer cannot delete a trade (403)', (await call('DELETE', `/admin/trades/${plumber?._id}`, { token: employerToken })).status === 403);
  check('worker cannot list trades with usage (403)', (await call('GET', '/admin/trades', { token: workerToken })).status === 403);
  check('negative minimum rate is rejected', (await call('POST', '/admin/trades', { token: adminToken, body: { ...tradeBody, minHourlyRate: -5 } })).status === 400);
  check('badly formed slug is rejected', (await call('POST', '/admin/trades', { token: adminToken, body: { ...tradeBody, slug: 'Bad Slug!' } })).status === 400);
  const newTrade = await call('POST', '/admin/trades', { token: adminToken, body: tradeBody });
  check('admin creates a trade', newTrade.status === 201 && newTrade.data.trade?.slug === tradeBody.slug, JSON.stringify(newTrade.data));
  const tradeId = newTrade.data.trade?._id;
  if (tradeId) created.trades.push(tradeId);
  check('duplicate slug -> 409', (await call('POST', '/admin/trades', { token: adminToken, body: tradeBody })).status === 409);
  const editTrade = await call('PATCH', `/admin/trades/${tradeId}`, { token: adminToken, body: { label: 'Smoke Fitter Pro', minHourlyRate: 310 } });
  check('admin edits name and minimum rate', editTrade.status === 200 && editTrade.data.trade.label === 'Smoke Fitter Pro' && editTrade.data.trade.minHourlyRate === 310);
  check('slug cannot be changed', (await call('PATCH', `/admin/trades/${tradeId}`, { token: adminToken, body: { slug: 'renamed' } })).status === 400);
  check('new trade is offered publicly', (await call('GET', '/trades')).data.trades.some((t) => t._id === tradeId));
  const adminTrades = await call('GET', '/admin/trades', { token: adminToken });
  check('admin trade list shows usage counts', adminTrades.status === 200 && adminTrades.data.trades.find((t) => t.slug === 'plumber')?.usage.workers >= 1);
  await call('PATCH', `/admin/trades/${tradeId}`, { token: adminToken, body: { active: false } });
  check('deactivated trade is hidden from the public list', !(await call('GET', '/trades')).data.trades.some((t) => t._id === tradeId));
  check('...but still returned with ?all=true', (await call('GET', '/trades?all=true')).data.trades.some((t) => t._id === tradeId && !t.active));
  const inactiveReg = await register({ ...workerBody, email: `smoke.inactive.${stamp}@test.simsar`, phone: '9876500005', trade: tradeBody.slug, hourlyRate: 400 });
  check('cannot register in a deactivated trade', inactiveReg.status === 400 && inactiveReg.data.fields?.trade, JSON.stringify(inactiveReg.data));
  const delUnused = await call('DELETE', `/admin/trades/${tradeId}`, { token: adminToken });
  check('unused trade is deleted', delUnused.status === 200 && delUnused.data.deleted === true);
  const usedTrade = await call('POST', '/admin/trades', { token: adminToken, body: { ...tradeBody, slug: `smoke-used-${stamp}` } });
  if (usedTrade.data.trade) created.trades.push(usedTrade.data.trade._id);
  const usedReg = await register({ ...workerBody, email: `smoke.used.${stamp}@test.simsar`, phone: '9876500006', trade: `smoke-used-${stamp}`, hourlyRate: 300 });
  check('worker registers in an admin-created trade', usedReg.status === 201, JSON.stringify(usedReg.data));
  const delUsed = await call('DELETE', `/admin/trades/${usedTrade.data.trade?._id}`, { token: adminToken });
  check('trade in use is deactivated instead of deleted', delUsed.status === 200 && delUsed.data.deleted === false && delUsed.data.trade.active === false, JSON.stringify(delUsed.data));

  console.log('\nPost a job (wage floor + commission)');
  const jobBody = { title: 'Smoke: fix leaking pipe', description: 'Pipe under the sink leaks, needs a new joint.', category: 'plumber', estimatedHours: 2, location: 'Kurla', pincode: '400070' };
  const cheap = await call('POST', '/jobs', { token: employerToken, body: { ...jobBody, budget: 500 } });
  check('budget below the wage floor is rejected', cheap.status === 400 && /fair minimum/i.test(cheap.data.message), JSON.stringify(cheap.data));
  const post = await call('POST', '/jobs', { token: employerToken, body: { ...jobBody, budget: 1000 } });
  check('job is posted', post.status === 201, JSON.stringify(post.data));
  const job = post.data.job;
  created.jobs.push(job?._id);
  check('price breakdown is stored (fee + payout = budget)', job && job.platformFee + job.workerPayout === job.budget && job.platformFee === Math.round(job.budget * job.feePercent / 100));
  const edit = await call('PUT', `/jobs/${job._id}`, { token: employerToken, body: { budget: 1100 } });
  check('employer edits an open job', edit.status === 200 && edit.data.job.budget === 1100);
  const list = await call('GET', '/jobs?category=plumber&location=kurla&minBudget=1000&maxBudget=2000');
  check('job board filters by category, location and budget', list.data.jobs?.some((j) => j._id === job._id));
  check('job stores the trade minimum it was posted under', job.minHourlyRate === 320);

  console.log('\nWage floor reads the current rate from the database');
  const oldJob = await call('POST', '/jobs', { token: employerToken, body: { ...jobBody, title: 'Smoke: posted before the raise', budget: 700 } });
  created.jobs.push(oldJob.data.job?._id);
  check('₹700 for 2 hr is fine at ₹320/hr', oldJob.status === 201, JSON.stringify(oldJob.data));
  created.restoreRates.plumber = plumber.minHourlyRate;
  const raise = await call('PATCH', `/admin/trades/${plumber._id}`, { token: adminToken, body: { minHourlyRate: 400 } });
  check('admin raises the plumber minimum to ₹400/hr', raise.status === 200 && raise.data.trade.minHourlyRate === 400);
  const nowCheap = await call('POST', '/jobs', { token: employerToken, body: { ...jobBody, budget: 700 } });
  check('the same budget is now rejected, naming the trade and the new rate',
    nowCheap.status === 400 && /plumbers/.test(nowCheap.data.message) && /₹400\/hr/.test(nowCheap.data.message), JSON.stringify(nowCheap.data));
  const enough = await call('POST', '/jobs', { token: employerToken, body: { ...jobBody, title: 'Smoke: posted after the raise', budget: 850 } });
  created.jobs.push(enough.data.job?._id);
  check('a budget that clears ₹400/hr is accepted and snapshots the new rate', enough.status === 201 && enough.data.job.minHourlyRate === 400, JSON.stringify(enough.data));
  const lowRate2 = await call('PUT', '/profile/me', { token: workerToken, body: { hourlyRate: 350 } });
  check('worker cannot set a rate below the new minimum', lowRate2.status === 400 && /₹400\/hr/.test(lowRate2.data.message) && /plumbers/.test(lowRate2.data.message), JSON.stringify(lowRate2.data));
  check('worker with an older, lower rate can still toggle availability', (await call('PUT', '/profile/me', { token: workerToken, body: { isAvailable: true } })).status === 200);
  const editOld = await call('PUT', `/jobs/${oldJob.data.job?._id}`, { token: employerToken, body: { title: 'Smoke: edited after the raise' } });
  check('editing the old job re-checks it against the new rate', editOld.status === 400 && /₹400\/hr/.test(editOld.data.message));
  const closeOld = await call('PATCH', `/jobs/${oldJob.data.job?._id}/close`, { token: employerToken, body: {} });
  check('status changes on the old job still work (rate snapshot kept)', closeOld.status === 200 && closeOld.data.job.minHourlyRate === 320, JSON.stringify(closeOld.data));
  const restore = await call('PATCH', `/admin/trades/${plumber._id}`, { token: adminToken, body: { minHourlyRate: created.restoreRates.plumber } });
  if (restore.status === 200) delete created.restoreRates.plumber;
  check('admin restores the plumber minimum', restore.status === 200);

  console.log('\nBackground check gate');
  const early = await call('POST', `/jobs/${job._id}/apply`, { token: workerToken, body: {} });
  check('unverified worker cannot apply', early.status === 403, JSON.stringify(early.data));
  const badId = await call('POST', '/background-checks', { token: workerToken, body: { idType: 'aadhaar', idNumber: '12345', fullNameOnId: 'Smoke Worker', dateOfBirth: '1990-01-01', address: { line1: '1 Test Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400070' }, consent: true } });
  check('invalid ID number is rejected', badId.status === 400);
  const bcBody = { idType: 'aadhaar', idNumber: '987654321098', fullNameOnId: 'Smoke Worker', dateOfBirth: '1990-01-01', address: { line1: '1 Test Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400070' }, consent: true };
  const bc = await call('POST', '/background-checks', { token: workerToken, body: bcBody });
  check('worker submits a background check', bc.status === 201, JSON.stringify(bc.data));
  const again = await call('POST', '/background-checks', { token: workerToken, body: bcBody });
  check('cannot submit twice while pending', again.status === 409);
  const queue = await call('GET', '/admin/background-checks?status=pending', { token: adminToken });
  check('admin sees it in the pending queue', queue.data.backgroundChecks?.some((c) => c._id === bc.data.backgroundCheck._id));
  const noNote = await call('PATCH', `/admin/background-checks/${bc.data.backgroundCheck._id}`, { token: adminToken, body: { status: 'rejected' } });
  check('rejecting requires a reviewer note', noNote.status === 400);
  const approve = await call('PATCH', `/admin/background-checks/${bc.data.backgroundCheck._id}`, { token: adminToken, body: { status: 'approved', reviewerNotes: 'Smoke test' } });
  check('admin approves the check', approve.status === 200);
  const pub = await call('GET', `/users/${workerId}/profile`);
  check('worker profile now shows verified', pub.data.profile?.verified === true);
  check('public profile hides email', !('email' in (pub.data.user || {})));

  console.log('\nApply -> accept -> start -> done -> complete');
  const apply = await call('POST', `/jobs/${job._id}/apply`, { token: workerToken, body: { coverNote: 'Can come tomorrow' } });
  check('verified worker applies', apply.status === 201, JSON.stringify(apply.data));
  const appId = apply.data.application?._id;
  check('cannot apply twice', (await call('POST', `/jobs/${job._id}/apply`, { token: workerToken, body: {} })).status === 409);
  const apps = await call('GET', `/jobs/${job._id}/applications`, { token: employerToken });
  check('employer sees the applicant (phone hidden before hiring)', apps.data.applications?.length === 1 && !apps.data.applications[0].worker.phone);
  check('worker cannot accept their own application', (await call('PATCH', `/applications/${appId}/accept`, { token: workerToken })).status === 403);
  check('cannot complete before starting', (await call('PATCH', `/applications/${appId}/complete`, { token: employerToken })).status === 400);
  const accept = await call('PATCH', `/applications/${appId}/accept`, { token: employerToken });
  check('employer accepts the worker', accept.status === 200 && accept.data.job.status === 'assigned');
  check('employer cannot edit a job once a worker is hired', (await call('PUT', `/jobs/${job._id}`, { token: employerToken, body: { budget: 1200 } })).status === 400);
  const start = await call('PATCH', `/applications/${appId}/start`, { token: workerToken });
  check('worker starts the job', start.status === 200 && start.data.job.status === 'in-progress');
  check('review before completion is refused', (await call('POST', '/reviews', { token: employerToken, body: { jobId: job._id, rating: 5 } })).status === 400);
  const done = await call('PATCH', `/applications/${appId}/done`, { token: workerToken });
  check('worker marks work done', done.status === 200 && done.data.application.workerDoneAt);
  const complete = await call('PATCH', `/applications/${appId}/complete`, { token: employerToken });
  check('employer marks the job complete', complete.status === 200 && complete.data.job.status === 'completed');

  console.log('\nTwo-way rating');
  const r1 = await call('POST', '/reviews', { token: employerToken, body: { jobId: job._id, rating: 4, comment: 'Good work' } });
  check('employer rates the worker', r1.status === 201 && r1.data.review.reviewee === workerId, JSON.stringify(r1.data));
  const r2 = await call('POST', '/reviews', { token: workerToken, body: { jobId: job._id, rating: 5, comment: 'Paid on time' } });
  check('worker rates the employer', r2.status === 201 && r2.data.review.reviewee === regE.data.user._id, JSON.stringify(r2.data));
  check('second review by the same party is refused', (await call('POST', '/reviews', { token: employerToken, body: { jobId: job._id, rating: 1 } })).status === 409);
  const outsider = await call('POST', '/auth/login', { body: { email: 'arjun@simsar.in', password: 'Employer@123', role: 'employer' } });
  check('an unrelated user cannot review the job', (await call('POST', '/reviews', { token: outsider.data.token, body: { jobId: job._id, rating: 1 } })).status === 403);
  check('rating out of range is refused', (await call('POST', '/reviews', { token: workerToken, body: { jobId: job._id, rating: 6 } })).status === 400);
  const wp = await call('GET', `/users/${workerId}/profile`);
  check('worker average rating and reviews show on profile', wp.data.user.ratingAvg === 4 && wp.data.user.ratingCount === 1 && wp.data.reviews.length === 1);
  check('worker Work Passport counts the job and payout', wp.data.stats.jobsCompleted === 1 && wp.data.stats.totalEarned === complete.data.job.workerPayout);
  const ep = await call('GET', `/users/${regE.data.user._id}/profile`);
  check('employer average rating shows on profile', ep.data.user.ratingAvg === 5 && ep.data.reviews.length === 1);

  console.log('\nAdmin');
  const stats = await call('GET', '/admin/stats', { token: adminToken });
  check('admin stats load', stats.status === 200 && stats.data.users.total >= 8 && stats.data.jobs.completed >= 4 && stats.data.reviews.averageRating > 0);
  const users = await call('GET', '/admin/users?role=worker', { token: adminToken });
  check('admin user list has no password hashes', users.status === 200 && !JSON.stringify(users.data).includes('passwordHash'));
  const suspend = await call('PATCH', `/admin/users/${workerId}/status`, { token: adminToken, body: { isActive: false } });
  check('admin suspends a user', suspend.status === 200);
  check('suspended user is blocked', (await call('GET', '/auth/me', { token: workerToken })).status === 403);
  await call('PATCH', `/admin/users/${workerId}/status`, { token: adminToken, body: { isActive: true } });
  const post2 = await call('POST', '/jobs', { token: employerToken, body: { ...jobBody, title: 'Smoke: moderation target', budget: 900 } });
  created.jobs.push(post2.data.job?._id);
  const mod = await call('PATCH', `/admin/jobs/${post2.data.job._id}/close`, { token: adminToken, body: { reason: 'Smoke test moderation' } });
  check('admin removes a job from the board', mod.status === 200 && mod.data.job.status === 'closed');
  check('completed job cannot be deleted', (await call('DELETE', `/admin/jobs/${job._id}`, { token: adminToken })).status === 400);

  console.log('\nITI certificate (simulated check, reviewed by an admin)');
  const reg2 = await register({ ...workerBody, name: 'Smoke Worker Two', email: `smoke.worker2.${stamp}@test.simsar`, phone: '9876500003' });
  const worker2Token = reg2.data.token;
  const pngFile = { bytes: PNG, type: 'image/png', name: 'certificate.png' };
  const itiFields = {
    trade: 'plumber', councilType: 'NCVT', certificateNumber: `R${stamp}`, registrationNumber: `MH${String(stamp).slice(-8)}`,
    instituteName: 'Government ITI Kurla', instituteState: 'Maharashtra', instituteDistrict: 'Mumbai Suburban', passingYear: 2016, percentage: 74,
  };
  const noFile = await upload('/iti-certificates', { token: workerToken, fields: itiFields });
  check('certificate without a file is rejected', noFile.status === 400 && noFile.data.fields?.certificateFile, JSON.stringify(noFile.data));
  const wrongTrade = await upload('/iti-certificates', { token: workerToken, fields: { ...itiFields, trade: 'electrician' }, file: pngFile });
  check("certificate's trade must match the worker's trade", wrongTrade.status === 400 && /must match your trade/.test(wrongTrade.data.message), JSON.stringify(wrongTrade.data));
  check('badly formed certificate number is rejected', (await upload('/iti-certificates', { token: workerToken, fields: { ...itiFields, certificateNumber: 'AB-12' }, file: pngFile })).status === 400);
  check('passing year in the future is rejected', (await upload('/iti-certificates', { token: workerToken, fields: { ...itiFields, passingYear: new Date().getFullYear() + 1 }, file: pngFile })).status === 400);
  check('council other than NCVT/SCVT is rejected', (await upload('/iti-certificates', { token: workerToken, fields: { ...itiFields, councilType: 'XYZ' }, file: pngFile })).status === 400);
  check('a .txt file is rejected', (await upload('/iti-certificates', { token: workerToken, fields: itiFields, file: { bytes: Buffer.from('hello'), type: 'text/plain', name: 'cert.txt' } })).status === 400);
  const fakePng = await upload('/iti-certificates', { token: workerToken, fields: itiFields, file: { bytes: Buffer.from('<html>not an image</html>'), type: 'image/png', name: 'cert.png' } });
  check('a file renamed to .png that is not a PNG is rejected', fakePng.status === 400 && /does not look like/.test(fakePng.data.message), JSON.stringify(fakePng.data));
  const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
  const tooBig = await upload('/iti-certificates', { token: workerToken, fields: itiFields, file: { bytes: big, type: 'image/png', name: 'big.png' } });
  check('a file over 2 MB is rejected', tooBig.status === 400 && /2 MB/.test(tooBig.data.message), JSON.stringify(tooBig.data));
  check('employers cannot submit ITI certificates (403)', (await upload('/iti-certificates', { token: employerToken, fields: itiFields, file: pngFile })).status === 403);
  const iti = await upload('/iti-certificates', { token: workerToken, fields: { ...itiFields, certificateNumber: `r-${stamp}` }, file: pngFile });
  check('worker submits an ITI certificate (number normalised)', iti.status === 201 && iti.data.itiCertificate?.status === 'pending' && iti.data.itiCertificate.certificateNumber === `R${stamp}`, JSON.stringify(iti.data));
  check('stored file name is never sent to the client', iti.data.itiCertificate && !('storedName' in (iti.data.itiCertificate.file || {})));
  const itiId = iti.data.itiCertificate?._id;
  check('second certificate for the same trade while one is pending -> 409', (await upload('/iti-certificates', { token: workerToken, fields: { ...itiFields, certificateNumber: `S${stamp}` }, file: pngFile })).status === 409);
  const dupClaim = await upload('/iti-certificates', { token: worker2Token, fields: itiFields, file: pngFile });
  check('another worker cannot claim the same certificate (duplicate rejected)', dupClaim.status === 409 && /another worker/.test(dupClaim.data.message), JSON.stringify(dupClaim.data));
  const ownFile = await fetch(`${BASE}/iti-certificates/${itiId}/file`, { headers: { Authorization: `Bearer ${workerToken}` } });
  check('owner can open their certificate scan', ownFile.status === 200 && ownFile.headers.get('content-type') === 'image/png');
  check('another worker cannot open it (403)', (await call('GET', `/iti-certificates/${itiId}/file`, { token: worker2Token })).status === 403);
  check('an employer cannot open it (403)', (await call('GET', `/iti-certificates/${itiId}/file`, { token: employerToken })).status === 403);
  check('no token -> 401 on the scan', (await call('GET', `/iti-certificates/${itiId}/file`)).status === 401);
  check('admin can open it', (await fetch(`${BASE}/iti-certificates/${itiId}/file`, { headers: { Authorization: `Bearer ${adminToken}` } })).status === 200);
  const itiQueue = await call('GET', '/admin/iti-certificates?status=pending', { token: adminToken });
  check('admin sees it in the ITI queue', itiQueue.data.itiCertificates?.some((c) => c._id === itiId));
  check('employer cannot see the ITI queue (403)', (await call('GET', '/admin/iti-certificates', { token: employerToken })).status === 403);
  check('rejecting requires a note', (await call('PATCH', `/admin/iti-certificates/${itiId}`, { token: adminToken, body: { status: 'rejected' } })).status === 400);
  const itiReject = await call('PATCH', `/admin/iti-certificates/${itiId}`, { token: adminToken, body: { status: 'rejected', reviewerNote: 'Scan is blurred' } });
  check('admin rejects with a note', itiReject.status === 200 && itiReject.data.itiCertificate.status === 'rejected');
  check('a reviewed certificate cannot be reviewed again', (await call('PATCH', `/admin/iti-certificates/${itiId}`, { token: adminToken, body: { status: 'approved' } })).status === 400);
  const resubmit = await upload('/iti-certificates', { token: workerToken, fields: itiFields, file: pngFile });
  check('worker re-submits the same certificate after rejection', resubmit.status === 201, JSON.stringify(resubmit.data));
  const itiApprove = await call('PATCH', `/admin/iti-certificates/${resubmit.data.itiCertificate?._id}`, { token: adminToken, body: { status: 'approved', reviewerNote: 'Matches the scan' } });
  check('admin approves the re-submission', itiApprove.status === 200 && itiApprove.data.itiCertificate.status === 'approved');
  const mine = await call('GET', '/iti-certificates/mine', { token: workerToken });
  check('worker sees both submissions (history kept)', mine.data.itiCertificates?.length === 2);
  const wpIti = await call('GET', `/users/${workerId}/profile`);
  check('public profile shows the ITI credential without its number',
    wpIti.data.itiCertificates?.some((c) => c.trade === 'plumber' && c.councilType === 'NCVT') && !JSON.stringify(wpIti.data.itiCertificates).includes(String(stamp)));
  check('worker search can filter ITI-certified workers', (await call('GET', '/workers?iti=true&trade=plumber')).data.workers?.some((w) => w.user._id === workerId));

  console.log('\nJob option: ITI-certified workers only');
  check('worker two passes the background check', (await verifyWorker(worker2Token, adminToken, '555566667777')).status === 200);
  const itiJob = await call('POST', '/jobs', { token: employerToken, body: { ...jobBody, title: 'Smoke: ITI-certified plumbers only', budget: 1000, itiRequired: true } });
  created.jobs.push(itiJob.data.job?._id);
  check('employer posts a job that requires ITI', itiJob.status === 201 && itiJob.data.job.itiRequired === true);
  const noIti = await call('POST', `/jobs/${itiJob.data.job?._id}/apply`, { token: worker2Token, body: {} });
  check('verified worker without an ITI cannot apply', noIti.status === 403 && /ITI-certified plumbers only/.test(noIti.data.message), JSON.stringify(noIti.data));
  const withIti = await call('POST', `/jobs/${itiJob.data.job?._id}/apply`, { token: workerToken, body: {} });
  check('worker with an approved ITI for the trade can apply', withIti.status === 201, JSON.stringify(withIti.data));
  const laterJob = await call('POST', '/jobs', { token: employerToken, body: { ...jobBody, title: 'Smoke: ITI added after applying', budget: 1000 } });
  created.jobs.push(laterJob.data.job?._id);
  const lateApp = await call('POST', `/jobs/${laterJob.data.job?._id}/apply`, { token: worker2Token, body: {} });
  check('worker two applies to a job without the ITI rule', lateApp.status === 201);
  await call('PUT', `/jobs/${laterJob.data.job?._id}`, { token: employerToken, body: { itiRequired: true } });
  const lateAccept = await call('PATCH', `/applications/${lateApp.data.application?._id}/accept`, { token: employerToken });
  check('after the employer turns the rule on, that applicant cannot be accepted', lateAccept.status === 403 && /needs an approved ITI/.test(lateAccept.data.message), JSON.stringify(lateAccept.data));

  console.log('\nLogin rate limit');
  check('production default: 50 attempts per 15 min', authRateLimitFor('production') === 50);
  check('development default: 1000 attempts per 15 min', authRateLimitFor('development') === 1000);
  check('AUTH_RATE_LIMIT overrides the default', authRateLimitFor('production', '20') === 20);
  let rejectedZero = false;
  try { authRateLimitFor('production', '0'); } catch { rejectedZero = true; }
  check('AUTH_RATE_LIMIT=0 is refused, so the limiter cannot be switched off', rejectedZero);
  const limited = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@simsar.in', password: 'Admin@123', role: 'admin' }) });
  const policy = limited.headers.get('ratelimit-policy');
  check(`running server limits logins to ${authRateLimit} per 15 min`, policy === `${authRateLimit};w=900`, `(header: ${policy})`);
}

async function cleanup() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const users = created.users.filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));
  const jobs = created.jobs.filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));
  const trades = created.trades.filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));

  // Put back any trade rate the test changed but did not get to restore.
  for (const [slug, rate] of Object.entries(created.restoreRates)) {
    await db.collection('trades').updateOne({ slug }, { $set: { minHourlyRate: rate } });
  }
  const certs = await db.collection('iticertificates').find({ worker: { $in: users } }).toArray();
  for (const c of certs) await fs.unlink(path.join(uploadDir, 'iti', path.basename(c.file.storedName))).catch(() => {});

  await Promise.all([
    db.collection('iticertificates').deleteMany({ worker: { $in: users } }),
    db.collection('trades').deleteMany({ _id: { $in: trades } }),
    db.collection('users').deleteMany({ _id: { $in: users } }),
    db.collection('workerprofiles').deleteMany({ user: { $in: users } }),
    db.collection('employerprofiles').deleteMany({ user: { $in: users } }),
    db.collection('backgroundchecks').deleteMany({ worker: { $in: users } }),
    db.collection('jobs').deleteMany({ _id: { $in: jobs } }),
    db.collection('applications').deleteMany({ job: { $in: jobs } }),
    db.collection('reviews').deleteMany({ job: { $in: jobs } }),
  ]);
  await mongoose.disconnect();
}

main()
  .catch((err) => { failed += 1; console.error('Smoke test crashed:', err); })
  .finally(async () => {
    await cleanup().catch((e) => console.error('Cleanup failed:', e.message));
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
