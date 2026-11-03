const router = require('express').Router();
const ctrl = require('../controllers/profileController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

// /api/profile — the logged-in worker's or employer's own profile
router.get('/me', protect, ctrl.getMyProfile);
router.put('/me', protect, authorize('worker', 'employer'), v.updateProfile, validate, ctrl.updateMyProfile);

module.exports = router;
