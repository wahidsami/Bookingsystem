const express = require('express');
const router = express.Router();
const staffAppController = require('../controllers/staffAppController');
const { authenticateStaff } = require('../middleware/authStaff');

router.post('/auth/login', staffAppController.login);
router.post('/auth/refresh-token', staffAppController.refreshToken);
router.post('/auth/logout', authenticateStaff, staffAppController.logout);
router.get('/me', authenticateStaff, staffAppController.getMe);
router.patch('/me/password', authenticateStaff, staffAppController.changePassword);
router.post('/me/push-token', authenticateStaff, staffAppController.registerPushToken);
router.delete('/me/push-token', authenticateStaff, staffAppController.unregisterPushToken);
router.get('/appointments', authenticateStaff, staffAppController.getAppointments);
router.get('/earnings', authenticateStaff, staffAppController.getEarnings);
router.get('/reviews', authenticateStaff, staffAppController.getReviews);
router.patch('/reviews/:id', authenticateStaff, staffAppController.replyToReview);
router.patch('/appointments/:id/status', authenticateStaff, staffAppController.updateAppointmentStatus);
router.get('/schedule', authenticateStaff, staffAppController.getSchedule);
router.get('/time-off', authenticateStaff, staffAppController.getTimeOffRequests);
router.post('/time-off', authenticateStaff, staffAppController.requestTimeOff);
router.delete('/time-off/:id', authenticateStaff, staffAppController.cancelTimeOffRequest);

module.exports = router;
