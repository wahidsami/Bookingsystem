const db = require('../models');

const { QueryTypes } = db.Sequelize;

const DEFAULT_NOTIFICATION = {
    type: 'system',
    severity: 'info',
    titleEn: 'Notification',
    messageEn: '',
    actionUrl: null,
    entityType: null,
    entityId: null,
    isRead: false,
    readAt: null
};

const getAdminNotificationColumns = async () => {
    const rows = await db.sequelize.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_notifications'
    `, {
        type: QueryTypes.SELECT
    });

    return new Set(rows.map((row) => row.column_name));
};

const hasColumn = (columns, name) => columns.has(name);

const buildListWhereClause = (columns, filters = {}) => {
    const clauses = [];
    const replacements = {};

    if (filters.unreadOnly === 'true' && hasColumn(columns, 'isRead')) {
        clauses.push('COALESCE("isRead", FALSE) = FALSE');
    }

    if (filters.type && hasColumn(columns, 'type')) {
        clauses.push('type = :type');
        replacements.type = filters.type;
    }

    if (filters.severity && hasColumn(columns, 'severity')) {
        clauses.push('severity = :severity');
        replacements.severity = filters.severity;
    }

    return {
        whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
        replacements
    };
};

const normalizeNotification = (row = {}) => ({
    id: row.id || '',
    type: row.type || DEFAULT_NOTIFICATION.type,
    severity: row.severity || DEFAULT_NOTIFICATION.severity,
    titleEn: row.titleEn || DEFAULT_NOTIFICATION.titleEn,
    messageEn: row.messageEn || DEFAULT_NOTIFICATION.messageEn,
    actionUrl: row.actionUrl ?? DEFAULT_NOTIFICATION.actionUrl,
    entityType: row.entityType ?? DEFAULT_NOTIFICATION.entityType,
    entityId: row.entityId ?? DEFAULT_NOTIFICATION.entityId,
    isRead: Boolean(row.isRead),
    readAt: row.readAt || DEFAULT_NOTIFICATION.readAt,
    createdAt: row.createdAt || new Date().toISOString()
});

const listNotifications = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            unreadOnly,
            type,
            severity
        } = req.query;

        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const columns = await getAdminNotificationColumns();

        if (columns.size === 0) {
            return res.json({
                success: true,
                notifications: [],
                unreadCount: 0,
                pagination: {
                    page: pageNumber,
                    limit: pageSize,
                    total: 0,
                    totalPages: 0
                }
            });
        }

        const { whereSql, replacements } = buildListWhereClause(columns, {
            unreadOnly,
            type,
            severity
        });

        const selectColumns = [
            hasColumn(columns, 'id') ? 'CAST(id AS TEXT) AS id' : "'' AS id",
            hasColumn(columns, 'type') ? 'type' : `'${DEFAULT_NOTIFICATION.type}' AS type`,
            hasColumn(columns, 'severity')
                ? `COALESCE(severity, '${DEFAULT_NOTIFICATION.severity}') AS severity`
                : `'${DEFAULT_NOTIFICATION.severity}' AS severity`,
            hasColumn(columns, 'titleEn')
                ? `COALESCE("titleEn", '${DEFAULT_NOTIFICATION.titleEn}') AS "titleEn"`
                : `'${DEFAULT_NOTIFICATION.titleEn}' AS "titleEn"`,
            hasColumn(columns, 'messageEn')
                ? `COALESCE("messageEn", '') AS "messageEn"`
                : `'' AS "messageEn"`,
            hasColumn(columns, 'actionUrl')
                ? '"actionUrl"'
                : 'NULL::text AS "actionUrl"',
            hasColumn(columns, 'entityType')
                ? '"entityType"'
                : 'NULL::text AS "entityType"',
            hasColumn(columns, 'entityId')
                ? 'CAST("entityId" AS TEXT) AS "entityId"'
                : 'NULL::text AS "entityId"',
            hasColumn(columns, 'isRead')
                ? 'COALESCE("isRead", FALSE) AS "isRead"'
                : 'FALSE AS "isRead"',
            hasColumn(columns, 'readAt')
                ? '"readAt"'
                : 'NULL::timestamptz AS "readAt"',
            hasColumn(columns, 'createdAt')
                ? 'COALESCE("createdAt", NOW()) AS "createdAt"'
                : 'NOW() AS "createdAt"'
        ];

        const orderBySql = hasColumn(columns, 'createdAt')
            ? 'ORDER BY "createdAt" DESC NULLS LAST'
            : hasColumn(columns, 'updatedAt')
                ? 'ORDER BY "updatedAt" DESC NULLS LAST'
                : '';

        const listReplacements = {
            ...replacements,
            limit: pageSize,
            offset: (pageNumber - 1) * pageSize
        };

        const [notifications, totalRows, unreadRows] = await Promise.all([
            db.sequelize.query(`
                SELECT ${selectColumns.join(', ')}
                FROM public.admin_notifications
                ${whereSql}
                ${orderBySql}
                LIMIT :limit OFFSET :offset
            `, {
                replacements: listReplacements,
                type: QueryTypes.SELECT
            }),
            db.sequelize.query(`
                SELECT COUNT(*)::int AS total
                FROM public.admin_notifications
                ${whereSql}
            `, {
                replacements,
                type: QueryTypes.SELECT
            }),
            hasColumn(columns, 'isRead')
                ? db.sequelize.query(`
                    SELECT COUNT(*)::int AS total
                    FROM public.admin_notifications
                    WHERE COALESCE("isRead", FALSE) = FALSE
                `, { type: QueryTypes.SELECT })
                : Promise.resolve([{ total: 0 }])
        ]);

        const total = Number(totalRows?.[0]?.total || 0);
        const unreadCount = Number(unreadRows?.[0]?.total || 0);

        res.json({
            success: true,
            notifications: notifications.map(normalizeNotification),
            unreadCount,
            pagination: {
                page: pageNumber,
                limit: pageSize,
                total,
                totalPages: total > 0 ? Math.ceil(total / pageSize) : 0
            }
        });
    } catch (error) {
        console.error('List admin notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const columns = await getAdminNotificationColumns();

        if (columns.size === 0 || !hasColumn(columns, 'isRead')) {
            return res.json({
                success: true,
                unreadCount: 0
            });
        }

        const unreadRows = await db.sequelize.query(`
            SELECT COUNT(*)::int AS total
            FROM public.admin_notifications
            WHERE COALESCE("isRead", FALSE) = FALSE
        `, {
            type: QueryTypes.SELECT
        });

        res.json({
            success: true,
            unreadCount: Number(unreadRows?.[0]?.total || 0)
        });
    } catch (error) {
        console.error('Get unread notification count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unread notification count'
        });
    }
};

const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const columns = await getAdminNotificationColumns();

        if (columns.size === 0 || !hasColumn(columns, 'id')) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        const existingRows = await db.sequelize.query(`
            SELECT CAST(id AS TEXT) AS id
            FROM public.admin_notifications
            WHERE CAST(id AS TEXT) = :id
            LIMIT 1
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });

        if (!existingRows.length) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (hasColumn(columns, 'isRead')) {
            const setClauses = ['"isRead" = TRUE'];
            if (hasColumn(columns, 'readAt')) {
                setClauses.push('"readAt" = NOW()');
            }
            if (hasColumn(columns, 'updatedAt')) {
                setClauses.push('"updatedAt" = NOW()');
            }

            await db.sequelize.query(`
                UPDATE public.admin_notifications
                SET ${setClauses.join(', ')}
                WHERE CAST(id AS TEXT) = :id
            `, {
                replacements: { id },
                type: QueryTypes.UPDATE
            });
        }

        res.json({
            success: true,
            notification: {
                id,
                isRead: true,
                readAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Mark admin notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notification'
        });
    }
};

const markAllNotificationsAsRead = async (req, res) => {
    try {
        const columns = await getAdminNotificationColumns();

        if (columns.size === 0 || !hasColumn(columns, 'isRead')) {
            return res.json({
                success: true
            });
        }

        const setClauses = ['"isRead" = TRUE'];
        if (hasColumn(columns, 'readAt')) {
            setClauses.push('"readAt" = NOW()');
        }
        if (hasColumn(columns, 'updatedAt')) {
            setClauses.push('"updatedAt" = NOW()');
        }

        await db.sequelize.query(`
            UPDATE public.admin_notifications
            SET ${setClauses.join(', ')}
            WHERE COALESCE("isRead", FALSE) = FALSE
        `, {
            type: QueryTypes.UPDATE
        });

        res.json({
            success: true
        });
    } catch (error) {
        console.error('Mark all admin notifications read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notifications'
        });
    }
};

module.exports = {
    listNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead
};
