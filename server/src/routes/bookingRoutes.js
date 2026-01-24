const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticateUser, optionalAuth } = require('../middleware/authUser');

// Search for available slots (public - no auth required)
router.post('/search', bookingController.searchAvailability);

// Get AI-powered staff recommendations (optional auth - better recommendations if logged in)
router.get('/recommendations', optionalAuth, bookingController.getRecommendations);

// Get next available slot for a service and staff (public - no auth required)
router.get('/next-available', bookingController.getNextAvailableSlot);

// Create a new booking (requires authentication)
router.post('/create', authenticateUser, bookingController.createBooking);

// Get all bookings (optional auth - returns user's bookings if authenticated)
router.get('/', optionalAuth, bookingController.listBookings);

// Get specific booking (optional auth - more details if user owns booking)
router.get('/:id', optionalAuth, bookingController.getBooking);

// Cancel a booking (requires authentication - users can only cancel their own)
router.patch('/:id/cancel', authenticateUser, bookingController.cancelBooking);

module.exports = router;
