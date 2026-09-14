const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { authenticateUser } = require('../middleware/authUser');

router.use(authenticateUser);

router.get('/', addressController.getAddresses);
router.post('/', addressController.createAddress);
router.put('/:id', addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);

module.exports = router;
