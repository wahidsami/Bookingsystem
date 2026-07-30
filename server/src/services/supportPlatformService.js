'use strict';

const path = require('path');
const { Op } = require('sequelize');
const db = require('../models');

class SupportError extends Error {
    constructor(message, statusCode = 400, code = null) {
        super(message);
        this.name = 'SupportError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

const MESSAGE_MAX_LENGTH = 10000;
const ATTACHMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024;

const SUPPORT_STATUSES = new Set(['draft', 'open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened']);
const SUPPORT_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const SOURCE_VALUES = new Set(['dashboard', 'ai', 'api', 'email', 'mobile', 'system']);
const SOURCE_CHANNEL_MAP = {
    customer_app: 'mobile',
    tenant_dashboard: 'dashboard',
    support_portal: 'dashboard',
    email: 'email',
    chat: 'dashboard',
    live_chat: 'dashboard',
    ai_assistant: 'ai',
    api: 'api',
    system: 'system'
};

const ATTACHMENT_CATEGORY_BY_MIME = [
    { category: 'image', test: (mime) => /^image\//i.test(mime) },
    { category: 'pdf', test: (mime) => /^application\/pdf$/i.test(mime) },
    { category: 'office', test: (mime) => /^(application\/(vnd\.openxmlformats-officedocument|msword|vnd\.ms-excel|vnd\.ms-powerpoint)|application\/rtf|text\/rtf)$/i.test(mime) },
    { category: 'zip', test: (mime) => /^(application\/zip|application\/x-zip-compressed|application\/x-compressed-zip)$/i.test(mime) }
];

const allowedAttachmentExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf', '.zip']);

function normalizeText(value) {
    return `${value || ''}`.trim();
}

function normalizeOptionalText(value) {
    const text = normalizeText(value);
    return text || null;
}

function normalizeSource(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) {
        return 'dashboard';
    }

    if (SOURCE_VALUES.has(normalized)) {
        return normalized;
    }

    return SOURCE_CHANNEL_MAP[normalized] || 'dashboard';
}

function normalizeVisibility(value) {
    return `${value || 'public'}`.trim().toLowerCase() === 'internal' ? 'internal' : 'public';
}

function normalizePriority(value) {
    const normalized = `${value || 'medium'}`.trim().toLowerCase();
    return SUPPORT_PRIORITIES.has(normalized) ? normalized : 'medium';
}

function normalizeStatus(value) {
    const normalized = `${value || 'open'}`.trim().toLowerCase();
    if (!SUPPORT_STATUSES.has(normalized)) {
        throw new SupportError('Invalid support ticket status', 400);
    }
    return normalized;
}

function normalizeEntityType(value) {
    return normalizeText(value).toLowerCase();
}

function parsePage(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    return {
        page,
        limit,
        offset: (page - 1) * limit
    };
}

function createSupportError(message, statusCode = 400, code = null) {
    return new SupportError(message, statusCode, code);
}

function fileCategoryFromMimeType(mimeType = '', originalName = '') {
    const normalizedMime = `${mimeType || ''}`.trim().toLowerCase();
    const normalizedName = `${originalName || ''}`.trim().toLowerCase();
    const extension = path.extname(normalizedName);

    const matched = ATTACHMENT_CATEGORY_BY_MIME.find((item) => item.test(normalizedMime));
    if (matched) {
        return matched.category;
    }

    if (extension && allowedAttachmentExtensions.has(extension)) {
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extension)) {
            return 'image';
        }
        if (extension === '.pdf') {
            return 'pdf';
        }
        if (extension === '.zip') {
            return 'zip';
        }
        return 'office';
    }

    return null;
}

function ensureFileAttachmentAllowed(file) {
    const fileSize = Number(file?.size || 0);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
        throw createSupportError('Attachment file is empty or invalid', 400);
    }

    if (fileSize > ATTACHMENT_MAX_SIZE_BYTES) {
        throw createSupportError('Attachment exceeds the maximum allowed size', 400);
    }

    const fileCategory = fileCategoryFromMimeType(file?.mimetype, file?.originalname);
    if (!fileCategory) {
        throw createSupportError('Unsupported attachment type', 400);
    }

    return fileCategory;
}

function ensureContentLength(content) {
    const normalized = normalizeText(content);
    if (!normalized) {
        throw createSupportError('Message content is required', 400);
    }
    if (normalized.length > MESSAGE_MAX_LENGTH) {
        throw createSupportError(`Message content must be ${MESSAGE_MAX_LENGTH} characters or less`, 400);
    }
    return normalized;
}

function ensureSubjectLength(subject) {
    const normalized = normalizeText(subject);
    if (!normalized) {
        throw createSupportError('Ticket subject is required', 400);
    }
    if (normalized.length > 255) {
        throw createSupportError('Ticket subject must be 255 characters or less', 400);
    }
    return normalized;
}

function getActorContext(actor = {}) {
    return {
        actorType: actor.actorType || 'customer',
        actorId: actor.actorId || null,
        supportAgentId: actor.supportAgentId || null,
        adminId: actor.adminId || null,
        tenantId: actor.tenantId || null,
        canAccessAllTickets: Boolean(actor.canAccessAllTickets),
        isCustomer: actor.actorType === 'customer',
        isSupportAgent: actor.actorType === 'support_agent',
        isSuperAdmin: actor.actorType === 'super_admin'
    };
}

function getReplyPreview(message) {
    if (!message) return null;

    const json = typeof message.toJSON === 'function' ? message.toJSON() : message;
    return {
        id: json.id,
        senderType: json.senderType,
        visibility: json.visibility,
        content: json.content,
        createdAt: json.createdAt || null
    };
}

function normalizeAttachment(attachment) {
    const json = typeof attachment?.toJSON === 'function' ? attachment.toJSON() : (attachment || {});
    return {
        id: json.id,
        tenantId: json.tenantId,
        supportTicketId: json.supportTicketId,
        supportMessageId: json.supportMessageId,
        uploadedByType: json.uploadedByType,
        customerPlatformUserId: json.customerPlatformUserId,
        supportAgentId: json.supportAgentId,
        fileName: json.fileName,
        originalName: json.originalName,
        mimeType: json.mimeType,
        fileCategory: json.fileCategory,
        storageProvider: json.storageProvider,
        storagePath: json.storagePath,
        storageUrl: json.storageUrl,
        fileSize: Number(json.fileSize || 0),
        checksum: json.checksum || null,
        caption: json.caption || null,
        isInline: Boolean(json.isInline),
        metadata: json.metadata || {},
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null
    };
}

function normalizeReadState(readState) {
    const json = typeof readState?.toJSON === 'function' ? readState.toJSON() : (readState || {});
    return {
        id: json.id,
        tenantId: json.tenantId,
        supportTicketId: json.supportTicketId,
        participantType: json.participantType,
        participantId: json.participantId || null,
        lastReadMessageId: json.lastReadMessageId || null,
        lastReadAt: json.lastReadAt || null,
        unreadCount: Number(json.unreadCount || 0),
        metadata: json.metadata || {},
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null
    };
}

function normalizeNotificationEvent(notificationEvent) {
    const json = typeof notificationEvent?.toJSON === 'function' ? notificationEvent.toJSON() : (notificationEvent || {});
    return {
        id: json.id,
        tenantId: json.tenantId,
        supportTicketId: json.supportTicketId,
        supportMessageId: json.supportMessageId || null,
        eventType: json.eventType,
        recipientType: json.recipientType,
        recipientId: json.recipientId || null,
        payload: json.payload || {},
        deliveryState: json.deliveryState || {},
        processedAt: json.processedAt || null,
        failedAt: json.failedAt || null,
        failureReason: json.failureReason || null,
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null
    };
}

function normalizeTicketEvent(ticketEvent) {
    const json = typeof ticketEvent?.toJSON === 'function' ? ticketEvent.toJSON() : (ticketEvent || {});
    return {
        id: json.id,
        tenantId: json.tenantId,
        supportTicketId: json.supportTicketId,
        supportMessageId: json.supportMessageId || null,
        supportAttachmentId: json.supportAttachmentId || null,
        actorType: json.actorType,
        customerPlatformUserId: json.customerPlatformUserId || null,
        supportAgentId: json.supportAgentId || null,
        eventType: json.eventType,
        fromStatus: json.fromStatus || null,
        toStatus: json.toStatus || null,
        fromPriority: json.fromPriority || null,
        toPriority: json.toPriority || null,
        payload: json.payload || {},
        occurredAt: json.occurredAt || null,
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null
    };
}

function normalizeMessage(message, actorContext = {}) {
    if (!message) {
        return null;
    }

    const json = typeof message.toJSON === 'function' ? message.toJSON() : message;
    if (actorContext.isCustomer && json.visibility === 'internal') {
        return null;
    }

    const attachments = Array.isArray(json.attachments)
        ? json.attachments.map(normalizeAttachment)
        : [];

    return {
        id: json.id,
        tenantId: json.tenantId,
        supportTicketId: json.supportTicketId,
        replyToMessageId: json.replyToMessageId || null,
        senderType: json.senderType,
        customerPlatformUserId: json.customerPlatformUserId || null,
        supportAgentId: json.supportAgentId || null,
        content: json.content,
        language: json.language,
        contentFormat: json.contentFormat,
        visibility: json.visibility,
        isEdited: Boolean(json.isEdited),
        editedAt: json.editedAt || null,
        metadata: json.metadata || {},
        replyToMessage: json.replyToMessage ? getReplyPreview(json.replyToMessage) : null,
        attachments,
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null
    };
}

function normalizeTicket(ticket, actorContext = {}) {
    if (!ticket) {
        return null;
    }

    const json = typeof ticket.toJSON === 'function' ? ticket.toJSON() : ticket;
    const rawMessages = Array.isArray(json.messages) ? json.messages : [];
    const messages = rawMessages
        .map((message) => normalizeMessage(message, actorContext))
        .filter(Boolean)
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    const allReadStates = Array.isArray(json.readStates)
        ? json.readStates.map(normalizeReadState)
        : [];

    const normalized = {
        id: json.id,
        ticketNumber: json.ticketNumber,
        tenantId: json.tenantId,
        customerPlatformUserId: json.customerPlatformUserId || null,
        supportCategoryId: json.supportCategoryId || null,
        assignedSupportAgentId: json.assignedSupportAgentId || null,
        source: json.source || 'dashboard',
        sourceChannel: json.sourceChannel || 'customer_app',
        status: json.status,
        priority: json.priority,
        language: json.language,
        subject: json.subject,
        subjectAr: json.subjectAr || null,
        description: json.description || null,
        descriptionAr: json.descriptionAr || null,
        lastMessageAt: json.lastMessageAt || null,
        firstResponseAt: json.firstResponseAt || null,
        resolvedAt: json.resolvedAt || null,
        closedAt: json.closedAt || null,
        reopenedAt: json.reopenedAt || null,
        metadata: json.metadata || {},
        links: Array.isArray(json.links)
            ? json.links.map((link) => {
                const linkJson = typeof link.toJSON === 'function' ? link.toJSON() : link;
                return {
                    id: linkJson.id,
                    ticketId: linkJson.ticketId,
                    entityType: linkJson.entityType,
                    entityId: linkJson.entityId,
                    createdBy: linkJson.createdBy || null,
                    createdAt: linkJson.createdAt || null,
                    updatedAt: linkJson.updatedAt || null
                };
            })
            : [],
        customer: json.customer ? {
            id: json.customer.id,
            firstName: json.customer.firstName,
            lastName: json.customer.lastName,
            email: json.customer.email,
            phone: json.customer.phone,
            profileImage: json.customer.profileImage || null
        } : null,
        category: json.category ? {
            id: json.category.id,
            slug: json.category.slug,
            scope: json.category.scope,
            name: json.category.name,
            nameAr: json.category.nameAr || null,
            description: json.category.description || null,
            descriptionAr: json.category.descriptionAr || null,
            icon: json.category.icon || null,
            color: json.category.color || null,
            sortOrder: Number(json.category.sortOrder || 0),
            isActive: Boolean(json.category.isActive)
        } : null,
        assignedAgent: json.assignedAgent ? {
            id: json.assignedAgent.id,
            displayName: json.assignedAgent.displayName,
            displayNameAr: json.assignedAgent.displayNameAr || null,
            title: json.assignedAgent.title || null,
            avatarUrl: json.assignedAgent.avatarUrl || null,
            status: json.assignedAgent.status,
            presenceStatus: json.assignedAgent.presenceStatus
        } : null,
        messages,
        events: Array.isArray(json.events) ? json.events.map(normalizeTicketEvent).sort((a, b) => new Date(a.occurredAt || 0) - new Date(b.occurredAt || 0)) : [],
        notificationEvents: Array.isArray(json.notificationEvents) ? json.notificationEvents.map(normalizeNotificationEvent).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) : [],
        readStates: allReadStates,
        unreadCount: (() => {
            if (actorContext.isCustomer) {
                return allReadStates.find((state) => state.participantType === 'customer' && state.participantId === actorContext.actorId)?.unreadCount || 0;
            }

            if (actorContext.isSupportAgent) {
                return allReadStates.find((state) => state.participantType === 'support_agent' && state.participantId === actorContext.supportAgentId)?.unreadCount || 0;
            }

            return 0;
        })(),
        messageCount: messages.length,
        attachmentCount: messages.reduce((sum, message) => sum + (Array.isArray(message.attachments) ? message.attachments.length : 0), 0),
        latestMessage: messages.length > 0 ? messages[messages.length - 1] : null,
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null,
        deletedAt: json.deletedAt || null
    };

    if (actorContext.isCustomer) {
        normalized.messages = messages.filter((message) => message.visibility !== 'internal');
        normalized.events = normalized.events.filter((event) => event.actorType !== 'support_agent' || event.payload?.visibility !== 'internal');
    }

    return normalized;
}

function buildTicketInclude({ includeMessages = false, includeEvents = false, includeNotificationEvents = false, includeReadStates = false, includeLinks = true } = {}) {
    const includes = [
        {
            model: db.PlatformUser,
            as: 'customer',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage']
        },
        {
            model: db.SupportCategory,
            as: 'category',
            attributes: ['id', 'slug', 'scope', 'name', 'nameAr', 'description', 'descriptionAr', 'icon', 'color', 'sortOrder', 'isActive']
        },
        {
            model: db.SupportAgent,
            as: 'assignedAgent',
            attributes: ['id', 'displayName', 'displayNameAr', 'title', 'avatarUrl', 'status', 'presenceStatus']
        }
    ];

    if (includeLinks) {
        includes.push({
            model: db.SupportTicketLink,
            as: 'links',
            attributes: ['id', 'ticketId', 'entityType', 'entityId', 'createdBy', 'createdAt', 'updatedAt']
        });
    }

    if (includeReadStates) {
        includes.push({
            model: db.SupportTicketReadState,
            as: 'readStates',
            attributes: ['id', 'tenantId', 'supportTicketId', 'participantType', 'participantId', 'lastReadMessageId', 'lastReadAt', 'unreadCount', 'metadata', 'createdAt', 'updatedAt']
        });
    }

    if (includeNotificationEvents) {
        includes.push({
            model: db.SupportTicketNotificationEvent,
            as: 'notificationEvents',
            separate: true,
            order: [['createdAt', 'ASC']],
            attributes: ['id', 'tenantId', 'supportTicketId', 'supportMessageId', 'eventType', 'recipientType', 'recipientId', 'payload', 'deliveryState', 'processedAt', 'failedAt', 'failureReason', 'createdAt', 'updatedAt']
        });
    }

    if (includeEvents) {
        includes.push({
            model: db.SupportTicketEvent,
            as: 'events',
            separate: true,
            order: [['occurredAt', 'ASC']],
            attributes: ['id', 'tenantId', 'supportTicketId', 'supportMessageId', 'supportAttachmentId', 'actorType', 'customerPlatformUserId', 'supportAgentId', 'eventType', 'fromStatus', 'toStatus', 'fromPriority', 'toPriority', 'payload', 'occurredAt', 'createdAt', 'updatedAt']
        });
    }

    if (includeMessages) {
        includes.push({
            model: db.SupportMessage,
            as: 'messages',
            separate: true,
            order: [['createdAt', 'ASC']],
            attributes: ['id', 'tenantId', 'supportTicketId', 'replyToMessageId', 'senderType', 'customerPlatformUserId', 'supportAgentId', 'content', 'language', 'contentFormat', 'visibility', 'isEdited', 'editedAt', 'metadata', 'createdAt', 'updatedAt'],
            include: [
                {
                    model: db.SupportAttachment,
                    as: 'attachments',
                    attributes: ['id', 'tenantId', 'supportTicketId', 'supportMessageId', 'uploadedByType', 'customerPlatformUserId', 'supportAgentId', 'fileName', 'originalName', 'mimeType', 'fileCategory', 'storageProvider', 'storagePath', 'storageUrl', 'fileSize', 'checksum', 'caption', 'isInline', 'metadata', 'createdAt', 'updatedAt']
                },
                {
                    model: db.SupportMessage,
                    as: 'replyToMessage',
                    attributes: ['id', 'senderType', 'content', 'visibility', 'createdAt']
                }
            ]
        });
    }

    return includes;
}

async function getExistingTicketOrThrow(ticketId, actorContext, options = {}) {
    const ticket = await db.SupportTicket.findByPk(ticketId, {
        include: buildTicketInclude(options),
        transaction: options.transaction || null
    });

    if (!ticket) {
        throw createSupportError('Support ticket not found', 404);
    }

    const ticketJson = typeof ticket.toJSON === 'function' ? ticket.toJSON() : ticket;
    if (actorContext.isCustomer && ticketJson.customerPlatformUserId !== actorContext.actorId) {
        throw createSupportError('You do not have access to this ticket', 403);
    }

    if (actorContext.isSupportAgent && !actorContext.canAccessAllTickets) {
        if (ticketJson.assignedSupportAgentId && ticketJson.assignedSupportAgentId !== actorContext.supportAgentId) {
            throw createSupportError('You can only access tickets assigned to you', 403);
        }
    }

    return ticket;
}

async function createSupportNotificationEvents({
    ticket,
    eventType,
    recipients = [],
    payload = {},
    supportMessageId = null,
    transaction
}) {
    const uniqueRecipients = recipients
        .map((recipient) => ({
            recipientType: normalizeText(recipient.recipientType).toLowerCase(),
            recipientId: recipient.recipientId || null
        }))
        .filter((recipient) => recipient.recipientType);

    if (uniqueRecipients.length === 0) {
        return [];
    }

    const now = new Date();
    const rows = uniqueRecipients.map((recipient) => ({
        tenantId: ticket.tenantId,
        supportTicketId: ticket.id,
        supportMessageId,
        eventType,
        recipientType: recipient.recipientType,
        recipientId: recipient.recipientId,
        payload,
        deliveryState: { status: 'pending', channels: ['in_app', 'email', 'push', 'sms', 'whatsapp'] },
        createdAt: now,
        updatedAt: now
    }));

    return db.SupportTicketNotificationEvent.bulkCreate(rows, { transaction });
}

async function createTicketEvent({
    ticket,
    eventType,
    actorType,
    actorId = null,
    messageId = null,
    attachmentId = null,
    fromStatus = null,
    toStatus = null,
    fromPriority = null,
    toPriority = null,
    payload = {},
    transaction
}) {
    return db.SupportTicketEvent.create({
        tenantId: ticket.tenantId,
        supportTicketId: ticket.id,
        supportMessageId: messageId,
        supportAttachmentId: attachmentId,
        actorType: normalizeText(actorType).toLowerCase() || 'system',
        customerPlatformUserId: actorType === 'customer' ? actorId : ticket.customerPlatformUserId,
        supportAgentId: actorType === 'support_agent' ? actorId : ticket.assignedSupportAgentId,
        eventType,
        fromStatus,
        toStatus,
        fromPriority,
        toPriority,
        payload,
        occurredAt: new Date()
    }, { transaction });
}

async function upsertReadState({
    ticket,
    participantType,
    participantId = null,
    unreadCount = 0,
    lastReadMessageId = null,
    lastReadAt = null,
    metadata = {},
    transaction
}) {
    const where = {
        tenantId: ticket.tenantId,
        supportTicketId: ticket.id,
        participantType: normalizeText(participantType).toLowerCase(),
        participantId: participantId || null
    };

    const [row] = await db.SupportTicketReadState.findOrCreate({
        where,
        defaults: {
            ...where,
            unreadCount: Number(unreadCount || 0),
            lastReadMessageId,
            lastReadAt,
            metadata
        },
        transaction
    });

    const nextUnreadCount = Number.isFinite(Number(unreadCount))
        ? Number(unreadCount)
        : Number(row.unreadCount || 0);

    await row.update({
        unreadCount: nextUnreadCount,
        lastReadMessageId: lastReadMessageId || row.lastReadMessageId || null,
        lastReadAt: lastReadAt || row.lastReadAt || null,
        metadata: {
            ...(row.metadata || {}),
            ...metadata
        }
    }, { transaction });

    return row;
}

async function adjustReadStateUnreadCount({
    ticket,
    participantType,
    participantId = null,
    delta = 0,
    lastReadMessageId = null,
    lastReadAt = null,
    transaction
}) {
    const where = {
        tenantId: ticket.tenantId,
        supportTicketId: ticket.id,
        participantType: normalizeText(participantType).toLowerCase(),
        participantId: participantId || null
    };

    const [row] = await db.SupportTicketReadState.findOrCreate({
        where,
        defaults: {
            ...where,
            unreadCount: 0
        },
        transaction
    });

    const nextUnreadCount = Math.max(0, Number(row.unreadCount || 0) + Number(delta || 0));
    await row.update({
        unreadCount: nextUnreadCount,
        lastReadMessageId: lastReadMessageId || row.lastReadMessageId || null,
        lastReadAt: lastReadAt || row.lastReadAt || null
    }, { transaction });

    return row;
}

async function resolveTicketAccess(ticketId, actorContext, options = {}) {
    return getExistingTicketOrThrow(ticketId, actorContext, options);
}

async function resolveCustomer(tenantId, customerPlatformUserId, transaction) {
    const customer = await db.PlatformUser.findByPk(customerPlatformUserId, { transaction });
    if (!customer) {
        throw createSupportError('Customer not found', 404);
    }
    if (!customer.isActive) {
        throw createSupportError('Customer account is inactive', 403);
    }
    if (customer.isBanned) {
        throw createSupportError('Customer account is banned', 403);
    }
    return customer;
}

async function resolveCategoryOrNull(categoryId, tenantId, transaction) {
    if (!categoryId) return null;

    const category = await db.SupportCategory.findOne({
        where: {
            id: categoryId,
            [Op.or]: [
                { scope: 'global' },
                { scope: 'tenant', tenantId }
            ]
        },
        transaction
    });

    if (!category) {
        throw createSupportError('Support category not found', 404);
    }
    if (!category.isActive) {
        throw createSupportError('Support category is inactive', 400);
    }
    return category;
}

async function resolveSupportAgentById(supportAgentId, transaction) {
    if (!supportAgentId) return null;
    const supportAgent = await db.SupportAgent.findByPk(supportAgentId, { transaction });
    if (!supportAgent) {
        throw createSupportError('Support agent not found', 404);
    }
    if (supportAgent.status !== 'active') {
        throw createSupportError('Support agent is not active', 400);
    }
    return supportAgent;
}

function buildRecipientListForTicketAction(ticket, actorContext, actionType) {
    const recipients = [];

    if (actionType === 'ticket_created') {
        if (ticket.assignedSupportAgentId) {
            recipients.push({ recipientType: 'support_agent', recipientId: ticket.assignedSupportAgentId });
        } else {
            recipients.push({ recipientType: 'support_queue', recipientId: null });
        }

        if (actorContext.isSupportAgent || actorContext.isSuperAdmin) {
            recipients.push({
                recipientType: 'customer',
                recipientId: ticket.customerPlatformUserId
            });
        }

        return recipients;
    }

    if (actionType === 'reply_added') {
        if (actorContext.isCustomer) {
            if (ticket.assignedSupportAgentId) {
                recipients.push({ recipientType: 'support_agent', recipientId: ticket.assignedSupportAgentId });
            } else {
                recipients.push({ recipientType: 'support_queue', recipientId: null });
            }
        } else {
            recipients.push({ recipientType: 'customer', recipientId: ticket.customerPlatformUserId });
        }
        return recipients;
    }

    if (actionType === 'assigned') {
        if (ticket.assignedSupportAgentId) {
            recipients.push({ recipientType: 'support_agent', recipientId: ticket.assignedSupportAgentId });
        } else {
            recipients.push({ recipientType: 'support_queue', recipientId: null });
        }
        recipients.push({ recipientType: 'customer', recipientId: ticket.customerPlatformUserId });
        return recipients;
    }

    if (['status_changed', 'priority_changed', 'category_changed', 'closed', 'reopened'].includes(actionType)) {
        recipients.push({ recipientType: 'customer', recipientId: ticket.customerPlatformUserId });
        if (ticket.assignedSupportAgentId) {
            recipients.push({ recipientType: 'support_agent', recipientId: ticket.assignedSupportAgentId });
        } else {
            recipients.push({ recipientType: 'support_queue', recipientId: null });
        }
    }

    return recipients;
}

function getStatusTransitionAllowed(currentStatus, nextStatus) {
    const transitions = {
        draft: ['open', 'closed', 'reopened'],
        open: ['assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened'],
        assigned: ['in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened'],
        in_progress: ['assigned', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed', 'reopened'],
        waiting_for_customer: ['assigned', 'in_progress', 'waiting_for_support', 'resolved', 'closed', 'reopened'],
        waiting_for_support: ['assigned', 'in_progress', 'waiting_for_customer', 'resolved', 'closed', 'reopened'],
        resolved: ['reopened', 'closed'],
        closed: ['reopened'],
        reopened: ['assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed']
    };

    if (!SUPPORT_STATUSES.has(nextStatus)) {
        return false;
    }

    if (currentStatus === nextStatus) {
        return true;
    }

    return (transitions[currentStatus] || []).includes(nextStatus);
}

async function createTicket({
    actor,
    tenantId,
    customerPlatformUserId,
    supportCategoryId = null,
    subject,
    subjectAr = null,
    description = null,
    descriptionAr = null,
    language = 'ar',
    priority = 'medium',
    source = null,
    sourceChannel = null,
    links = [],
    attachments = [],
    metadata = {}
}) {
    const actorContext = getActorContext(actor);
    const normalizedTenantId = normalizeText(tenantId);
    if (!normalizedTenantId) {
        throw createSupportError('tenantId is required', 400);
    }

    const normalizedCustomerId = actorContext.isCustomer
        ? actorContext.actorId
        : normalizeText(customerPlatformUserId) || null;

    if (!normalizedCustomerId) {
        throw createSupportError('customerPlatformUserId is required', 400);
    }

    const subjectText = ensureSubjectLength(subject);
    const descriptionText = normalizeOptionalText(description);
    const descriptionArText = normalizeOptionalText(descriptionAr);
    const priorityValue = normalizePriority(priority);
    const languageValue = normalizeText(language).toLowerCase() === 'en' ? 'en' : 'ar';
    const sourceValue = normalizeSource(source || sourceChannel || (actorContext.isCustomer ? 'mobile' : 'dashboard'));
    const firstMessageContent = ensureContentLength(descriptionText || subjectText);

    return db.sequelize.transaction(async (transaction) => {
        const tenant = await db.Tenant.findByPk(normalizedTenantId, { transaction });
        if (!tenant) {
            throw createSupportError('Tenant not found', 404);
        }

        const customer = await resolveCustomer(normalizedTenantId, normalizedCustomerId, transaction);
        const category = await resolveCategoryOrNull(supportCategoryId, normalizedTenantId, transaction);

        const ticket = await db.SupportTicket.create({
            tenantId: normalizedTenantId,
            customerPlatformUserId: normalizedCustomerId,
            supportCategoryId: category ? category.id : null,
            assignedSupportAgentId: null,
            source: sourceValue,
            sourceChannel: sourceChannel || (sourceValue === 'mobile' ? 'customer_app' : 'tenant_dashboard'),
            status: 'open',
            priority: priorityValue,
            language: languageValue,
            subject: subjectText,
            subjectAr: subjectArText,
            description: descriptionText,
            descriptionAr: descriptionArText,
            metadata: {
                ...metadata,
                source: sourceValue,
                createdByActorType: actorContext.actorType,
                createdByActorId: actorContext.actorId || null
            }
        }, { transaction });

        if (Array.isArray(links) && links.length > 0) {
            const normalizedLinks = links
                .map((link) => ({
                    ticketId: ticket.id,
                    entityType: normalizeEntityType(link?.entityType || link?.type),
                    entityId: normalizeText(link?.entityId),
                    createdBy: actorContext.actorId || null
                }))
                .filter((link) => link.entityType && link.entityId);

            for (const link of normalizedLinks) {
                await db.SupportTicketLink.create(link, { transaction });
            }
        }

        const initialMessage = await db.SupportMessage.create({
            tenantId: normalizedTenantId,
            supportTicketId: ticket.id,
            replyToMessageId: null,
            senderType: actorContext.isCustomer ? 'customer' : 'support_agent',
            customerPlatformUserId: actorContext.isCustomer ? normalizedCustomerId : normalizedCustomerId,
            supportAgentId: actorContext.isCustomer ? null : actorContext.supportAgentId,
            content: firstMessageContent,
            language: languageValue,
            contentFormat: 'plain',
            visibility: 'public',
            isEdited: false,
            metadata: {
                source: 'ticket_created',
                subject: subjectText
            }
        }, { transaction });

        if (Array.isArray(attachments) && attachments.length > 0) {
            for (const file of attachments) {
                const fileCategory = ensureFileAttachmentAllowed(file);
                await db.SupportAttachment.create({
                    tenantId: normalizedTenantId,
                    supportTicketId: ticket.id,
                    supportMessageId: initialMessage.id,
                    uploadedByType: actorContext.isCustomer ? 'customer' : 'support_agent',
                    customerPlatformUserId: actorContext.isCustomer ? normalizedCustomerId : null,
                    supportAgentId: actorContext.isCustomer ? null : actorContext.supportAgentId,
                    fileName: path.basename(file.path || file.filename || file.originalname),
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    fileCategory,
                    storageProvider: 'local',
                    storagePath: file.path || file.filename || '',
                    storageUrl: file.path ? `/${file.path.replace(/\\/g, '/').replace(/^.*uploads\//i, 'uploads/')}` : null,
                    fileSize: Number(file.size || 0),
                    checksum: null,
                    caption: null,
                    isInline: false,
                    metadata: {
                        originalFieldName: file.fieldname || 'attachments'
                    }
                }, { transaction });
            }
        }

        const eventPayload = {
            action: 'ticket_created',
            ticketNumber: ticket.ticketNumber,
            subject: subjectText,
            links: Array.isArray(links) ? links : []
        };

        await createTicketEvent({
            ticket,
            eventType: 'ticket_created',
            actorType: actorContext.actorType,
            actorId: actorContext.actorId,
            messageId: initialMessage.id,
            fromStatus: null,
            toStatus: 'open',
            fromPriority: null,
            toPriority: priorityValue,
            payload: eventPayload,
            transaction
        });

        const recipients = buildRecipientListForTicketAction(ticket, actorContext, 'ticket_created');
        await createSupportNotificationEvents({
            ticket,
            eventType: 'ticket_created',
            recipients,
            payload: eventPayload,
            supportMessageId: initialMessage.id,
            transaction
        });

        await upsertReadState({
            ticket,
            participantType: 'customer',
            participantId: normalizedCustomerId,
            unreadCount: 0,
            lastReadMessageId: initialMessage.id,
            lastReadAt: new Date(),
            transaction
        });

        if (recipients.some((recipient) => recipient.recipientType === 'support_agent')) {
            await upsertReadState({
                ticket,
                participantType: 'support_agent',
                participantId: recipients.find((recipient) => recipient.recipientType === 'support_agent')?.recipientId || actorContext.supportAgentId || null,
                unreadCount: 1,
                transaction
            });
        } else {
            await upsertReadState({
                ticket,
                participantType: 'support_queue',
                participantId: null,
                unreadCount: 1,
                transaction
            });
        }

        const freshTicket = await getExistingTicketOrThrow(ticket.id, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        return normalizeTicket(freshTicket, actorContext);
    });
}

async function listTickets({
    actor,
    filters = {},
    pagination = {}
}) {
    const actorContext = getActorContext(actor);
    const { page, limit, offset } = pagination.page ? pagination : parsePage(filters);

    const where = {};
    if (actorContext.isCustomer) {
        where.customerPlatformUserId = actorContext.actorId;
    }

    if (filters.tenantId) {
        where.tenantId = normalizeText(filters.tenantId);
    }

    if (filters.status) {
        const statuses = `${filters.status}`.split(',').map((status) => normalizeText(status).toLowerCase()).filter(Boolean);
        if (statuses.length > 0) {
            where.status = statuses.length === 1 ? statuses[0] : { [Op.in]: statuses };
        }
    }

    if (filters.priority) {
        const priorities = `${filters.priority}`.split(',').map((priority) => normalizeText(priority).toLowerCase()).filter(Boolean);
        if (priorities.length > 0) {
            where.priority = priorities.length === 1 ? priorities[0] : { [Op.in]: priorities };
        }
    }

    if (filters.supportCategoryId) {
        where.supportCategoryId = normalizeText(filters.supportCategoryId);
    }

    if (filters.assignedSupportAgentId) {
        where.assignedSupportAgentId = normalizeText(filters.assignedSupportAgentId);
    }

    if (filters.source) {
        where.source = normalizeSource(filters.source);
    }

    if (filters.ticketNumber) {
        where.ticketNumber = { [Op.iLike]: `%${normalizeText(filters.ticketNumber)}%` };
    }

    const search = normalizeText(filters.search);
    if (search) {
        where[Op.or] = [
            { subject: { [Op.iLike]: `%${search}%` } },
            { subjectAr: { [Op.iLike]: `%${search}%` } },
            { description: { [Op.iLike]: `%${search}%` } },
            { descriptionAr: { [Op.iLike]: `%${search}%` } },
            { ticketNumber: { [Op.iLike]: `%${search}%` } }
        ];
    }

    if (actorContext.isSupportAgent && !actorContext.canAccessAllTickets) {
        where.assignedSupportAgentId = actorContext.supportAgentId;
    }

    const include = buildTicketInclude({
        includeMessages: false,
        includeEvents: false,
        includeNotificationEvents: false,
        includeReadStates: true,
        includeLinks: true
    });

    const { count, rows } = await db.SupportTicket.findAndCountAll({
        where,
        include,
        distinct: true,
        order: [['updatedAt', 'DESC']],
        limit,
        offset
    });

    const tickets = rows.map((ticket) => normalizeTicket(ticket, actorContext));
    return {
        tickets,
        pagination: {
            page,
            limit,
            total: count,
            totalPages: count > 0 ? Math.ceil(count / limit) : 0
        }
    };
}

async function getTicketDetails({ actor, ticketId }) {
    const actorContext = getActorContext(actor);
    const ticket = await getExistingTicketOrThrow(ticketId, actorContext, {
        includeMessages: true,
        includeEvents: true,
        includeNotificationEvents: true,
        includeReadStates: true,
        includeLinks: true
    });

    return normalizeTicket(ticket, actorContext);
}

async function replyToTicket({
    actor,
    ticketId,
    content,
    visibility = 'public',
    replyToMessageId = null,
    attachments = []
}) {
    const actorContext = getActorContext(actor);
    const normalizedContent = ensureContentLength(content);
    const visibilityValue = actorContext.isCustomer ? 'public' : normalizeVisibility(visibility);

    return db.sequelize.transaction(async (transaction) => {
        const ticket = await getExistingTicketOrThrow(ticketId, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        const ticketJson = typeof ticket.toJSON === 'function' ? ticket.toJSON() : ticket;
        const replyTarget = replyToMessageId
            ? (Array.isArray(ticketJson.messages)
                ? ticketJson.messages.find((message) => String(message.id) === String(replyToMessageId))
                : null)
            : null;

        if (replyToMessageId && !replyTarget) {
            throw createSupportError('Reply target message not found on this ticket', 404);
        }

        if (actorContext.isCustomer && replyTarget && replyTarget.visibility === 'internal') {
            throw createSupportError('Customers cannot reply to internal messages', 403);
        }

        const message = await db.SupportMessage.create({
            tenantId: ticket.tenantId,
            supportTicketId: ticket.id,
            replyToMessageId: replyToMessageId || null,
            senderType: actorContext.isCustomer ? 'customer' : 'support_agent',
            customerPlatformUserId: actorContext.isCustomer ? actorContext.actorId : ticket.customerPlatformUserId,
            supportAgentId: actorContext.isCustomer ? null : actorContext.supportAgentId,
            content: normalizedContent,
            language: ticket.language,
            contentFormat: 'plain',
            visibility: visibilityValue,
            isEdited: false,
            metadata: {
                source: 'reply',
                replyToMessageId: replyToMessageId || null
            }
        }, { transaction });

        const attachmentRows = [];
        for (const file of attachments || []) {
            const fileCategory = ensureFileAttachmentAllowed(file);
            const attachment = await db.SupportAttachment.create({
                tenantId: ticket.tenantId,
                supportTicketId: ticket.id,
                supportMessageId: message.id,
                uploadedByType: actorContext.isCustomer ? 'customer' : 'support_agent',
                customerPlatformUserId: actorContext.isCustomer ? actorContext.actorId : null,
                supportAgentId: actorContext.isCustomer ? null : actorContext.supportAgentId,
                fileName: path.basename(file.path || file.filename || file.originalname),
                originalName: file.originalname,
                mimeType: file.mimetype,
                fileCategory,
                storageProvider: 'local',
                storagePath: file.path || file.filename || '',
                storageUrl: file.path ? `/${file.path.replace(/\\/g, '/').replace(/^.*uploads\//i, 'uploads/')}` : null,
                fileSize: Number(file.size || 0),
                checksum: null,
                caption: null,
                isInline: false,
                metadata: {
                    originalFieldName: file.fieldname || 'attachments'
                }
            }, { transaction });
            attachmentRows.push(attachment);
        }

        await ticket.update({
            lastMessageAt: new Date(),
            status: ticket.status === 'draft' ? 'open' : ticket.status
        }, { transaction });

        await createTicketEvent({
            ticket,
            eventType: 'reply_added',
            actorType: actorContext.actorType,
            actorId: actorContext.actorId,
            messageId: message.id,
            fromStatus: ticket.status,
            toStatus: ticket.status === 'draft' ? 'open' : ticket.status,
            payload: {
                visibility: visibilityValue,
                attachmentCount: attachmentRows.length
            },
            transaction
        });

        if (attachmentRows.length > 0) {
            await createTicketEvent({
                ticket,
                eventType: 'attachment_added',
                actorType: actorContext.actorType,
                actorId: actorContext.actorId,
                messageId: message.id,
                payload: {
                    attachmentCount: attachmentRows.length,
                    attachmentIds: attachmentRows.map((item) => item.id)
                },
                transaction
            });
        }

        const recipients = buildRecipientListForTicketAction(ticket, actorContext, 'reply_added');
        await createSupportNotificationEvents({
            ticket,
            eventType: 'reply_added',
            recipients,
            payload: {
                messageId: message.id,
                visibility: visibilityValue
            },
            supportMessageId: message.id,
            transaction
        });

        if (actorContext.isCustomer) {
            await upsertReadState({
                ticket,
                participantType: 'customer',
                participantId: actorContext.actorId,
                unreadCount: 0,
                lastReadMessageId: message.id,
                lastReadAt: new Date(),
                transaction
            });

            if (ticket.assignedSupportAgentId) {
                await adjustReadStateUnreadCount({
                    ticket,
                    participantType: 'support_agent',
                    participantId: ticket.assignedSupportAgentId,
                    delta: 1,
                    transaction
                });
            } else {
                await adjustReadStateUnreadCount({
                    ticket,
                    participantType: 'support_queue',
                    participantId: null,
                    delta: 1,
                    transaction
                });
            }
        } else {
            await upsertReadState({
                ticket,
                participantType: 'support_agent',
                participantId: actorContext.supportAgentId,
                unreadCount: 0,
                lastReadMessageId: message.id,
                lastReadAt: new Date(),
                transaction
            });

            await adjustReadStateUnreadCount({
                ticket,
                participantType: 'customer',
                participantId: ticket.customerPlatformUserId,
                delta: 1,
                transaction
            });
        }

        const freshTicket = await getExistingTicketOrThrow(ticket.id, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        return {
            ticket: normalizeTicket(freshTicket, actorContext),
            message: normalizeMessage(message, actorContext),
            attachments: attachmentRows.map(normalizeAttachment)
        };
    });
}

async function uploadAttachmentsToTicket({
    actor,
    ticketId,
    supportMessageId,
    files = []
}) {
    const actorContext = getActorContext(actor);
    if (!supportMessageId) {
        throw createSupportError('supportMessageId is required for attachments', 400);
    }

    return db.sequelize.transaction(async (transaction) => {
        const ticket = await getExistingTicketOrThrow(ticketId, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        const ticketJson = typeof ticket.toJSON === 'function' ? ticket.toJSON() : ticket;
        const message = Array.isArray(ticketJson.messages)
            ? ticketJson.messages.find((item) => String(item.id) === String(supportMessageId))
            : null;

        if (!message) {
            throw createSupportError('Support message not found on this ticket', 404);
        }

        if (actorContext.isCustomer && message.visibility === 'internal') {
            throw createSupportError('Customers cannot attach files to internal messages', 403);
        }

        const attachmentRows = [];
        for (const file of files || []) {
            const fileCategory = ensureFileAttachmentAllowed(file);
            const attachment = await db.SupportAttachment.create({
                tenantId: ticket.tenantId,
                supportTicketId: ticket.id,
                supportMessageId: message.id,
                uploadedByType: actorContext.isCustomer ? 'customer' : 'support_agent',
                customerPlatformUserId: actorContext.isCustomer ? actorContext.actorId : null,
                supportAgentId: actorContext.isCustomer ? null : actorContext.supportAgentId,
                fileName: path.basename(file.path || file.filename || file.originalname),
                originalName: file.originalname,
                mimeType: file.mimetype,
                fileCategory,
                storageProvider: 'local',
                storagePath: file.path || file.filename || '',
                storageUrl: file.path ? `/${file.path.replace(/\\/g, '/').replace(/^.*uploads\//i, 'uploads/')}` : null,
                fileSize: Number(file.size || 0),
                checksum: null,
                caption: null,
                isInline: false,
                metadata: {
                    originalFieldName: file.fieldname || 'files'
                }
            }, { transaction });
            attachmentRows.push(attachment);
        }

        if (attachmentRows.length > 0) {
            await createTicketEvent({
                ticket,
                eventType: 'attachment_added',
                actorType: actorContext.actorType,
                actorId: actorContext.actorId,
                messageId: message.id,
                payload: {
                    attachmentCount: attachmentRows.length,
                    attachmentIds: attachmentRows.map((item) => item.id)
                },
                transaction
            });

            const recipients = buildRecipientListForTicketAction(ticket, actorContext, 'reply_added');
            await createSupportNotificationEvents({
                ticket,
                eventType: 'attachment_added',
                recipients,
                payload: {
                    messageId: message.id,
                    attachmentCount: attachmentRows.length
                },
                supportMessageId: message.id,
                transaction
            });
        }

        const freshTicket = await getExistingTicketOrThrow(ticket.id, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        return {
            ticket: normalizeTicket(freshTicket, actorContext),
            attachments: attachmentRows.map(normalizeAttachment)
        };
    });
}

async function assignTicket({ actor, ticketId, supportAgentId }) {
    const actorContext = getActorContext(actor);
    if (!actorContext.isSupportAgent && !actorContext.isSuperAdmin) {
        throw createSupportError('Only support agents can assign tickets', 403);
    }

    return db.sequelize.transaction(async (transaction) => {
        const ticket = await getExistingTicketOrThrow(ticketId, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        const targetSupportAgent = await resolveSupportAgentById(supportAgentId, transaction);
        const previousSupportAgentId = ticket.assignedSupportAgentId || null;

        await ticket.update({
            assignedSupportAgentId: targetSupportAgent.id
        }, { transaction });

        await createTicketEvent({
            ticket,
            eventType: 'assigned',
            actorType: actorContext.actorType,
            actorId: actorContext.actorId,
            fromStatus: ticket.status,
            toStatus: ticket.status,
            payload: {
                previousSupportAgentId,
                supportAgentId: targetSupportAgent.id
            },
            transaction
        });

        await createSupportNotificationEvents({
            ticket,
            eventType: 'assigned',
            recipients: [
                { recipientType: 'support_agent', recipientId: targetSupportAgent.id },
                { recipientType: 'customer', recipientId: ticket.customerPlatformUserId }
            ],
            payload: {
                previousSupportAgentId,
                supportAgentId: targetSupportAgent.id
            },
            transaction
        });

        const freshTicket = await getExistingTicketOrThrow(ticket.id, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        return normalizeTicket(freshTicket, actorContext);
    });
}

async function unassignTicket({ actor, ticketId }) {
    const actorContext = getActorContext(actor);
    if (!actorContext.isSupportAgent && !actorContext.isSuperAdmin) {
        throw createSupportError('Only support agents can unassign tickets', 403);
    }

    return db.sequelize.transaction(async (transaction) => {
        const ticket = await getExistingTicketOrThrow(ticketId, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        const previousSupportAgentId = ticket.assignedSupportAgentId || null;
        await ticket.update({
            assignedSupportAgentId: null
        }, { transaction });

        await createTicketEvent({
            ticket,
            eventType: 'assigned',
            actorType: actorContext.actorType,
            actorId: actorContext.actorId,
            fromStatus: ticket.status,
            toStatus: ticket.status,
            payload: {
                previousSupportAgentId,
                supportAgentId: null,
                unassigned: true
            },
            transaction
        });

        await createSupportNotificationEvents({
            ticket,
            eventType: 'assigned',
            recipients: [
                { recipientType: 'support_queue', recipientId: null },
                { recipientType: 'customer', recipientId: ticket.customerPlatformUserId }
            ],
            payload: {
                previousSupportAgentId,
                supportAgentId: null,
                unassigned: true
            },
            transaction
        });

        const freshTicket = await getExistingTicketOrThrow(ticket.id, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        return normalizeTicket(freshTicket, actorContext);
    });
}

async function changeTicketStatus({ actor, ticketId, status }) {
    const actorContext = getActorContext(actor);
    if (!actorContext.isSupportAgent && !actorContext.isSuperAdmin) {
        throw createSupportError('Only support agents can change status', 403);
    }

    const nextStatus = normalizeStatus(status);

    return db.sequelize.transaction(async (transaction) => {
        const ticket = await getExistingTicketOrThrow(ticketId, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        const currentStatus = `${ticket.status || 'open'}`.toLowerCase();
        if (!getStatusTransitionAllowed(currentStatus, nextStatus)) {
            throw createSupportError(`Cannot change status from ${currentStatus} to ${nextStatus}`, 400);
        }

        const updatePayload = { status: nextStatus };
        if (nextStatus === 'resolved') {
            updatePayload.resolvedAt = new Date();
        }
        if (nextStatus === 'closed') {
            updatePayload.closedAt = new Date();
        }
        if (nextStatus === 'reopened') {
            updatePayload.reopenedAt = new Date();
        }

        await ticket.update(updatePayload, { transaction });

        const eventType = nextStatus === 'closed' ? 'closed' : (nextStatus === 'reopened' ? 'reopened' : 'status_changed');
        await createTicketEvent({
            ticket,
            eventType,
            actorType: actorContext.actorType,
            actorId: actorContext.actorId,
            fromStatus: currentStatus,
            toStatus: nextStatus,
            payload: {
                status: nextStatus
            },
            transaction
        });

        await createSupportNotificationEvents({
            ticket,
            eventType,
            recipients: buildRecipientListForTicketAction(ticket, actorContext, eventType),
            payload: {
                status: nextStatus
            },
            transaction
        });

        const freshTicket = await getExistingTicketOrThrow(ticket.id, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        return normalizeTicket(freshTicket, actorContext);
    });
}

async function changeTicketPriority({ actor, ticketId, priority }) {
    const actorContext = getActorContext(actor);
    if (!actorContext.isSupportAgent && !actorContext.isSuperAdmin) {
        throw createSupportError('Only support agents can change priority', 403);
    }

    const nextPriority = normalizePriority(priority);

    return db.sequelize.transaction(async (transaction) => {
        const ticket = await getExistingTicketOrThrow(ticketId, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        const previousPriority = ticket.priority;
        await ticket.update({ priority: nextPriority }, { transaction });

        await createTicketEvent({
            ticket,
            eventType: 'priority_changed',
            actorType: actorContext.actorType,
            actorId: actorContext.actorId,
            fromPriority: previousPriority,
            toPriority: nextPriority,
            payload: {
                priority: nextPriority
            },
            transaction
        });

        await createSupportNotificationEvents({
            ticket,
            eventType: 'priority_changed',
            recipients: buildRecipientListForTicketAction(ticket, actorContext, 'priority_changed'),
            payload: {
                priority: nextPriority
            },
            transaction
        });

        const freshTicket = await getExistingTicketOrThrow(ticket.id, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        return normalizeTicket(freshTicket, actorContext);
    });
}

async function changeTicketCategory({ actor, ticketId, supportCategoryId }) {
    const actorContext = getActorContext(actor);
    if (!actorContext.isSupportAgent && !actorContext.isSuperAdmin) {
        throw createSupportError('Only support agents can change category', 403);
    }

    return db.sequelize.transaction(async (transaction) => {
        const ticket = await getExistingTicketOrThrow(ticketId, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        const category = await resolveCategoryOrNull(supportCategoryId, ticket.tenantId, transaction);
        const previousCategoryId = ticket.supportCategoryId || null;
        await ticket.update({
            supportCategoryId: category ? category.id : null
        }, { transaction });

        await createTicketEvent({
            ticket,
            eventType: 'category_changed',
            actorType: actorContext.actorType,
            actorId: actorContext.actorId,
            payload: {
                previousCategoryId,
                supportCategoryId: category ? category.id : null
            },
            transaction
        });

        await createSupportNotificationEvents({
            ticket,
            eventType: 'category_changed',
            recipients: buildRecipientListForTicketAction(ticket, actorContext, 'category_changed'),
            payload: {
                previousCategoryId,
                supportCategoryId: category ? category.id : null
            },
            transaction
        });

        const freshTicket = await getExistingTicketOrThrow(ticket.id, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        return normalizeTicket(freshTicket, actorContext);
    });
}

async function reopenTicket({ actor, ticketId }) {
    return changeTicketStatus({ actor, ticketId, status: 'reopened' });
}

async function closeTicket({ actor, ticketId }) {
    return changeTicketStatus({ actor, ticketId, status: 'closed' });
}

async function markTicketRead({ actor, ticketId }) {
    const actorContext = getActorContext(actor);

    return db.sequelize.transaction(async (transaction) => {
        const ticket = await getExistingTicketOrThrow(ticketId, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        const ticketJson = typeof ticket.toJSON === 'function' ? ticket.toJSON() : ticket;
        const visibleMessages = Array.isArray(ticketJson.messages)
            ? ticketJson.messages.filter((message) => actorContext.isCustomer ? message.visibility !== 'internal' : true)
            : [];
        const lastVisibleMessage = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;

        if (actorContext.isCustomer) {
            await upsertReadState({
                ticket,
                participantType: 'customer',
                participantId: actorContext.actorId,
                unreadCount: 0,
                lastReadMessageId: lastVisibleMessage?.id || null,
                lastReadAt: new Date(),
                transaction
            });
        } else {
            await upsertReadState({
                ticket,
                participantType: 'support_agent',
                participantId: actorContext.supportAgentId,
                unreadCount: 0,
                lastReadMessageId: lastVisibleMessage?.id || null,
                lastReadAt: new Date(),
                transaction
            });

            await upsertReadState({
                ticket,
                participantType: 'support_queue',
                participantId: null,
                unreadCount: 0,
                lastReadMessageId: lastVisibleMessage?.id || null,
                lastReadAt: new Date(),
                transaction
            });
        }

        await createTicketEvent({
            ticket,
            eventType: 'reply_added',
            actorType: actorContext.actorType,
            actorId: actorContext.actorId,
            payload: {
                action: 'mark_read'
            },
            transaction
        });

        const freshTicket = await getExistingTicketOrThrow(ticket.id, actorContext, {
            includeMessages: true,
            includeEvents: true,
            includeNotificationEvents: true,
            includeReadStates: true,
            includeLinks: true,
            transaction
        });

        return normalizeTicket(freshTicket, actorContext);
    });
}

module.exports = {
    SupportError,
    normalizeSource,
    normalizeVisibility,
    normalizePriority,
    normalizeStatus,
    normalizeEntityType,
    parsePage,
    ensureContentLength,
    ensureSubjectLength,
    createSupportError,
    createTicket,
    listTickets,
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
    markTicketRead,
    getExistingTicketOrThrow,
    getActorContext,
    normalizeTicket,
    normalizeMessage,
    normalizeAttachment,
    normalizeNotificationEvent,
    normalizeTicketEvent,
    ensureFileAttachmentAllowed
};
