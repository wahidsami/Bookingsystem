const db = require('../models');
const { Op, fn, col } = require('sequelize');
const { getTenantDashboardBaseUrl } = require('../utils/url');
const { generateBillNumber, generatePaymentToken } = require('../utils/billUtils');
const {
    buildSubscriptionInvoiceSnapshot,
    getAmountForBillingCycle,
    serializeBill,
    toNumber
} = require('../utils/invoiceSnapshotBuilder');
const { ensureInvoicePdf } = require('../services/billDocumentService');
const fs = require('fs');
const path = require('path');

/**
 * Get all tenants with filters and pagination
 */
const listTenants = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            businessType,
            plan,
            city,
            search,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        // Apply filters
        if (status) where.status = status;
        if (businessType) {
            where[Op.or] = [
                { businessType },
                { businessType: { [Op.contains]: [businessType] } }
            ];
        }
        if (plan) where.plan = plan;
        if (city) where.city = city;

        // Search by name, email, phone
        if (search) {
            const searchConditions = [
                { name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } },
                { ownerName: { [Op.iLike]: `%${search}%` } },
                { ownerEmail: { [Op.iLike]: `%${search}%` } }
            ];

            if (where[Op.or]) {
                where[Op.and] = [{ [Op.or]: where[Op.or] }, { [Op.or]: searchConditions }];
                delete where[Op.or];
            } else {
                where[Op.or] = searchConditions;
            }
        }

        const { count, rows: tenants } = await db.Tenant.findAndCountAll({
            where,
            order: [[sortBy, sortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            tenants,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('List tenants error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenants',
            error: error.message
        });
    }
};

/**
 * Get pending tenants for approval
 */
const getPendingTenants = async (req, res) => {
    try {
        const tenants = await db.Tenant.findAll({
            where: { status: 'pending_approval' },
            order: [['createdAt', 'ASC']]
        });

        res.json({
            success: true,
            tenants,
            count: tenants.length
        });

    } catch (error) {
        console.error('Get pending tenants error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending tenants'
        });
    }
};

/**
 * Get single tenant details
 */
const getTenantDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const tenant = await db.Tenant.findByPk(id, {
            include: [
                {
                    model: db.User,
                    attributes: ['id', 'email', 'role', 'createdAt']
                }
            ]
        });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Get activity logs for this tenant
        const activities = await db.ActivityLog.findAll({
            where: {
                entityType: 'tenant',
                entityId: id
            },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        // Get live tenant stats from shared tables
        const [bookingStats, subscription] = await Promise.all([
            getBookingStats(tenant.id, tenant.stats),
            db.TenantSubscription.findOne({
                where: { tenantId: tenant.id },
                include: [{ model: db.SubscriptionPackage, as: 'package' }],
                order: [['createdAt', 'DESC']]
            })
        ]);
        const tenantData = tenant.toJSON();
        tenantData.stats = {
            ...(tenantData.stats || {}),
            ...bookingStats
        };
        tenantData.subscription = subscription ? subscription.toJSON() : null;

        res.json({
            success: true,
            tenant: tenantData,
            activities,
            bookingStats
        });

    } catch (error) {
        console.error('Get tenant details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tenant details',
            error: error.message
        });
    }
};

/**
 * Approve tenant registration based on the selected package.
 * Free packages activate immediately.
 * Paid packages move to payment_pending and receive an initial invoice link.
 */
const approveTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        if (tenant.status !== 'pending_approval') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve tenant with status: ${tenant.status}`
            });
        }

        const subscription = await db.TenantSubscription.findOne({
            where: { tenantId: tenant.id },
            include: [{ model: db.SubscriptionPackage, as: 'package' }],
            order: [['createdAt', 'DESC']]
        });

        if (!subscription || !subscription.package) {
            return res.status(400).json({
                success: false,
                message: 'Tenant registration is missing a valid subscription package'
            });
        }

        const now = new Date();
        const paymentDueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
        const locale = tenant?.settings?.language === 'en' ? 'en' : 'ar';
        const amount = toNumber(subscription.amount, 0) > 0
            ? toNumber(subscription.amount, 0)
            : getAmountForBillingCycle(subscription.package, subscription.billingCycle);

        if (amount <= 0) {
            await tenant.update({
                approvedAt: now,
                approvedBy: req.adminId
            });

            const { activateTenantAfterPayment } = require('../utils/initializeTenantSubscription');
            await activateTenantAfterPayment(tenant.id);

            await db.ActivityLog.create({
                entityType: 'tenant',
                entityId: tenant.id,
                action: 'approved',
                performedByType: 'super_admin',
                performedById: req.adminId,
                performedByName: req.adminName,
                details: {
                    notes,
                    paymentRequired: false,
                    packageId: subscription.packageId,
                    billingCycle: subscription.billingCycle
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });

            const { sendPaymentSuccessEmail } = require('../utils/emailService');
            sendPaymentSuccessEmail(tenant).catch(err => {
                console.error('[Approval] Failed to send activation email:', err.message);
            });

            return res.json({
                success: true,
                message: 'Tenant approved and activated successfully.',
                tenant: await db.Tenant.findByPk(tenant.id)
            });
        }

        const billNumber = await generateBillNumber();
        const paymentToken = generatePaymentToken();
        const baseUrl = getTenantDashboardBaseUrl();
        const paymentUrl = baseUrl
            ? `${baseUrl}/${locale}/payment?token=${paymentToken}`
            : `/${locale}/payment?token=${paymentToken}`;

        const invoiceSnapshot = await buildSubscriptionInvoiceSnapshot({
            tenant,
            subscriptionPackage: subscription.package,
            subscription,
            billingCycle: subscription.billingCycle,
            billType: 'initial',
            dueDate: paymentDueAt.toISOString().slice(0, 10),
            issueDate: now,
            totalAmount: amount
        });

        const [updatedTenant, bill] = await db.sequelize.transaction(async (transaction) => {
            await tenant.update({
                status: 'payment_pending',
                paymentDueAt,
                approvedAt: now,
                approvedBy: req.adminId
            }, { transaction });

            const createdBill = await db.Bill.create({
                tenantId: tenant.id,
                tenantSubscriptionId: subscription.id,
                billNumber,
                ...invoiceSnapshot,
                amount: invoiceSnapshot.amount,
                currency: subscription.currency || 'SAR',
                dueDate: paymentDueAt.toISOString().slice(0, 10),
                status: 'UNPAID',
                paymentToken,
                paymentTokenExpiresAt: paymentDueAt,
                type: 'initial',
                metadata: {
                    ...(invoiceSnapshot.metadata || {}),
                    createdFrom: 'tenant_approval',
                    approvedBy: req.adminId,
                    billingCycle: subscription.billingCycle
                }
            }, { transaction });

            await db.ActivityLog.create({
                entityType: 'tenant',
                entityId: tenant.id,
                action: 'created',
                performedByType: 'super_admin',
                performedById: req.adminId,
                performedByName: req.adminName,
                details: {
                    event: 'invoice_created',
                    billId: createdBill.id,
                    billNumber: createdBill.billNumber,
                    billType: createdBill.type,
                    status: createdBill.status,
                    amount: toNumber(createdBill.amount, 0),
                    totalAmount: toNumber(createdBill.totalAmount, toNumber(createdBill.amount, 0)),
                    packageId: subscription.packageId,
                    billingCycle: subscription.billingCycle,
                    paymentTokenExpiresAt: paymentDueAt
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            }, { transaction });

            await db.ActivityLog.create({
                entityType: 'tenant',
                entityId: tenant.id,
                action: 'approved',
                performedByType: 'super_admin',
                performedById: req.adminId,
                performedByName: req.adminName,
                details: {
                    notes,
                    paymentRequired: true,
                    paymentDueAt,
                    billId: createdBill.id,
                    billNumber: createdBill.billNumber,
                    packageId: subscription.packageId,
                    billingCycle: subscription.billingCycle,
                    amount
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            }, { transaction });

            return [tenant, createdBill];
        });

        const { sendApprovalEmail } = require('../utils/emailService');
        ensureInvoicePdf(bill).catch(err => {
            console.error('[Approval] Failed to generate invoice PDF:', err.message);
        });
        sendApprovalEmail(tenant, { paymentUrl, paymentDueAt }).catch(err => {
            console.error('[Approval] Failed to send approval email:', err.message);
        });

        res.json({
            success: true,
            message: 'Tenant approved. Initial invoice created and payment link sent.',
            tenant: updatedTenant,
            bill: {
                ...serializeBill(bill, { includePaymentToken: true }),
                paymentUrl
            }
        });

    } catch (error) {
        console.error('Approve tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve tenant',
            error: error.message
        });
    }
};

/**
 * Reject tenant
 */
const rejectTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        if (tenant.status !== 'pending_approval') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject tenant with status: ${tenant.status}`
            });
        }

        await tenant.update({
            status: 'rejected',
            rejectionReason: reason
        });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'rejected',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            details: { reason },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Send rejection email (don't wait for it, don't fail if it errors)
        const { sendRejectionEmail } = require('../utils/emailService');
        sendRejectionEmail(tenant, reason).catch(err => {
            console.error('[Rejection] Failed to send rejection email:', err.message);
            // Don't throw - email failure shouldn't affect rejection
        });

        res.json({
            success: true,
            message: 'Tenant rejected',
            tenant
        });

    } catch (error) {
        console.error('Reject tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject tenant',
            error: error.message
        });
    }
};

/**
 * Request more info from tenant (sets more_info_required, stores message)
 */
const requestMoreInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        if (tenant.status !== 'pending_approval') {
            return res.status(400).json({
                success: false,
                message: `Cannot request more info for tenant with status: ${tenant.status}`
            });
        }

        await tenant.update({
            status: 'more_info_required',
            moreInfoMessage: message.trim()
        });

        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'more_info_required',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            details: { message: message.trim() },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Optional: send email to tenant with message and link to resubmit
        const { sendEmail } = require('../utils/emailService');
        const resubmitUrl = getTenantDashboardBaseUrl();
        sendEmail({
            to: tenant.email,
            subject: 'Rifah – More information required',
            template: 'more_info_required',
            data: {
                tenantName: tenant.name_en || tenant.name,
                tenantNameAr: tenant.name_ar || tenant.nameAr,
                message: message.trim(),
                resubmitUrl
            }
        }).catch(err => console.error('[MoreInfo] Email failed:', err.message));

        res.json({
            success: true,
            message: 'More info requested. Tenant notified.',
            tenant
        });
    } catch (error) {
        console.error('Request more info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to request more info',
            error: error.message
        });
    }
};

/**
 * Suspend tenant
 */
const suspendTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Suspension reason is required'
            });
        }

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const previousStatus = tenant.status;

        await tenant.update({
            status: 'suspended',
            suspensionReason: reason
        });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'suspended',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            previousValue: { status: previousStatus },
            newValue: { status: 'suspended' },
            details: { reason },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Tenant suspended',
            tenant
        });

    } catch (error) {
        console.error('Suspend tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to suspend tenant',
            error: error.message
        });
    }
};

/**
 * Activate tenant (re-activate after suspension)
 */
const activateTenant = async (req, res) => {
    try {
        const { id } = req.params;

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const previousStatus = tenant.status;

        await tenant.update({
            status: 'active',
            suspensionReason: null
        });

        // Log activity
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'activated',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            previousValue: { status: previousStatus },
            newValue: { status: 'active' },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Tenant activated',
            tenant
        });

    } catch (error) {
        console.error('Activate tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to activate tenant',
            error: error.message
        });
    }
};

/**
 * Safely delete a tenant account in non-active states.
 * Intended for cleanup/testing resets, not routine production removal of live tenants.
 */
const deleteTenant = async (req, res) => {
    try {
        const { id } = req.params;

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const deletableStatuses = [
            'pending_approval',
            'more_info_required',
            'rejected',
            'payment_pending',
            'payment_failed',
            'payment_expired',
            'inactive',
            'suspended'
        ];

        if (!deletableStatuses.includes(tenant.status)) {
            return res.status(400).json({
                success: false,
                message: `Tenant with status ${tenant.status} cannot be deleted from admin cleanup. Suspend it first or use a controlled DB purge.`
            });
        }

        const uploadedPaths = [
            tenant.logo,
            tenant.coverImage,
            tenant.crDocument,
            tenant.taxDocument,
            tenant.licenseDocument
        ].filter(Boolean);

        const deleteByTenantTables = [
            ['MobilePushToken', db.MobilePushToken],
            ['TenantPushUsage', db.TenantPushUsage],
            ['TenantPushCampaign', db.TenantPushCampaign],
            ['UsageAlert', db.UsageAlert],
            ['CustomerInsight', db.CustomerInsight],
            ['Review', db.Review],
            ['StaffMessage', db.StaffMessage],
            ['StaffPayroll', db.StaffPayroll],
            ['Appointment', db.Appointment],
            ['Order', db.Order],
            ['Transaction', db.Transaction],
            ['HotDeal', db.HotDeal],
            ['Product', db.Product],
            ['Service', db.Service],
            ['PublicPageData', db.PublicPageData],
            ['TenantSettings', db.TenantSettings],
            ['TenantUsage', db.TenantUsage],
            ['User', db.User],
            ['Staff', db.Staff]
        ].filter(([, model]) => Boolean(model));

        await db.sequelize.transaction(async (transaction) => {
            // Remove child rows tied to subscription first.
            const subscriptionIds = await db.TenantSubscription.findAll({
                where: { tenantId: tenant.id },
                attributes: ['id'],
                transaction,
                raw: true
            });
            const subscriptionIdList = subscriptionIds.map((row) => row.id);

            if (subscriptionIdList.length > 0 && db.Bill) {
                await db.Bill.destroy({
                    where: { tenantSubscriptionId: { [Op.in]: subscriptionIdList } },
                    transaction
                });
            }

            for (const [, model] of deleteByTenantTables) {
                await model.destroy({
                    where: { tenantId: tenant.id },
                    transaction
                });
            }

            await db.TenantSubscription.destroy({
                where: { tenantId: tenant.id },
                transaction
            });

            await db.ActivityLog.destroy({
                where: {
                    [Op.or]: [
                        { entityType: 'tenant', entityId: tenant.id },
                        { performedByType: 'tenant_user', performedById: tenant.id }
                    ]
                },
                transaction
            });

            await db.Tenant.destroy({
                where: { id: tenant.id },
                transaction
            });

            await db.ActivityLog.create({
                entityType: 'tenant',
                entityId: tenant.id,
                action: 'deleted',
                performedByType: 'super_admin',
                performedById: req.adminId,
                performedByName: req.adminName,
                details: {
                    tenantName: tenant.name_en || tenant.name,
                    tenantEmail: tenant.email,
                    deletedStatus: tenant.status,
                    cleanupMode: 'safe_admin_delete'
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            }, { transaction });
        });

        for (const relativeUploadPath of uploadedPaths) {
            try {
                const absolutePath = path.join(__dirname, '../../uploads', relativeUploadPath);
                if (absolutePath.startsWith(path.join(__dirname, '../../uploads')) && fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath);
                }
            } catch (fileError) {
                console.warn(`[DeleteTenant] Failed to remove file ${relativeUploadPath}:`, fileError.message);
            }
        }

        res.json({
            success: true,
            message: 'Tenant deleted successfully'
        });
    } catch (error) {
        console.error('Delete tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete tenant',
            error: error.message
        });
    }
};

/**
 * Update tenant details
 */
const updateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const tenant = await db.Tenant.findByPk(id);

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        // Store previous values for logging
        const previousValue = tenant.toJSON();

        // Allowed fields to update
        const allowedFields = [
            'name', 'nameAr', 'businessType', 'email', 'phone', 'whatsapp',
            'website', 'address', 'city', 'description', 'descriptionAr',
            'plan', 'planStartDate', 'planEndDate', 'settings', 'layoutTemplate',
            'themeColors'
        ];

        const filteredUpdates = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        }

        await tenant.update(filteredUpdates);

        // Log activity
        await db.ActivityLog.create({
            entityType: 'tenant',
            entityId: tenant.id,
            action: 'updated',
            performedByType: 'super_admin',
            performedById: req.adminId,
            performedByName: req.adminName,
            previousValue,
            newValue: filteredUpdates,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Tenant updated',
            tenant
        });

    } catch (error) {
        console.error('Update tenant error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update tenant',
            error: error.message
        });
    }
};

/**
 * Get tenant activity logs
 */
const getTenantActivities = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const offset = (page - 1) * limit;

        const { count, rows: activities } = await db.ActivityLog.findAndCountAll({
            where: {
                entityType: 'tenant',
                entityId: id
            },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            activities,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Get tenant activities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activities'
        });
    }
};

// Helper function to get booking stats for a tenant
async function getBookingStats(tenantId, fallbackStats = {}) {
    try {
        const [
            totalBookings,
            completedBookings,
            cancelledBookings,
            bookingRevenue,
            orderRevenue,
            bookingCustomers,
            orderCustomers,
            ratingAggregate
        ] = await Promise.all([
            db.Appointment.count({
                where: { tenantId }
            }),
            db.Appointment.count({
                where: { tenantId, status: 'completed' }
            }),
            db.Appointment.count({
                where: { tenantId, status: 'cancelled' }
            }),
            db.Appointment.sum('price', {
                where: { tenantId, status: 'completed' }
            }),
            db.Order.sum('totalAmount', {
                where: {
                    tenantId,
                    paymentStatus: 'paid',
                    status: {
                        [Op.notIn]: ['cancelled', 'refunded']
                    }
                }
            }),
            db.Appointment.findAll({
                where: {
                    tenantId,
                    platformUserId: { [Op.ne]: null }
                },
                attributes: [[fn('DISTINCT', col('platformUserId')), 'platformUserId']],
                raw: true
            }),
            db.Order.findAll({
                where: {
                    tenantId,
                    platformUserId: { [Op.ne]: null }
                },
                attributes: [[fn('DISTINCT', col('platformUserId')), 'platformUserId']],
                raw: true
            }),
            db.CustomerInsight.findOne({
                where: {
                    tenantId,
                    averageRating: { [Op.ne]: null }
                },
                attributes: [[fn('AVG', col('averageRating')), 'averageRating']],
                raw: true
            })
        ]);

        const customerIds = new Set([
            ...bookingCustomers.map((row) => row.platformUserId).filter(Boolean),
            ...orderCustomers.map((row) => row.platformUserId).filter(Boolean)
        ]);

        const resolvedAverageRating = Number.parseFloat(
            ratingAggregate?.averageRating ?? fallbackStats?.averageRating ?? 0
        ) || 0;

        return {
            totalBookings,
            completedBookings,
            cancelledBookings,
            totalRevenue: Number.parseFloat(bookingRevenue || 0) + Number.parseFloat(orderRevenue || 0),
            totalCustomers: customerIds.size,
            averageRating: resolvedAverageRating
        };
    } catch (error) {
        console.error('Get booking stats error:', error);
        return {
            totalBookings: fallbackStats?.totalBookings || 0,
            completedBookings: 0,
            cancelledBookings: 0,
            totalRevenue: Number.parseFloat(fallbackStats?.totalRevenue || 0),
            totalCustomers: fallbackStats?.totalCustomers || 0,
            averageRating: Number.parseFloat(fallbackStats?.averageRating || 0)
        };
    }
}

module.exports = {
    listTenants,
    getPendingTenants,
    getTenantDetails,
    approveTenant,
    rejectTenant,
    requestMoreInfo,
    suspendTenant,
    activateTenant,
    deleteTenant,
    updateTenant,
    getTenantActivities
};

