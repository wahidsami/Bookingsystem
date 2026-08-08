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

function isUuidLike(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(`${value || ''}`.trim());
}

function ensureUuidLike(value, fieldName) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return normalized;
    }

    if (!isUuidLike(normalized)) {
        throw createSupportError(`${fieldName} must be a valid UUID`, 400);
    }

    return normalized;
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

function ensureFileAttachmentAllowed(file, options = {}) {
    const { validateSize = true } = options || {};
    const fileSize = Number(file?.size);

    if (validateSize) {
        if (!Number.isFinite(fileSize) || fileSize <= 0) {
            throw createSupportError('Attachment file is empty or invalid', 400);
        }

        if (fileSize > ATTACHMENT_MAX_SIZE_BYTES) {
            throw createSupportError('Attachment exceeds the maximum allowed size', 400);
        }
    } else if (Number.isFinite(fileSize) && fileSize > ATTACHMENT_MAX_SIZE_BYTES) {
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

function normalizeSupportAgent(supportAgent) {
    const json = typeof supportAgent?.toJSON === 'function' ? supportAgent.toJSON() : (supportAgent || {});
    return {
        id: json.id,
        superAdminId: json.superAdminId || null,
        displayName: json.displayName || null,
        displayNameAr: json.displayNameAr || null,
        title: json.title || null,
        avatarUrl: json.avatarUrl || null,
        status: json.status || null,
        presenceStatus: json.presenceStatus || null,
        supportedLanguages: Array.isArray(json.supportedLanguages) ? json.supportedLanguages : [],
        skills: Array.isArray(json.skills) ? json.skills : [],
        metadata: json.metadata || {},
        lastSeenAt: json.lastSeenAt || null,
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null
    };
}

function normalizeTenantSummary(tenant) {
    const json = typeof tenant?.toJSON === 'function' ? tenant.toJSON() : (tenant || {});
    return {
        id: json.id,
        name: json.name || null,
        name_en: json.name_en || null,
        name_ar: json.name_ar || null,
        nameAr: json.nameAr || null,
        slug: json.slug || null,
        email: json.email || null,
        phone: json.phone || null,
        mobile: json.mobile || null,
        logo: json.logo || null,
        status: json.status || null,
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null
    };
}

function buildPersonName({ firstName = null, lastName = null, email = null, fallback = null } = {}) {
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return fullName || email || fallback || null;
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
        customer: json.customer ? {
            id: json.customer.id,
            firstName: json.customer.firstName || null,
            lastName: json.customer.lastName || null,
            email: json.customer.email || null,
            phone: json.customer.phone || null,
            profileImage: json.customer.profileImage || null
        } : null,
        supportAgent: json.supportAgent ? normalizeSupportAgent(json.supportAgent) : null,
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
    const senderType = normalizeText(json.senderType).toLowerCase() || 'system';
    const customer = json.customer ? {
        id: json.customer.id,
        firstName: json.customer.firstName || null,
        lastName: json.customer.lastName || null,
        email: json.customer.email || null,
        phone: json.customer.phone || null,
        profileImage: json.customer.profileImage || null
    } : null;
    const supportAgent = json.supportAgent ? normalizeSupportAgent(json.supportAgent) : null;
    const senderRole = senderType === 'support_agent'
        ? (supportAgent?.superAdminId ? 'support_agent' : 'tenant_admin')
        : senderType;
    const senderId = senderType === 'customer'
        ? (json.customerPlatformUserId || customer?.id || null)
        : senderType === 'support_agent'
            ? (json.supportAgentId || supportAgent?.id || null)
            : null;
    const senderName = senderType === 'customer'
        ? buildPersonName({
            firstName: customer?.firstName,
            lastName: customer?.lastName,
            email: customer?.email,
            fallback: 'Customer'
        })
        : senderType === 'support_agent'
            ? (supportAgent?.displayNameAr || supportAgent?.displayName || supportAgent?.title || (supportAgent?.superAdminId ? 'Support Agent' : 'Tenant Admin'))
            : senderType === 'ai'
                ? 'AI'
                : 'System';

    return {
        id: json.id,
        tenantId: json.tenantId,
        supportTicketId: json.supportTicketId,
        replyToMessageId: json.replyToMessageId || null,
        senderType,
        senderRole,
        senderId,
        senderName,
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
        customer,
        supportAgent,
        isOwnMessage: (() => {
            if (senderType === 'customer') {
                return Boolean(actorContext.isCustomer && actorContext.actorId && String(actorContext.actorId) === String(json.customerPlatformUserId || customer?.id || ''));
            }

            if (senderType === 'support_agent') {
                return Boolean(actorContext.supportAgentId && String(actorContext.supportAgentId) === String(json.supportAgentId || supportAgent?.id || ''));
            }

            return false;
        })(),
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null
    };
}

function normalizeSupportCategory(category) {
    const json = typeof category?.toJSON === 'function' ? category.toJSON() : (category || {});
    return {
        id: json.id,
        tenantId: json.tenantId || null,
        parentId: json.parentId || null,
        slug: json.slug,
        scope: json.scope,
        name: json.name,
        nameAr: json.nameAr || null,
        description: json.description || null,
        descriptionAr: json.descriptionAr || null,
        icon: json.icon || null,
        color: json.color || null,
        featureKey: json.featureKey || null,
        featureRoute: json.featureRoute || null,
        sortOrder: Number(json.sortOrder || 0),
        isActive: Boolean(json.isActive),
        metadata: json.metadata || {},
        createdAt: json.createdAt || null,
        updatedAt: json.updatedAt || null,
        deletedAt: json.deletedAt || null
    };
}

function buildSupportCategoryTree(rows = []) {
    const nodeMap = new Map();
    const orderedRoots = [];

    rows
        .map((row) => normalizeSupportCategory(row))
        .sort((left, right) => {
            const leftParent = left.parentId || '';
            const rightParent = right.parentId || '';
            if (leftParent !== rightParent) {
                return leftParent.localeCompare(rightParent);
            }

            if (left.sortOrder !== right.sortOrder) {
                return left.sortOrder - right.sortOrder;
            }

            return `${left.name || ''}`.localeCompare(`${right.name || ''}`);
        })
        .forEach((node) => {
            node.children = [];
            nodeMap.set(node.id, node);
        });

    nodeMap.forEach((node) => {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId).children.push(node);
            return;
        }

        orderedRoots.push(node);
    });

    const sortRecursive = (nodes) => nodes
        .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) {
                return left.sortOrder - right.sortOrder;
            }

            return `${left.name || ''}`.localeCompare(`${right.name || ''}`);
        })
        .map((node) => ({
            ...node,
            children: sortRecursive(Array.isArray(node.children) ? node.children : [])
        }));

    return sortRecursive(orderedRoots);
}

function flattenSupportCategoryTree(nodes = [], bucket = []) {
    for (const node of nodes) {
        bucket.push(node);
        if (Array.isArray(node.children) && node.children.length > 0) {
            flattenSupportCategoryTree(node.children, bucket);
        }
    }
    return bucket;
}

async function collectSupportCategoryIds(categoryId, transaction) {
    if (!categoryId) {
        return [];
    }

    const rows = await db.SupportCategory.findAll({
        where: {
            isActive: true
        },
        attributes: ['id', 'parentId'],
        transaction
    });

    const childrenByParent = new Map();
    rows.forEach((row) => {
        const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
        const parentKey = json.parentId || null;
        if (!childrenByParent.has(parentKey)) {
            childrenByParent.set(parentKey, []);
        }
        childrenByParent.get(parentKey).push(json.id);
    });

    const collected = new Set();
    const stack = [categoryId];

    while (stack.length > 0) {
        const currentId = stack.pop();
        if (!currentId || collected.has(currentId)) {
            continue;
        }

        collected.add(currentId);
        const childIds = childrenByParent.get(currentId) || [];
        childIds.forEach((childId) => stack.push(childId));
    }

    return Array.from(collected);
}

function sanitizeSupportCategorySlug(value) {
    return `${value || ''}`
        .trim()
        .toLowerCase()
        .replace(/[&]/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
}

async function generateUniqueSupportCategorySlug(baseValue, transaction, excludeId = null) {
    const normalizedBase = sanitizeSupportCategorySlug(baseValue) || 'support-category';
    let candidate = normalizedBase;
    let counter = 1;

    while (true) {
        const existing = await db.SupportCategory.findOne({
            where: {
                slug: candidate,
                ...(excludeId ? { id: { [Op.ne]: excludeId } } : {})
            },
            transaction,
            paranoid: false
        });

        if (!existing) {
            return candidate;
        }

        counter += 1;
        candidate = `${normalizedBase}-${counter}`;
    }
}

function getSupportCategoryDisplayPath(category, categoryMap) {
    if (!category) return null;

    const segments = [];
    let current = category;
    const seen = new Set();

    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        segments.unshift(current.nameAr || current.name || current.slug || current.id);
        current = current.parentId ? categoryMap.get(current.parentId) : null;
    }

    return segments.join(' / ');
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
    const tenant = json.tenant ? normalizeTenantSummary(json.tenant) : null;
    const ticketCreatedEvent = Array.isArray(json.events)
        ? json.events.find((event) => `${event.eventType || ''}` === 'ticket_created')
        : null;
    const createdByActorType = normalizeText(json.metadata?.createdByActorType).toLowerCase();
    const createdByActorId = json.metadata?.createdByActorId || null;
    const requesterSupportAgent = ticketCreatedEvent?.supportAgent ? normalizeSupportAgent(ticketCreatedEvent.supportAgent) : null;
    const requester = (() => {
        if (createdByActorType === 'customer' && json.customer) {
            return {
                id: json.customer.id,
                type: 'customer',
                actorType: 'customer',
                name: buildPersonName({
                    firstName: json.customer.firstName,
                    lastName: json.customer.lastName,
                    email: json.customer.email,
                    fallback: 'Customer'
                }),
                email: json.customer.email || null,
                phone: json.customer.phone || null,
                profileImage: json.customer.profileImage || null
            };
        }

        if (createdByActorType === 'support_agent') {
            const requesterType = requesterSupportAgent
                ? (requesterSupportAgent.superAdminId ? 'support_agent' : 'tenant_admin')
                : 'support_agent';

            return {
                id: requesterSupportAgent?.id || createdByActorId || null,
                type: requesterType,
                actorType: 'support_agent',
                name: requesterSupportAgent?.displayNameAr || requesterSupportAgent?.displayName || requesterSupportAgent?.title || null,
                title: requesterSupportAgent?.title || null,
                avatarUrl: requesterSupportAgent?.avatarUrl || null,
                superAdminId: requesterSupportAgent?.superAdminId || null,
                tenantId: requesterSupportAgent?.metadata?.tenantId || tenant?.id || json.tenantId || null,
                metadata: requesterSupportAgent?.metadata || {},
                createdAt: requesterSupportAgent?.createdAt || null,
                updatedAt: requesterSupportAgent?.updatedAt || null
            };
        }

        if (json.customer) {
            return {
                id: json.customer.id,
                type: 'customer',
                actorType: 'customer',
                name: buildPersonName({
                    firstName: json.customer.firstName,
                    lastName: json.customer.lastName,
                    email: json.customer.email,
                    fallback: 'Customer'
                }),
                email: json.customer.email || null,
                phone: json.customer.phone || null,
                profileImage: json.customer.profileImage || null
            };
        }

        if (createdByActorId || createdByActorType) {
            return {
                id: createdByActorId || null,
                type: createdByActorType || null,
                actorType: createdByActorType || null
            };
        }

        return null;
    })();

    const normalized = {
        id: json.id,
        ticketNumber: json.ticketNumber,
        tenantId: json.tenantId,
        tenant,
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
        requester,
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
            parentId: json.category.parentId || null,
            slug: json.category.slug,
            scope: json.category.scope,
            name: json.category.name,
            nameAr: json.category.nameAr || null,
            description: json.category.description || null,
            descriptionAr: json.category.descriptionAr || null,
            icon: json.category.icon || null,
            color: json.category.color || null,
            featureKey: json.category.featureKey || null,
            featureRoute: json.category.featureRoute || null,
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
            model: db.Tenant,
            as: 'tenant',
            attributes: ['id', 'name', 'name_en', 'name_ar', 'nameAr', 'slug', 'email', 'phone', 'mobile', 'logo', 'status']
        },
        {
            model: db.PlatformUser,
            as: 'customer',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage']
        },
        {
            model: db.SupportCategory,
            as: 'category',
            attributes: ['id', 'parentId', 'slug', 'scope', 'name', 'nameAr', 'description', 'descriptionAr', 'icon', 'color', 'featureKey', 'featureRoute', 'sortOrder', 'isActive']
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
            attributes: ['id', 'tenantId', 'supportTicketId', 'supportMessageId', 'supportAttachmentId', 'actorType', 'customerPlatformUserId', 'supportAgentId', 'eventType', 'fromStatus', 'toStatus', 'fromPriority', 'toPriority', 'payload', 'occurredAt', 'createdAt', 'updatedAt'],
            include: [
                {
                    model: db.PlatformUser,
                    as: 'customer',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage']
                },
                {
                    model: db.SupportAgent,
                    as: 'supportAgent',
                    attributes: ['id', 'superAdminId', 'displayName', 'displayNameAr', 'title', 'avatarUrl', 'status', 'presenceStatus', 'metadata', 'createdAt', 'updatedAt']
                }
            ]
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
                    model: db.PlatformUser,
                    as: 'customer',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'profileImage']
                },
                {
                    model: db.SupportAgent,
                    as: 'supportAgent',
                    attributes: ['id', 'superAdminId', 'displayName', 'displayNameAr', 'title', 'avatarUrl', 'status', 'presenceStatus', 'metadata', 'createdAt', 'updatedAt']
                },
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
    if (actorContext.tenantId && ticketJson.tenantId !== actorContext.tenantId) {
        throw createSupportError('You do not have access to this ticket', 403);
    }

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

async function listCategories({ actor, filters = {} }) {
    const actorContext = getActorContext(actor);
    const where = {
        isActive: true
    };

    if (filters.scope) {
        const scope = `${filters.scope}`.trim().toLowerCase();
        if (scope === 'global' || scope === 'tenant') {
            where.scope = scope;
        }
    }

    if (actorContext.tenantId) {
        where[Op.or] = [
            { scope: 'global' },
            { tenantId: actorContext.tenantId }
        ];
    }

    const rows = await db.SupportCategory.findAll({
        where,
        order: [['sortOrder', 'ASC'], ['name', 'ASC']]
    });

    const tree = buildSupportCategoryTree(rows);
    return {
        categories: rows.map(normalizeSupportCategory),
        tree,
        modules: tree,
        flatCategories: flattenSupportCategoryTree(tree)
    };
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

async function resolveCategoryOrNull(categoryId, tenantId, transaction, options = {}) {
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

    if (options.requireLeaf !== false) {
        const childCount = await db.SupportCategory.count({
            where: {
                parentId: category.id,
                isActive: true
            },
            transaction
        });

        if (childCount > 0) {
            throw createSupportError('Please select a feature category instead of a module category', 400);
        }
    }

    return category;
}

async function createSupportCategory({ actor, payload = {} }) {
    const actorContext = getActorContext(actor);
    if (!actorContext.isSuperAdmin) {
        throw createSupportError('Only super admins can manage support taxonomy', 403);
    }

    const name = ensureSubjectLength(payload.name || payload.nameEn || payload.name_en || payload.title || '');
    const nameAr = normalizeOptionalText(payload.nameAr || payload.name_ar);
    const featureKey = normalizeOptionalText(payload.featureKey || payload.feature_key);
    const featureRoute = normalizeOptionalText(payload.featureRoute || payload.feature_route);
    const icon = normalizeOptionalText(payload.icon);
    const description = normalizeOptionalText(payload.description);
    const descriptionAr = normalizeOptionalText(payload.descriptionAr || payload.description_ar);
    const parentId = normalizeOptionalText(payload.parentId);
    const scope = normalizeText(payload.scope).toLowerCase() === 'tenant' ? 'tenant' : 'global';
    const tenantId = scope === 'tenant' ? normalizeOptionalText(payload.tenantId) || actorContext.tenantId || null : null;
    const isActive = payload.isActive !== undefined ? Boolean(payload.isActive) : true;
    const color = normalizeOptionalText(payload.color);

    return db.sequelize.transaction(async (transaction) => {
        const parent = parentId
            ? await db.SupportCategory.findByPk(parentId, { transaction })
            : null;

        if (parentId && !parent) {
            throw createSupportError('Parent support category not found', 404);
        }

        const baseSlug = featureKey || name;
        const slug = await generateUniqueSupportCategorySlug(baseSlug, transaction);
        const siblingWhere = {
            parentId: parent ? parent.id : null,
            scope,
            tenantId: tenantId || null
        };
        const maxSortOrder = await db.SupportCategory.max('sortOrder', {
            where: siblingWhere,
            transaction
        });

        const category = await db.SupportCategory.create({
            tenantId,
            parentId: parent ? parent.id : null,
            slug,
            scope,
            name,
            nameAr,
            description,
            descriptionAr,
            icon,
            color,
            featureKey: featureKey || slug,
            featureRoute,
            sortOrder: payload.sortOrder !== undefined && payload.sortOrder !== null
                ? Number(payload.sortOrder)
                : Number(maxSortOrder || 0) + 1,
            isActive,
            metadata: normalizeOptionalText(payload.metadata) ? payload.metadata : (payload.metadata || {})
        }, { transaction });

        return normalizeSupportCategory(category);
    });
}

async function updateSupportCategory({ actor, categoryId, payload = {} }) {
    const actorContext = getActorContext(actor);
    if (!actorContext.isSuperAdmin) {
        throw createSupportError('Only super admins can manage support taxonomy', 403);
    }

    return db.sequelize.transaction(async (transaction) => {
        const category = await db.SupportCategory.findByPk(categoryId, { transaction });
        if (!category) {
            throw createSupportError('Support category not found', 404);
        }

        const nextParentId = payload.parentId === undefined
            ? category.parentId
            : (payload.parentId ? payload.parentId : null);

        if (nextParentId && String(nextParentId) === String(category.id)) {
            throw createSupportError('A category cannot be its own parent', 400);
        }

        if (nextParentId) {
            const parent = await db.SupportCategory.findByPk(nextParentId, { transaction });
            if (!parent) {
                throw createSupportError('Parent support category not found', 404);
            }
            category.parentId = parent.id;
            category.scope = parent.scope;
            category.tenantId = parent.tenantId || null;
        } else if (payload.parentId !== undefined) {
            category.parentId = null;
            if (payload.scope !== undefined) {
                category.scope = normalizeText(payload.scope).toLowerCase() === 'tenant' ? 'tenant' : 'global';
                if (category.scope === 'global') {
                    category.tenantId = null;
                }
            }
        }

        if (payload.name !== undefined || payload.nameEn !== undefined || payload.name_en !== undefined) {
            const nextName = ensureSubjectLength(payload.name || payload.nameEn || payload.name_en || '');
            category.name = nextName;
        }
        if (payload.nameAr !== undefined || payload.name_ar !== undefined) {
            category.nameAr = normalizeOptionalText(payload.nameAr || payload.name_ar);
        }
        if (payload.description !== undefined) {
            category.description = normalizeOptionalText(payload.description);
        }
        if (payload.descriptionAr !== undefined || payload.description_ar !== undefined) {
            category.descriptionAr = normalizeOptionalText(payload.descriptionAr || payload.description_ar);
        }
        if (payload.icon !== undefined) {
            category.icon = normalizeOptionalText(payload.icon);
        }
        if (payload.color !== undefined) {
            category.color = normalizeOptionalText(payload.color);
        }
        if (payload.featureKey !== undefined || payload.feature_key !== undefined) {
            category.featureKey = normalizeOptionalText(payload.featureKey || payload.feature_key);
        }
        if (payload.featureRoute !== undefined || payload.feature_route !== undefined) {
            category.featureRoute = normalizeOptionalText(payload.featureRoute || payload.feature_route);
        }
        if (payload.sortOrder !== undefined) {
            category.sortOrder = Number(payload.sortOrder);
        }
        if (payload.isActive !== undefined) {
            category.isActive = Boolean(payload.isActive);
        }
        if (payload.metadata !== undefined) {
            category.metadata = payload.metadata || {};
        }

        if (payload.name !== undefined || payload.nameEn !== undefined || payload.name_en !== undefined || payload.featureKey !== undefined || payload.feature_key !== undefined) {
            category.slug = await generateUniqueSupportCategorySlug(category.featureKey || category.name, transaction, category.id);
        }

        await category.save({ transaction });
        return normalizeSupportCategory(category);
    });
}

async function deleteSupportCategory({ actor, categoryId, hard = false }) {
    const actorContext = getActorContext(actor);
    if (!actorContext.isSuperAdmin) {
        throw createSupportError('Only super admins can manage support taxonomy', 403);
    }

    return db.sequelize.transaction(async (transaction) => {
        const category = await db.SupportCategory.findByPk(categoryId, {
            include: [
                { model: db.SupportCategory, as: 'children', attributes: ['id'] }
            ],
            transaction
        });

        if (!category) {
            throw createSupportError('Support category not found', 404);
        }

        const childCount = Array.isArray(category.children) ? category.children.length : 0;
        if (childCount > 0) {
            throw createSupportError('Delete child categories first before removing this category', 400);
        }

        const ticketCount = await db.SupportTicket.count({
            where: { supportCategoryId: category.id },
            transaction
        });

        if (ticketCount > 0) {
            throw createSupportError('This support category is referenced by existing tickets and cannot be deleted', 400);
        }

        if (hard) {
            await category.destroy({ transaction });
            return { deleted: true, hardDeleted: true };
        }

        await category.destroy({ transaction });
        return { deleted: true, hardDeleted: false };
    });
}

async function reorderSupportCategories({ actor, orderMap = [] }) {
    const actorContext = getActorContext(actor);
    if (!actorContext.isSuperAdmin) {
        throw createSupportError('Only super admins can manage support taxonomy', 403);
    }

    if (!Array.isArray(orderMap) || orderMap.length === 0) {
        throw createSupportError('orderMap array is required', 400);
    }

    return db.sequelize.transaction(async (transaction) => {
        for (const item of orderMap) {
            if (!item?.id) continue;
            const updatePayload = {};
            if (item.sortOrder !== undefined && item.sortOrder !== null) {
                updatePayload.sortOrder = Number(item.sortOrder);
            }
            if (item.parentId !== undefined) {
                updatePayload.parentId = item.parentId || null;
            }
            if (Object.keys(updatePayload).length > 0) {
                await db.SupportCategory.update(updatePayload, {
                    where: { id: item.id },
                    transaction
                });
            }
        }

        const categories = await db.SupportCategory.findAll({
            order: [['parentId', 'ASC'], ['sortOrder', 'ASC'], ['name', 'ASC']],
            transaction
        });

        return {
            categories: categories.map(normalizeSupportCategory),
            tree: buildSupportCategoryTree(categories),
            flatCategories: categories.map(normalizeSupportCategory)
        };
    });
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
    const hasCustomerRecipient = Boolean(ticket?.customerPlatformUserId);

    if (actionType === 'ticket_created') {
        if (ticket.assignedSupportAgentId) {
            recipients.push({ recipientType: 'support_agent', recipientId: ticket.assignedSupportAgentId });
        } else {
            recipients.push({ recipientType: 'support_queue', recipientId: null });
        }

        if ((actorContext.isSupportAgent || actorContext.isSuperAdmin) && hasCustomerRecipient) {
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
        } else if (hasCustomerRecipient) {
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
        if (hasCustomerRecipient) {
            recipients.push({ recipientType: 'customer', recipientId: ticket.customerPlatformUserId });
        }
        return recipients;
    }

    if (['status_changed', 'priority_changed', 'category_changed', 'closed', 'reopened'].includes(actionType)) {
        if (hasCustomerRecipient) {
            recipients.push({ recipientType: 'customer', recipientId: ticket.customerPlatformUserId });
        }
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
    const normalizedTenantId = ensureUuidLike(tenantId, 'tenantId');
    if (!normalizedTenantId) {
        throw createSupportError('tenantId is required', 400);
    }

    const normalizedCustomerId = actorContext.isCustomer
        ? ensureUuidLike(actorContext.actorId, 'customerPlatformUserId')
        : ensureUuidLike(customerPlatformUserId, 'customerPlatformUserId') || null;

    const normalizedSupportCategoryId = ensureUuidLike(supportCategoryId, 'supportCategoryId') || null;

    if (actorContext.isCustomer && !normalizedCustomerId) {
        throw createSupportError('customerPlatformUserId is required', 400);
    }

    const subjectText = ensureSubjectLength(subject);
    const subjectArText = normalizeOptionalText(subjectAr);
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

        if (normalizedCustomerId) {
            await resolveCustomer(normalizedTenantId, normalizedCustomerId, transaction);
        }
        const category = await resolveCategoryOrNull(normalizedSupportCategoryId, normalizedTenantId, transaction);

        const ticketNumber = await db.SupportTicket.generateTicketNumber({ transaction });

        const ticket = await db.SupportTicket.create({
            ticketNumber,
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

        if (normalizedCustomerId) {
            await upsertReadState({
                ticket,
                participantType: 'customer',
                participantId: normalizedCustomerId,
                unreadCount: 0,
                lastReadMessageId: initialMessage.id,
                lastReadAt: new Date(),
                transaction
            });
        }

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
        const categoryIds = await collectSupportCategoryIds(normalizeText(filters.supportCategoryId));
        if (categoryIds.length === 1) {
            where.supportCategoryId = categoryIds[0];
        } else if (categoryIds.length > 1) {
            where.supportCategoryId = { [Op.in]: categoryIds };
        } else {
            where.supportCategoryId = normalizeText(filters.supportCategoryId);
        }
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

            if (ticket.customerPlatformUserId) {
                await adjustReadStateUnreadCount({
                    ticket,
                    participantType: 'customer',
                    participantId: ticket.customerPlatformUserId,
                    delta: 1,
                    transaction
                });
            }
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
    listCategories,
    createSupportCategory,
    updateSupportCategory,
    deleteSupportCategory,
    reorderSupportCategories,
    normalizeTicket,
    normalizeMessage,
    normalizeSupportCategory,
    normalizeAttachment,
    normalizeNotificationEvent,
    normalizeTicketEvent,
    ensureFileAttachmentAllowed
};
