// Request validation rules (express-validator). Each export is an array of
// checks that runs before the controller; `validate` turns failures into a 400.
const { body, param, query } = require('express-validator');
const {
  TRADE_SLUG_PATTERN, JOB_STATUSES, CHECK_STATUSES, ID_TYPES, WEEKDAYS, ROLES, COUNCIL_TYPES, ITI_FIRST_YEAR,
} = require('../config/constants');

const mongoId = (name = 'id') => param(name).isMongoId().withMessage('Invalid id');

// Trades live in the database, so here we only check the slug's shape. The
// models then check that the trade exists and is active (models/Job.js,
// models/WorkerProfile.js), using the current list from MongoDB.
const tradeSlug = (chain, message) => chain.trim().toLowerCase().matches(TRADE_SLUG_PATTERN).withMessage(message);

// Same rule as the ItiCertificate model: upper case, no spaces, slashes or hyphens.
const normaliseNumber = (v) => String(v ?? '').toUpperCase().replace(/[\s/-]/g, '');

const password = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/[A-Za-z]/).withMessage('Password must contain a letter')
  .matches(/\d/).withMessage('Password must contain a number');

const register = [
  body('role').isIn(['worker', 'employer']).withMessage('You can register as a worker or an employer'),
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name'),
  body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
  body('phone').trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a 10-digit mobile number'),
  password,
  body('location').trim().isLength({ min: 2, max: 80 }).withMessage('Enter your area or city'),
  tradeSlug(body('trade').if(body('role').equals('worker')), 'Choose your trade'),
  body('hourlyRate').if(body('role').equals('worker')).isFloat({ min: 1 }).withMessage('Enter your hourly rate').toFloat(),
  body('experienceYears').optional({ values: 'falsy' }).isInt({ min: 0, max: 60 }).withMessage('Experience must be 0–60 years').toInt(),
  body('skills').optional().isArray({ max: 15 }).withMessage('Skills must be a list'),
  body('company').optional().trim().isLength({ max: 100 }),
];

const login = [
  body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('Enter your password'),
  body('role').isIn(ROLES).withMessage('Unknown login type'),
];

const updateProfile = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Enter your full name'),
  body('phone').optional().trim().matches(/^[6-9]\d{9}$/).withMessage('Enter a 10-digit mobile number'),
  tradeSlug(body('trade').optional(), 'Choose a valid trade'),
  body('hourlyRate').optional().isFloat({ min: 1 }).withMessage('Enter a valid hourly rate').toFloat(),
  body('experienceYears').optional().isInt({ min: 0, max: 60 }).withMessage('Experience must be 0–60 years').toInt(),
  body('location').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Enter your area or city'),
  body('pincode').optional({ values: 'falsy' }).matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('skills').optional().isArray({ max: 15 }).withMessage('At most 15 skills'),
  body('languages').optional().isArray({ max: 10 }),
  body('availableDays').optional().isArray(),
  body('availableDays.*').optional().isIn(WEEKDAYS),
  body('isAvailable').optional().isBoolean().toBoolean(),
  body('bio').optional().trim().isLength({ max: 600 }),
  body('about').optional().trim().isLength({ max: 600 }),
  body('company').optional().trim().isLength({ max: 100 }),
];

const jobFields = (optional) => {
  const f = (chain) => (optional ? chain.optional() : chain);
  return [
    f(body('title')).trim().isLength({ min: 5, max: 100 }).withMessage('Title must be 5–100 characters'),
    f(body('description')).trim().isLength({ min: 15, max: 2000 }).withMessage('Describe the job in at least 15 characters'),
    tradeSlug(f(body('category')), 'Choose a trade'),
    f(body('budget')).isFloat({ min: 1 }).withMessage('Enter a budget in rupees').toFloat(),
    f(body('estimatedHours')).isInt({ min: 1, max: 200 }).withMessage('Estimated hours must be 1–200').toInt(),
    f(body('location')).trim().isLength({ min: 2, max: 80 }).withMessage('Enter the job location'),
    body('pincode').optional({ values: 'falsy' }).matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
    body('scheduledFor').optional({ values: 'falsy' }).isISO8601().withMessage('Enter a valid date').toDate(),
    body('itiRequired').optional().isBoolean().withMessage('itiRequired must be true or false').toBoolean(),
  ];
};

const listJobs = [
  tradeSlug(query('category').optional({ values: 'falsy' }), 'Unknown category'),
  query('status').optional({ values: 'falsy' }).isIn(JOB_STATUSES).withMessage('Unknown status'),
  query('minBudget').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('minBudget must be a number'),
  query('maxBudget').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('maxBudget must be a number'),
];

const backgroundCheck = [
  body('idType').isIn(ID_TYPES).withMessage('Choose an ID type'),
  body('idNumber').trim().toUpperCase().isLength({ min: 6, max: 20 }).withMessage('Enter the ID number'),
  body('fullNameOnId').trim().isLength({ min: 2, max: 80 }).withMessage('Enter your name as printed on the ID'),
  body('dateOfBirth').isISO8601().withMessage('Enter your date of birth').toDate(),
  body('address.line1').trim().isLength({ min: 5, max: 200 }).withMessage('Enter your street address'),
  body('address.city').trim().isLength({ min: 2, max: 60 }).withMessage('Enter your city'),
  body('address.state').trim().isLength({ min: 2, max: 60 }).withMessage('Enter your state'),
  body('address.pincode').matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('consent').equals('true').withMessage('You must agree to the background check').toBoolean(),
];

const reviewCheck = [
  mongoId(),
  body('status').isIn(CHECK_STATUSES.filter((s) => s !== 'pending')).withMessage('Status must be approved or rejected'),
  body('reviewerNotes').optional().trim().isLength({ max: 500 }),
  body('reviewerNotes')
    .if(body('status').equals('rejected'))
    .trim().notEmpty().withMessage('Add a note telling the worker why the check was rejected'),
];

// ITI certificate form fields arrive as multipart text (see middleware/upload.js).
const itiCertificate = [
  tradeSlug(body('trade'), 'Choose the trade on the certificate'),
  body('councilType').trim().toUpperCase().isIn(COUNCIL_TYPES).withMessage('Choose NCVT or SCVT'),
  body('certificateNumber').customSanitizer(normaliseNumber)
    .matches(/^(?=.*\d)[A-Z0-9]{8,20}$/).withMessage('Certificate number must be 8–20 letters and digits, with at least one digit'),
  body('registrationNumber').optional({ values: 'falsy' }).customSanitizer(normaliseNumber)
    .matches(/^[A-Z0-9]{6,20}$/).withMessage('Registration number must be 6–20 letters and digits'),
  body('instituteName').trim().isLength({ min: 3, max: 120 }).withMessage('Enter the institute (ITI) name'),
  body('instituteState').trim().isLength({ min: 2, max: 60 }).withMessage('Enter the state of the institute'),
  body('instituteDistrict').trim().isLength({ min: 2, max: 60 }).withMessage('Enter the district of the institute'),
  body('passingYear')
    .custom((v) => Number.isInteger(Number(v)) && Number(v) >= ITI_FIRST_YEAR && Number(v) <= new Date().getFullYear())
    .withMessage(`Passing year must be between ${ITI_FIRST_YEAR} and this year`).toInt(),
  body('grade').optional({ values: 'falsy' }).trim().isLength({ max: 20 }).withMessage('Grade must be under 20 characters'),
  body('percentage').optional({ values: 'falsy' }).isFloat({ min: 0, max: 100 }).withMessage('Percentage must be 0–100').toFloat(),
];

const reviewIti = [
  mongoId(),
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  body('reviewerNote').optional().trim().isLength({ max: 500 }),
  body('reviewerNote')
    .if(body('status').equals('rejected'))
    .trim().notEmpty().withMessage('Add a note telling the worker why the certificate was rejected'),
];

// Admin trade management. The slug is set once, on create.
const tradeFields = (optional) => {
  const f = (chain) => (optional ? chain.optional() : chain);
  return [
    f(body('label')).trim().isLength({ min: 2, max: 40 }).withMessage('Name must be 2–40 characters'),
    f(body('plural')).trim().isLength({ min: 2, max: 40 }).withMessage('Plural name must be 2–40 characters'),
    f(body('minHourlyRate')).isFloat({ min: 0, max: 100000 }).withMessage('Minimum hourly rate must be a number from 0').toFloat(),
    body('icon').optional({ values: 'falsy' }).trim().matches(/^bi-[a-z0-9-]+$/).withMessage('Icon must be a Bootstrap Icons class, e.g. bi-tools'),
    body('description').optional().trim().isLength({ max: 300 }).withMessage('Description must be under 300 characters'),
    body('active').optional().isBoolean().withMessage('active must be true or false').toBoolean(),
    body('sortOrder').optional().isInt({ min: 0, max: 999 }).withMessage('Sort order must be 0–999').toInt(),
  ];
};

const createTrade = [
  body('slug').trim().toLowerCase().matches(TRADE_SLUG_PATTERN).withMessage('Slug must be 2–30 lowercase letters, digits or hyphens, starting with a letter'),
  ...tradeFields(false),
];

const updateTrade = [
  mongoId(),
  body('slug').not().exists().withMessage('The slug of a trade cannot be changed'),
  ...tradeFields(true),
];

const review = [
  body('jobId').isMongoId().withMessage('Invalid job'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Choose 1 to 5 stars').toInt(),
  body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment must be under 500 characters'),
];

module.exports = {
  mongoId,
  register,
  login,
  updateProfile,
  createJob: jobFields(false),
  updateJob: [mongoId(), ...jobFields(true)],
  listJobs,
  apply: [mongoId(), body('coverNote').optional().trim().isLength({ max: 500 }).withMessage('Note must be under 500 characters')],
  backgroundCheck,
  reviewCheck,
  itiCertificate,
  reviewIti,
  createTrade,
  updateTrade,
  review,
  userStatus: [mongoId(), body('isActive').isBoolean().withMessage('isActive must be true or false').toBoolean()],
  closeReason: [mongoId(), body('reason').trim().isLength({ min: 3, max: 200 }).withMessage('Give a reason (3–200 characters)')],
  optionalReason: [mongoId(), body('reason').optional().trim().isLength({ max: 200 })],
};
