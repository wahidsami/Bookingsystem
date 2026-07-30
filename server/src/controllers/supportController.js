'use strict';

const supportService = require('../services/supportPlatformService');

const getActor = (req) => req.supportContext || {
    actorType: req.adminId ? 'support_agent' : 'customer',
    actorId: req.adminId || req.userId || null,
    supportAgentId: req.supportContext?.supportAgentId || null,
    adminId: req.adminId || null,
    tenantId: req.tenantId || null,
    canAccessAllTickets: Boolean(req.adminId),
    isCustomer: Boolean(req.userId && !req.adminId),
    isSupportAgent: Boolean(req.adminId),
    isSuperAdmin: Boolean(req.adminId)
};

const parseJsonMaybe = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    if (Array.isArray(value) || typeof value === 'object') {
        return value;
    }

    if (typeof value !== 'string') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
};

const pickFirst = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const getFiles = (req) => Array.isArray(req.files) ? req.files : [];

const sendSuccess = (res, payload, statusCode = 200) => res.status(statusCode).json({
    success: true,
    ...payload
});

const sendError = (res, error, fallbackMessage = 'Support request failed') => {
    const statusCode = error?.statusCode || error?.status || 500;
    return res.status(statusCode).json({
        success: false,
        message: error?.message || fallbackMessage,
        code: error?.code || null
    });
};

const createTicket = async (req, res) => {
    try {
        const actor = getActor(req);
        const links = parseJsonMaybe(pickFirst(req.body.links, req.body.linkedEntities), []);
        const metadata = parseJsonMaybe(req.body.metadata, {});
        const ticket = await supportService.createTicket({
            actor,
            tenantId: pickFirst(req.body.tenantId, req.query.tenantId, req.params.tenantId),
            customerPlatformUserId: pickFirst(req.body.customerPlatformUserId, req.body.customerId),
            supportCategoryId: pickFirst(req.body.supportCategoryId, req.body.categoryId),
            subject: req.body.subject,
            subjectAr: req.body.subjectAr,
            description: req.body.description,
            descriptionAr: req.body.descriptionAr,
            language: req.body.language,
            priority: req.body.priority,
            source: req.body.source,
            sourceChannel: req.body.sourceChannel,
            links,
            attachments: getFiles(req),
            metadata
        });

        return sendSuccess(res, { ticket }, 201);
    } catch (error) {
        return sendError(res, error, 'Failed to create support ticket');
    }
};

const listTickets = async (req, res) => {
    try {
        const actor = getActor(req);
        const pagination = supportService.parsePage(req.query || {});
        const result = await supportService.listTickets({
            actor,
            filters: req.query,
            pagination
        });

        return sendSuccess(res, result);
    } catch (error) {
        return sendError(res, error, 'Failed to list support tickets');
    }
};

const getTicketDetails = async (req, res) => {
    try {
        const actor = getActor(req);
        const ticket = await supportService.getTicketDetails({
            actor,
            ticketId: req.params.id
        });

        return sendSuccess(res, { ticket });
    } catch (error) {
        return sendError(res, error, 'Failed to fetch support ticket');
    }
};

const listCategories = async (req, res) => {
    try {
        const actor = getActor(req);
        const result = await supportService.listCategories({
            actor,
            filters: req.query
        });

        return sendSuccess(res, result);
    } catch (error) {
        return sendError(res, error, 'Failed to fetch support categories');
    }
};

const replyToTicket = async (req, res) => {
    try {
        const actor = getActor(req);
        const result = await supportService.replyToTicket({
            actor,
            ticketId: req.params.id,
            content: req.body.content,
            visibility: req.body.visibility,
            replyToMessageId: pickFirst(req.body.replyToMessageId, req.body.replyToMessage, req.body.parentMessageId),
            attachments: getFiles(req)
        });

        return sendSuccess(res, result, 201);
    } catch (error) {
        return sendError(res, error, 'Failed to add support message');
    }
};

const uploadAttachmentsToTicket = async (req, res) => {
    try {
        const actor = getActor(req);
        const result = await supportService.uploadAttachmentsToTicket({
            actor,
            ticketId: req.params.id,
            supportMessageId: pickFirst(req.body.supportMessageId, req.body.messageId),
            files: getFiles(req)
        });

        return sendSuccess(res, result, 201);
    } catch (error) {
        return sendError(res, error, 'Failed to upload support attachments');
    }
};

const assignTicket = async (req, res) => {
    try {
        const actor = getActor(req);
        const ticket = await supportService.assignTicket({
            actor,
            ticketId: req.params.id,
            supportAgentId: pickFirst(req.body.supportAgentId, req.body.assignedSupportAgentId)
        });

        return sendSuccess(res, { ticket });
    } catch (error) {
        return sendError(res, error, 'Failed to assign support ticket');
    }
};

const unassignTicket = async (req, res) => {
    try {
        const actor = getActor(req);
        const ticket = await supportService.unassignTicket({
            actor,
            ticketId: req.params.id
        });

        return sendSuccess(res, { ticket });
    } catch (error) {
        return sendError(res, error, 'Failed to unassign support ticket');
    }
};

const changeTicketStatus = async (req, res) => {
    try {
        const actor = getActor(req);
        const ticket = await supportService.changeTicketStatus({
            actor,
            ticketId: req.params.id,
            status: req.body.status
        });

        return sendSuccess(res, { ticket });
    } catch (error) {
        return sendError(res, error, 'Failed to change support ticket status');
    }
};

const changeTicketPriority = async (req, res) => {
    try {
        const actor = getActor(req);
        const ticket = await supportService.changeTicketPriority({
            actor,
            ticketId: req.params.id,
            priority: req.body.priority
        });

        return sendSuccess(res, { ticket });
    } catch (error) {
        return sendError(res, error, 'Failed to change support ticket priority');
    }
};

const changeTicketCategory = async (req, res) => {
    try {
        const actor = getActor(req);
        const ticket = await supportService.changeTicketCategory({
            actor,
            ticketId: req.params.id,
            supportCategoryId: pickFirst(req.body.supportCategoryId, req.body.categoryId)
        });

        return sendSuccess(res, { ticket });
    } catch (error) {
        return sendError(res, error, 'Failed to change support ticket category');
    }
};

const reopenTicket = async (req, res) => {
    try {
        const actor = getActor(req);
        const ticket = await supportService.reopenTicket({
            actor,
            ticketId: req.params.id
        });

        return sendSuccess(res, { ticket });
    } catch (error) {
        return sendError(res, error, 'Failed to reopen support ticket');
    }
};

const closeTicket = async (req, res) => {
    try {
        const actor = getActor(req);
        const ticket = await supportService.closeTicket({
            actor,
            ticketId: req.params.id
        });

        return sendSuccess(res, { ticket });
    } catch (error) {
        return sendError(res, error, 'Failed to close support ticket');
    }
};

const markTicketRead = async (req, res) => {
    try {
        const actor = getActor(req);
        const ticket = await supportService.markTicketRead({
            actor,
            ticketId: req.params.id
        });

        return sendSuccess(res, { ticket });
    } catch (error) {
        return sendError(res, error, 'Failed to mark support ticket as read');
    }
};

module.exports = {
    createTicket,
    listTickets,
    listCategories,
    getTicketDetails,
    replyToTicket,
    uploadAttachmentsToTicket,
    assignTicket,
    unassignTicket,
    changeTicketStatus,
    changeTicketPriority,
    changeTicketCategory,
    reopenTicket,
    closeTicket,
    markTicketRead
};
