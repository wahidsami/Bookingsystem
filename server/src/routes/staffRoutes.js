const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const staffAppController = require('../controllers/staffAppController');
const { authenticateStaff } = require('../middleware/authStaff');

router.post('/auth/login', staffAppController.login);
router.post('/auth/refresh-token', staffAppController.refreshToken);
router.post('/auth/logout', authenticateStaff, staffAppController.logout);
router.get('/me', authenticateStaff, staffAppController.getMe);
router.get('/appointments', authenticateStaff, staffAppController.getAppointments);
router.patch('/appointments/:id/status', authenticateStaff, staffAppController.updateAppointmentStatus);
router.get('/schedule', authenticateStaff, staffAppController.getSchedule);

router.get('/', staffController.getStaff);
router.post('/', staffController.createStaff);
router.get('/:staffId/availability', staffController.getStaffAvailability);

module.exports = router;
