const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.get('/', serviceController.getServices);
router.post('/', serviceController.createService);

module.exports = router;
