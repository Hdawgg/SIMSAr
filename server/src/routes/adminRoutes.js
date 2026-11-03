const router = require('express').Router();
const admin = require('../controllers/adminController');
const checks = require('../controllers/backgroundCheckController');
const iti = require('../controllers/itiController');
const trades = require('../controllers/tradeController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const v = require('../validators');

// Every route in this file is admin-only.
router.use(protect, authorize('admin'));

router.get('/stats', admin.stats);
router.get('/users', admin.listUsers);
router.patch('/users/:id/status', v.userStatus, validate, admin.setUserStatus);
router.get('/background-checks', checks.listChecks);
router.patch('/background-checks/:id', v.reviewCheck, validate, checks.reviewCheck);
router.get('/iti-certificates', iti.listCertificates);
router.patch('/iti-certificates/:id', v.reviewIti, validate, iti.reviewCertificate);
router.get('/trades', trades.adminListTrades);
router.post('/trades', v.createTrade, validate, trades.createTrade);
router.patch('/trades/:id', v.updateTrade, validate, trades.updateTrade);
router.delete('/trades/:id', v.mongoId(), validate, trades.deleteTrade);
router.get('/jobs', admin.listAllJobs);
router.patch('/jobs/:id/close', v.closeReason, validate, admin.moderateCloseJob);
router.delete('/jobs/:id', v.mongoId(), validate, admin.deleteJob);

module.exports = router;
