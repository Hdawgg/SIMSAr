const router = require('express').Router();
const profileCtrl = require('../controllers/profileController');

// Public routes: browse workers and view anyone's public profile + ratings
router.get('/workers', profileCtrl.listWorkers);
router.get('/users/:id/profile', profileCtrl.getPublicProfile);

module.exports = router;
