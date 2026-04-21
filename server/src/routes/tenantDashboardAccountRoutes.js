'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/tenantDashboardAccountController');
const { authenticateTenant, requireTenantDashboardPermission } = require('../middleware/authTenant');

router.use(authenticateTenant);
router.use(requireTenantDashboardPermission('manage_accounts'));

router.get('/role-options', controller.getRoleOptions);
router.get('/', controller.listAccounts);
router.post('/', controller.createAccount);
router.put('/:id', controller.updateAccount);
router.patch('/:id/reset-password', controller.resetPassword);
router.delete('/:id', controller.deactivateAccount);

module.exports = router;
