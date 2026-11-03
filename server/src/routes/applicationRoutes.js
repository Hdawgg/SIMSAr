const router = require('express').Router();
const ctrl = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { mongoId } = require('../validators');

const worker = [protect, authorize('worker')];
const employer = [protect, authorize('employer')];
const id = [mongoId(), validate];

router.get('/mine', ...worker, ctrl.myApplications);
router.patch('/:id/accept', ...employer, ...id, ctrl.accept);
router.patch('/:id/reject', ...employer, ...id, ctrl.reject);
router.patch('/:id/start', ...worker, ...id, ctrl.start);
router.patch('/:id/done', ...worker, ...id, ctrl.markDone);
router.patch('/:id/complete', ...employer, ...id, ctrl.complete);
router.patch('/:id/cancel', protect, authorize('worker', 'employer'), ...id, ctrl.cancel);

module.exports = router;
