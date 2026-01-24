const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

router.get('/', staffController.getStaff);
router.post('/', staffController.createStaff);
router.get('/:staffId/availability', staffController.getStaffAvailability);

module.exports = router;
