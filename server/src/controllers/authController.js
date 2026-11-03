const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WorkerProfile = require('../models/WorkerProfile');
const EmployerProfile = require('../models/EmployerProfile');
const ApiError = require('../utils/ApiError');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
}

// POST /api/auth/register — workers and employers only. Admins come from the seed script.
async function register(req, res) {
  const { role, name, email, phone, password } = req.body;

  if (await User.exists({ email: email.toLowerCase() })) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const user = await User.create({
    role,
    name,
    email,
    phone,
    passwordHash: await User.hashPassword(password),
  });

  // MongoDB on a single local server has no transactions, so if the profile
  // fails validation we remove the user again to avoid a half-made account.
  try {
    if (role === 'worker') {
      const { trade, hourlyRate, experienceYears, location, skills } = req.body;
      await WorkerProfile.create({ user: user._id, trade, hourlyRate, experienceYears, location, skills });
    } else {
      const { company, location } = req.body;
      await EmployerProfile.create({ user: user._id, company, location });
    }
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  res.status(201).json({ token: signToken(user), user });
}

// POST /api/auth/login — each role logs in through its own page, which sends `role`.
async function login(req, res) {
  const { email, password, role } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  if (!user || !(await user.checkPassword(password))) {
    throw ApiError.unauthorized('Incorrect email or password.');
  }
  if (user.role !== role) {
    const article = /^[aeiou]/.test(user.role) ? 'an' : 'a';
    throw ApiError.forbidden(`This is ${article} ${user.role} account. Please use the ${user.role} login.`);
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been suspended. Contact the SIMSAR admin.');
  }

  res.json({ token: signToken(user), user });
}

// GET /api/auth/me — the logged-in user, used by the React app on page load.
async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };
