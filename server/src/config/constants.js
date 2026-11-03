// Fixed enums used by the models and validators.
// Trades and their fair minimum hourly rates are NOT here: they live in the
// `trades` collection so the admin can change them (see models/Trade.js).

// A trade is referenced everywhere by its slug, e.g. "electrician".
const TRADE_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,29}$/;

const ROLES = ['worker', 'employer', 'admin'];
const JOB_STATUSES = ['open', 'assigned', 'in-progress', 'completed', 'closed'];
const APPLICATION_STATUSES = ['applied', 'accepted', 'rejected', 'in-progress', 'completed', 'cancelled'];
const CHECK_STATUSES = ['pending', 'approved', 'rejected'];
const ID_TYPES = ['aadhaar', 'pan', 'voter-id', 'driving-licence', 'passport'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ITI certificates are issued under the national (NCVT) or a state (SCVT) council.
const COUNCIL_TYPES = ['NCVT', 'SCVT'];
const ITI_FIRST_YEAR = 1960;
// Uploaded certificate scans: type -> allowed file extensions.
const CERTIFICATE_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
};
const CERTIFICATE_MAX_BYTES = 2 * 1024 * 1024;

module.exports = {
  TRADE_SLUG_PATTERN,
  ROLES,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  CHECK_STATUSES,
  ID_TYPES,
  WEEKDAYS,
  COUNCIL_TYPES,
  ITI_FIRST_YEAR,
  CERTIFICATE_FILE_TYPES,
  CERTIFICATE_MAX_BYTES,
};
