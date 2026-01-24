const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateUser } = require('../middleware/authUser');
const { authenticateTenant } = require('../middleware/authTenant');

// User routes (require user authentication)
router.post('/', authenticateUser, orderController.createOrder);
router.get('/', authenticateUser, orderController.getUserOrders);
router.get('/:id', authenticateUser, orderController.getOrderById);
router.patch('/:id/cancel', authenticateUser, orderController.cancelOrder);

// Tenant admin routes (require tenant authentication)
router.patch('/:id/status', authenticateTenant, orderController.updateOrderStatus);
router.patch('/:id/payment', authenticateTenant, orderController.updatePaymentStatus);

module.exports = router;
