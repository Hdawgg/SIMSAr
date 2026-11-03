const router = require('express').Router();
const ctrl = require('../controllers/backgroundCheckController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

const worker = [protect, authorize('worker')];

router.post('/', ...worker, v.backgroundCheck, validate, ctrl.submitCheck);
router.get('/mine', ...worker, ctrl.myChecks);

module.exports = router;
