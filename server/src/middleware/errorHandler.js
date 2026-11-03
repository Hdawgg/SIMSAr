const mongoose = require('mongoose');
const multer = require('multer');
const { nodeEnv } = require('../config/env');

// Friendly messages for unique-index violations, by the first indexed field.
const DUPLICATE_MESSAGES = {
  email: 'An account with this email already exists.',
  slug: 'A trade with this slug already exists.',
  certificateNumber: 'This ITI certificate has already been submitted on SIMSAR.',
};

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Central error handler. Every thrown error in a route ends up here and is
// turned into one consistent JSON shape: { message, fields? }.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let fields = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    fields = {};
    for (const [path, e] of Object.entries(err.errors)) fields[path.split('.').pop()] = e.message;
    message = Object.values(fields)[0];
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const key = Object.keys(err.keyPattern || {})[0];
    message = DUPLICATE_MESSAGES[key] || 'This record already exists.';
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 2 MB.' : 'Upload one certificate file (JPG, PNG or PDF).';
    fields = { certificateFile: message };
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON.';
  }

  if (status >= 500) {
    console.error(err);
    if (nodeEnv === 'production') message = 'Something went wrong';
  }

  res.status(status).json({ message, ...(fields ? { fields } : {}) });
}

module.exports = { notFound, errorHandler };
