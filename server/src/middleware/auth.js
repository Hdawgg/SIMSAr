const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { jwtSecret } = require('../config/env');

// Reads "Authorization: Bearer <token>", verifies it and loads the user.
async function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  const user = await User.findById(payload.id);
  if (!user) throw ApiError.unauthorized('Account no longer exists.');
  if (!user.isActive) throw ApiError.forbidden('This account has been suspended. Contact the SIMSAR admin.');

  req.user = user;
  next();
}

// Role guard, used after protect: authorize('employer'), authorize('admin') ...
function authorize(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`Only ${roles.join(' / ')} accounts can do this.`);
    }
    next();
  };
}

module.exports = { protect, authorize };
