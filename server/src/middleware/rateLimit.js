const rateLimit = require('express-rate-limit');
const { authRateLimit } = require('../config/env');

// Slows down password guessing on /api/auth/login and /register.
// The limit comes from AUTH_RATE_LIMIT (default 50 in production, 1000 in
// development so a three-tab demo is never locked out). See config/env.js.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: authRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please wait 15 minutes and try again.' },
});

module.exports = { authLimiter };
