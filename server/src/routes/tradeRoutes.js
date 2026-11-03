const router = require('express').Router();
const ctrl = require('../controllers/tradeController');

// Public: trades and their fair minimum rates. Admin changes are in adminRoutes.js.
router.get('/', ctrl.listTrades);

module.exports = router;
