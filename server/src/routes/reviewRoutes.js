const router = require('express').Router();
const ctrl = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

router.post('/', protect, authorize('worker', 'employer'), v.review, validate, ctrl.createReview);
router.get('/user/:id', ctrl.reviewsForUser);

module.exports = router;
