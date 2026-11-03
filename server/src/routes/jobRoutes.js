const router = require('express').Router();
const ctrl = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

const employer = [protect, authorize('employer')];

router.get('/', v.listJobs, validate, ctrl.listJobs);
router.get('/mine', ...employer, ctrl.myJobs); // must come before '/:id'
router.post('/', ...employer, v.createJob, validate, ctrl.createJob);
router.get('/:id', v.mongoId(), validate, ctrl.getJob);
router.put('/:id', ...employer, v.updateJob, validate, ctrl.updateJob);
router.patch('/:id/close', ...employer, v.optionalReason, validate, ctrl.closeJob);
router.get('/:id/applications', ...employer, v.mongoId(), validate, ctrl.jobApplications);
router.post('/:id/apply', protect, authorize('worker'), v.apply, validate, ctrl.applyToJob);

module.exports = router;
