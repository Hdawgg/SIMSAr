const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Runs after a list of express-validator checks. If any failed, respond 400
// with a { field: message } map the React forms can show next to each input.
function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const fields = {};
  for (const err of result.array()) {
    if (err.type === 'field' && !fields[err.path]) fields[err.path] = err.msg;
  }
  throw ApiError.badRequest(Object.values(fields)[0] || 'Invalid input', fields);
}

module.exports = validate;
