// Loads server/.env once and exposes typed config values.
// Every other file reads config from here instead of process.env directly.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const required = ['MONGO_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable ${key}. Copy server/.env.example to server/.env.`);
    process.exit(1);
  }
}

const feePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 5);
if (Number.isNaN(feePercent) || feePercent < 0 || feePercent > 50) {
  console.error('PLATFORM_FEE_PERCENT must be a number between 0 and 50.');
  process.exit(1);
}

const nodeEnv = process.env.NODE_ENV || 'development';

// Login/register attempts allowed per IP per 15 minutes. Production keeps a
// strict default; development allows many more so a demo with three tabs
// logging in and out (all from the same IP) never gets locked out.
function authRateLimitFor(env, value) {
  if (value !== undefined && value !== '') {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) throw new Error('AUTH_RATE_LIMIT must be a whole number of at least 1.');
    return n;
  }
  return env === 'production' ? 50 : 1000;
}

let authRateLimit;
try {
  authRateLimit = authRateLimitFor(nodeEnv, process.env.AUTH_RATE_LIMIT);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// CLIENT_URL may list several origins separated by commas. In development the
// three `npm run dev:demo` ports are always allowed as well.
const DEMO_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
const listedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
const clientUrls = nodeEnv === 'production' ? listedOrigins : [...new Set([...listedOrigins, ...DEMO_ORIGINS])];

module.exports = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv,
  clientUrls,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  platformFeePercent: feePercent,
  authRateLimit,
  authRateLimitFor,
  uploadDir: path.join(__dirname, '..', '..', 'uploads'),
};
