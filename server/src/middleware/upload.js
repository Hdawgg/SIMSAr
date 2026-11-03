const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { CERTIFICATE_FILE_TYPES, CERTIFICATE_MAX_BYTES } = require('../config/constants');

// The first bytes of each allowed file type. Checking them means a renamed
// .exe or .html can't be uploaded just by calling it "photo.png".
const SIGNATURES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
};

function matchesSignature(buffer, mimeType) {
  const sig = SIGNATURES[mimeType];
  return Boolean(sig) && sig.every((byte, i) => buffer[i] === byte);
}

const fileError = (msg) => ApiError.badRequest(msg, { certificateFile: msg });

// The file is kept in memory (max 2 MB) and only written to disk by the
// controller once the certificate details have passed validation.
const multerSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CERTIFICATE_MAX_BYTES, files: 1, fields: 20 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (CERTIFICATE_FILE_TYPES[file.mimetype]?.includes(ext)) cb(null, true);
    else cb(fileError('The certificate must be a JPG, PNG or PDF file.'));
  },
}).single('certificateFile');

function checkSignature(req, _res, next) {
  if (req.file && !matchesSignature(req.file.buffer, req.file.mimetype)) {
    throw fileError('The file content does not look like a real JPG, PNG or PDF.');
  }
  next();
}

const certificateUpload = [multerSingle, checkSignature];

module.exports = { certificateUpload };
