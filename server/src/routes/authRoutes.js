const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const v = require('../validators');

router.post('/register', authLimiter, v.register, validate, ctrl.register);
router.post('/login', authLimiter, v.login, validate, ctrl.login);
router.get('/me', protect, ctrl.me);

module.exports = router;
