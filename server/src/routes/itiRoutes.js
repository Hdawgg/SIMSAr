const router = require('express').Router();
const ctrl = require('../controllers/itiController');
const { protect, authorize } = require('../middleware/auth');
const { certificateUpload } = require('../middleware/upload');
const validate = require('../middleware/validate');
const v = require('../validators');

const worker = [protect, authorize('worker')];

// multipart/form-data: the upload middleware runs first so req.body is filled in.
router.post('/', ...worker, ...certificateUpload, v.itiCertificate, validate, ctrl.submitCertificate);
router.get('/mine', ...worker, ctrl.myCertificates);
// The scan is private: the owner and admins only (checked in the controller).
router.get('/:id/file', protect, authorize('worker', 'admin'), v.mongoId(), validate, ctrl.certificateFile);

module.exports = router;
