// npm run seed — wipes the `simsar` database and fills it with demo data:
// the 7 trades and their fair minimum rates, 1 admin, 4 workers (3 verified,
// 1 pending), 2 employers, ITI certificates (2 approved, 1 pending,
// 1 rejected), jobs in every status, applications and two-way reviews.
// Open MongoDB Compass at mongodb://localhost:27017 to see the `simsar` database afterwards.
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { platformFeePercent, uploadDir } = require('../config/env');
const Trade = require('../models/Trade');
const ItiCertificate = require('../models/ItiCertificate');
const { upsertTrades } = require('./trades');
const { sampleCertificatePdf } = require('./sampleCertificate');
const User = require('../models/User');
const WorkerProfile = require('../models/WorkerProfile');
const EmployerProfile = require('../models/EmployerProfile');
const Job = require('../models/Job');
const Application = require('../models/Application');
const BackgroundCheck = require('../models/BackgroundCheck');
const Review = require('../models/Review');

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n) => daysAgo(-n);

const PASSWORDS = { admin: 'Admin@123', worker: 'Worker@123', employer: 'Employer@123' };

async function makeUser(role, name, email, phone) {
  return User.create({ role, name, email, phone, passwordHash: await User.hashPassword(PASSWORDS[role]) });
}

async function seed() {
  await connectDB();
  if (mongoose.connection.name !== 'simsar') {
    console.error(`Refusing to seed: connected to "${mongoose.connection.name}", expected "simsar".`);
    process.exit(1);
  }

  console.log('Dropping the simsar database...');
  await mongoose.connection.dropDatabase();
  const models = [Trade, User, WorkerProfile, EmployerProfile, Job, Application, BackgroundCheck, ItiCertificate, Review];
  for (const model of models) await model.syncIndexes(); // recreate collections + indexes

  // ---- Trades and their fair minimum hourly rates (same rates as before) ----
  await upsertTrades();

  // ---- Users ----
  const admin = await makeUser('admin', 'SIMSAR Admin', 'admin@simsar.in');

  const rafiq = await makeUser('worker', 'Rafiq Shaikh', 'rafiq@simsar.in', '9820011001');
  const sunita = await makeUser('worker', 'Sunita Pawar', 'sunita@simsar.in', '9820011002');
  const manoj = await makeUser('worker', 'Manoj Yadav', 'manoj@simsar.in', '9820011003');
  const imran = await makeUser('worker', 'Imran Qureshi', 'imran@simsar.in', '9820011004');

  const priya = await makeUser('employer', 'Priya Mehta', 'priya@simsar.in', '9930022001');
  const arjun = await makeUser('employer', 'Arjun Tiwari', 'arjun@simsar.in', '9930022002');

  // ---- Profiles (bios carried over from the original static site) ----
  await WorkerProfile.create([
    {
      user: rafiq._id, trade: 'electrician', hourlyRate: 380, experienceYears: 12, location: 'Andheri West', pincode: '400058',
      skills: ['House wiring', 'Fan & light installation', 'MCB / DB repair', 'Inverter setup'],
      languages: ['Hindi', 'Marathi', 'English'], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      bio: 'Wiring, fan and inverter installs, MCB and distribution board work. I bring my own tester and carry common spare fittings.',
      verified: true,
    },
    {
      user: sunita._id, trade: 'tailor', hourlyRate: 260, experienceYears: 18, location: 'Dadar', pincode: '400014',
      skills: ['Blouse stitching', 'Alterations', 'Bulk uniform orders', 'Home pickup'],
      languages: ['Marathi', 'Hindi'], availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      bio: 'Blouse stitching, alterations and school uniforms in bulk. Free home pickup within 2 km.',
      verified: true,
    },
    {
      user: manoj._id, trade: 'plumber', hourlyRate: 330, experienceYears: 9, location: 'Kurla', pincode: '400070',
      skills: ['Leak repair', 'Tap & flush replacement', 'Bathroom fittings', 'Tank cleaning'],
      languages: ['Hindi', 'Bhojpuri'], availableDays: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      bio: 'Leaks, tap and flush replacement, bathroom fittings and overhead tank cleaning.',
      verified: false,
    },
    {
      user: imran._id, trade: 'carpenter', hourlyRate: 400, experienceYears: 7, location: 'Ghatkopar', pincode: '400077',
      skills: ['Modular kitchen fitting', 'Door & hinge repair', 'Wardrobes', 'Polishing'],
      languages: ['Hindi', 'Urdu', 'Marathi'], availableDays: ['Mon', 'Wed', 'Thu', 'Fri', 'Sat'],
      bio: 'Kitchen cabinets, wardrobes, door repairs and polishing. I bring my own power tools.',
      verified: true,
    },
  ]);

  await EmployerProfile.create([
    { user: priya._id, company: '', location: 'Andheri West', pincode: '400058', about: 'Homeowner. I hire for repairs around a 2BHK flat.' },
    { user: arjun._id, company: 'Sunrise Boys Hostel', location: 'Powai', pincode: '400076', about: 'Warden at a 120-bed student hostel. Regular maintenance work.' },
  ]);

  // ---- Background checks ----
  const address = (line1, city, pincode) => ({ line1, city, state: 'Maharashtra', pincode });
  await BackgroundCheck.create([
    {
      worker: rafiq._id, idType: 'aadhaar', idNumber: '123456789012', fullNameOnId: 'Rafiq Shaikh', dateOfBirth: new Date('1988-04-12'),
      address: address('12, Gilbert Hill Road', 'Mumbai', '400058'), consent: true,
      status: 'approved', reviewerNotes: 'Aadhaar and address match. ITI certificate seen.', reviewedBy: admin._id, reviewedAt: daysAgo(60),
    },
    {
      worker: sunita._id, idType: 'pan', idNumber: 'ABCPP1234K', fullNameOnId: 'Sunita Pawar', dateOfBirth: new Date('1982-09-30'),
      address: address('4, Gokhale Road North', 'Mumbai', '400014'), consent: true,
      status: 'approved', reviewerNotes: 'PAN verified, address confirmed by phone.', reviewedBy: admin._id, reviewedAt: daysAgo(45),
    },
    {
      worker: manoj._id, idType: 'voter-id', idNumber: 'MHK1234567', fullNameOnId: 'Manoj Kumar Yadav', dateOfBirth: new Date('1994-01-05'),
      address: address('Room 7, Jarimari Chawl, LBS Marg', 'Mumbai', '400070'), consent: true,
      status: 'pending',
    },
    {
      worker: imran._id, idType: 'aadhaar', idNumber: '456789012345', fullNameOnId: 'Imran Qureshi', dateOfBirth: new Date('1991-07-22'),
      address: address('B-14, Pant Nagar', 'Mumbai', '400077'), consent: true,
      status: 'approved', reviewerNotes: 'Aadhaar and address match.', reviewedBy: admin._id, reviewedAt: daysAgo(30),
    },
  ]);

  // ---- ITI certificates (simulated: an admin compares the details with the scan) ----
  // Each gets a generated sample PDF in server/uploads/iti/ so the admin has something to open.
  const itiDir = path.join(uploadDir, 'iti');
  await fs.rm(itiDir, { recursive: true, force: true }); // the old files belonged to the dropped database
  await fs.mkdir(itiDir, { recursive: true });
  const tradeLabels = Object.fromEntries((await Trade.find().lean()).map((t) => [t.slug, t.label]));
  const itiSeeds = [
    {
      worker: rafiq, trade: 'electrician', councilType: 'NCVT', certificateNumber: 'R100627014869', registrationNumber: 'MH0627ITI2008',
      instituteName: 'Government ITI Andheri', instituteState: 'Maharashtra', instituteDistrict: 'Mumbai Suburban', passingYear: 2010, percentage: 78,
      status: 'approved', reviewerNote: 'Name, trade and number match the scan.', reviewedBy: admin._id, reviewedAt: daysAgo(58),
    },
    {
      worker: sunita, trade: 'tailor', councilType: 'SCVT', certificateNumber: 'MHSCVT2004118823',
      instituteName: 'Government ITI (Women) Dadar', instituteState: 'Maharashtra', instituteDistrict: 'Mumbai City', passingYear: 2005, grade: 'First class',
      status: 'approved', reviewerNote: 'Sewing Technology certificate, details match.', reviewedBy: admin._id, reviewedAt: daysAgo(40),
    },
    {
      worker: manoj, trade: 'plumber', councilType: 'NCVT', certificateNumber: 'R150727033412',
      instituteName: 'Government ITI Kurla', instituteState: 'Maharashtra', instituteDistrict: 'Mumbai Suburban', passingYear: 2015, percentage: 71,
      status: 'pending',
    },
    {
      worker: imran, trade: 'carpenter', councilType: 'NCVT', certificateNumber: 'R170827050077',
      instituteName: 'Government ITI Ghatkopar', instituteState: 'Maharashtra', instituteDistrict: 'Mumbai Suburban', passingYear: 2017,
      status: 'rejected', reviewerNote: 'The certificate number on the scan does not match the number entered. Please check and re-submit.',
      reviewedBy: admin._id, reviewedAt: daysAgo(3),
    },
  ];
  for (const { worker, ...cert } of itiSeeds) {
    const storedName = `seed-${cert.trade}-${worker.email.split('@')[0]}.pdf`;
    const pdf = sampleCertificatePdf({ ...cert, tradeLabel: tradeLabels[cert.trade] }, worker.name);
    await fs.writeFile(path.join(itiDir, storedName), pdf);
    await ItiCertificate.create({
      ...cert,
      worker: worker._id,
      file: { storedName, originalName: `${cert.trade}-certificate.pdf`, mimeType: 'application/pdf', size: pdf.length },
    });
  }

  // ---- Jobs ----
  const job = (data) => ({ feePercent: platformFeePercent, ...data });
  // Job.create runs the pre('validate') hook, which reads each trade's minimum
  // rate from the trades collection and stores it on the job as a snapshot.
  const [fanJob, uniformJob, mcbJob, wallLightJob, blouseJob] = await Job.create([
    job({
      employer: priya._id, title: 'Replace ceiling fan and regulator', category: 'electrician', budget: 900, estimatedHours: 2,
      description: 'Bedroom ceiling fan hums and the regulator is broken. Replace both; I have bought the new fan.',
      location: 'Andheri West', pincode: '400058', scheduledFor: daysAgo(20),
      status: 'completed', assignedWorker: rafiq._id, completedAt: daysAgo(20),
    }),
    job({
      employer: arjun._id, title: 'Stitch name labels on 40 hostel uniforms', category: 'tailor', budget: 1200, estimatedHours: 4,
      description: 'Sew name labels (provided) onto 40 uniform shirts before the new term. Pickup and drop at the hostel office.',
      location: 'Powai', pincode: '400076', scheduledFor: daysAgo(14),
      status: 'completed', assignedWorker: sunita._id, completedAt: daysAgo(12),
    }),
    job({
      employer: arjun._id, title: 'Fix tripping MCB on 2nd floor', category: 'electrician', budget: 1400, estimatedHours: 3,
      description: 'The MCB for the second-floor corridor trips every evening. Find the fault and replace the DB if needed.',
      location: 'Powai', pincode: '400076', scheduledFor: daysAgo(6),
      status: 'completed', assignedWorker: rafiq._id, completedAt: daysAgo(5),
    }),
    job({
      employer: priya._id, title: 'Install 4 wall lights in living room', category: 'electrician', budget: 1300, estimatedHours: 3,
      description: 'Four wall lights to be fixed on the living room wall. Wiring points already exist; need concealed connections.',
      location: 'Andheri West', pincode: '400058', scheduledFor: daysAgo(1),
      status: 'in-progress', assignedWorker: rafiq._id,
    }),
    job({
      employer: priya._id, title: 'Blouse stitching and three alterations', category: 'tailor', budget: 1000, estimatedHours: 3,
      description: 'Stitch one blouse from my fabric and alter three kurtas (take in at the waist). Measurements will be shared.',
      location: 'Andheri West', pincode: '400058', scheduledFor: daysAhead(4),
    }),
  ]);

  await Job.create([
    job({
      employer: priya._id, title: 'Kitchen sink leaking under the counter', category: 'plumber', budget: 800, estimatedHours: 2,
      description: 'Water drips from the trap under the kitchen sink. Probably needs a new washer or trap.',
      location: 'Andheri West', pincode: '400058', scheduledFor: daysAhead(2),
    }),
    job({
      employer: arjun._id, title: 'Repaint hostel common room', category: 'painter', budget: 3500, estimatedHours: 10,
      description: 'Common room, about 300 sq ft. Two coats of interior emulsion, paint will be provided. Furniture must be covered.',
      location: 'Powai', pincode: '400076', scheduledFor: daysAhead(10),
    }),
    job({
      employer: arjun._id, title: 'Service 6 split ACs before summer', category: 'ac', budget: 3000, estimatedHours: 6,
      description: 'Wet service of six 1.5-ton split ACs in the study rooms. Gas top-up quoted separately if needed.',
      location: 'Powai', pincode: '400076', scheduledFor: daysAhead(7),
    }),
    job({
      employer: arjun._id, title: 'Bathroom tap and flush replacement', category: 'plumber', budget: 1200, estimatedHours: 3,
      description: 'Replace two leaking taps and one flush valve in the ground-floor bathroom. Parts will be bought on the day.',
      location: 'Powai', pincode: '400076', scheduledFor: daysAhead(5),
    }),
    job({
      employer: priya._id, title: 'Rewire the kitchen and add two power points', category: 'electrician', budget: 3000, estimatedHours: 6,
      description: 'Old aluminium wiring in the kitchen to be replaced with copper, plus two new 16A points for the oven and fridge. ITI-certified electricians only, please.',
      location: 'Andheri West', pincode: '400058', scheduledFor: daysAhead(6), itiRequired: true,
    }),
    job({
      employer: arjun._id, title: 'Replace the hostel kitchen wash-basin pipes', category: 'plumber', budget: 2200, estimatedHours: 5,
      description: 'Corroded GI pipes under three wash basins in the hostel kitchen need replacing with CPVC. Looking for an ITI-certified plumber.',
      location: 'Powai', pincode: '400076', scheduledFor: daysAhead(8), itiRequired: true,
    }),
    job({
      employer: priya._id, title: 'Build a small garden wall', category: 'mason', budget: 2500, estimatedHours: 7,
      description: 'Low brick wall (about 2 ft high, 10 ft long) around the building garden patch.',
      location: 'Andheri West', status: 'closed', closedReason: 'Closed by employer: society decided to do it later',
    }),
  ]);

  // ---- Applications (the bookings) ----
  await Application.create([
    { job: fanJob._id, worker: rafiq._id, employer: priya._id, status: 'completed', coverNote: 'I can do it Saturday morning.', acceptedAt: daysAgo(22), startedAt: daysAgo(20), workerDoneAt: daysAgo(20), completedAt: daysAgo(20) },
    { job: uniformJob._id, worker: sunita._id, employer: arjun._id, status: 'completed', coverNote: 'Done this for schools before.', acceptedAt: daysAgo(16), startedAt: daysAgo(14), workerDoneAt: daysAgo(12), completedAt: daysAgo(12) },
    { job: mcbJob._id, worker: rafiq._id, employer: arjun._id, status: 'completed', acceptedAt: daysAgo(7), startedAt: daysAgo(6), workerDoneAt: daysAgo(5), completedAt: daysAgo(5) },
    { job: wallLightJob._id, worker: rafiq._id, employer: priya._id, status: 'in-progress', coverNote: 'I have done concealed wiring for these fittings before.', acceptedAt: daysAgo(2), startedAt: daysAgo(1) },
    { job: blouseJob._id, worker: sunita._id, employer: priya._id, status: 'applied', coverNote: 'I can pick up the fabric on Monday.' },
  ]);

  // ---- Reviews: both directions on two jobs, one direction on the third ----
  // (created one at a time so the post-save hook updates each user's average)
  const reviews = [
    { job: fanJob._id, reviewer: priya._id, reviewee: rafiq._id, reviewerRole: 'employer', rating: 5, comment: 'Found the loose connection the last electrician missed, explained the fix and labelled the board.' },
    { job: fanJob._id, reviewer: rafiq._id, reviewee: priya._id, reviewerRole: 'worker', rating: 5, comment: 'Clear instructions, fan was ready, paid the same day.' },
    { job: uniformJob._id, reviewer: arjun._id, reviewee: sunita._id, reviewerRole: 'employer', rating: 4, comment: 'Neat stitching on all 40. Pickup was a day late but she told us in advance.' },
    { job: uniformJob._id, reviewer: sunita._id, reviewee: arjun._id, reviewerRole: 'worker', rating: 4, comment: 'Labels were well organised. Office was closed at drop-off time once.' },
    { job: mcbJob._id, reviewer: arjun._id, reviewee: rafiq._id, reviewerRole: 'employer', rating: 5, comment: 'On time and the final amount was exactly what the app showed.' },
  ];
  for (const r of reviews) await Review.create(r);

  const counts = await Promise.all(models.map(async (m) => `${m.collection.name}: ${await m.countDocuments()}`));
  console.log('Seeded:', counts.join(', '));
  console.log('\nLogin credentials');
  console.log(`  Admin     admin@simsar.in   / ${PASSWORDS.admin}`);
  console.log(`  Workers   rafiq@simsar.in, sunita@simsar.in, imran@simsar.in (verified), manoj@simsar.in (pending)  / ${PASSWORDS.worker}`);
  console.log(`  Employers priya@simsar.in, arjun@simsar.in  / ${PASSWORDS.employer}`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err.message);
  if (err.errors) for (const e of Object.values(err.errors)) console.error(' -', e.message);
  await mongoose.disconnect();
  process.exit(1);
});
