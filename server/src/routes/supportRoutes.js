'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const supportController = require('../controllers/supportController');
const supportService = require('../services/supportPlatformService');

const router = express.Router();

const SUPPORT_UPLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
const SUPPORT_UPLOAD_MAX_FILES = 10;

const supportUploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/support');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const extension = path.extname(file.originalname || '');
        cb(null, `support-${uniqueSuffix}${extension}`);
    }
});

const supportUpload = multer({
    storage: supportUploadStorage,
    limits: {
        fileSize: SUPPORT_UPLOAD_LIMIT_BYTES,
        files: SUPPORT_UPLOAD_MAX_FILES
    },
    fileFilter: (req, file, cb) => {
        try {
            supportService.ensureFileAttachmentAllowed(file);
            return cb(null, true);
        } catch (error) {
            return cb(error);
        }
    }
});

router.get('/tickets', supportController.listTickets);
router.get('/categories', supportController.listCategories);
router.post('/categories', supportController.createSupportCategory);
router.patch('/categories/reorder', supportController.reorderSupportCategories);
router.patch('/categories/:id', supportController.updateSupportCategory);
router.delete('/categories/:id', supportController.deleteSupportCategory);
router.post('/tickets', supportUpload.any(), supportController.createTicket);
router.get('/tickets/:id', supportController.getTicketDetails);
router.post('/tickets/:id/messages', supportUpload.any(), supportController.replyToTicket);
router.post('/tickets/:id/attachments', supportUpload.any(), supportController.uploadAttachmentsToTicket);
router.post('/tickets/:id/assign', supportController.assignTicket);
router.post('/tickets/:id/unassign', supportController.unassignTicket);
router.post('/tickets/:id/status', supportController.changeTicketStatus);
router.post('/tickets/:id/priority', supportController.changeTicketPriority);
router.post('/tickets/:id/category', supportController.changeTicketCategory);
router.post('/tickets/:id/reopen', supportController.reopenTicket);
router.post('/tickets/:id/close', supportController.closeTicket);
router.post('/tickets/:id/read', supportController.markTicketRead);

module.exports = router;
