'use strict';

const db = require('../models');

const buildCustomerSupportContext = (req, res, next) => {
    req.supportContext = {
        actorType: 'customer',
        actorId: req.userId || req.user?.id || null,
        supportAgentId: null,
        canAccessAllTickets: false,
        isCustomer: true
    };
    next();
};

const findOrCreateTenantSupportAgent = async ({ tenantId, tenantAccountId, displayName, title }) => {
    const existingAgents = await db.SupportAgent.findAll({
        where: {
            status: 'active'
        }
    });

    const normalizedTenantAccountId = tenantAccountId || null;
    const normalizedTenantId = tenantId || null;
    const existing = existingAgents.find((agent) => {
        const metadata = agent.metadata && typeof agent.metadata === 'object' ? agent.metadata : {};
        return (
            metadata.tenantAccountId === normalizedTenantAccountId ||
            metadata.tenantId === normalizedTenantId
        );
    });

    if (existing) {
        return existing;
    }

    return db.SupportAgent.create({
        superAdminId: null,
        displayName,
        displayNameAr: displayName,
        title,
        status: 'active',
        presenceStatus: 'offline',
        supportedLanguages: ['ar', 'en'],
        skills: [],
        metadata: {
            createdFrom: 'tenant_dashboard',
            tenantId: normalizedTenantId,
            tenantAccountId: normalizedTenantAccountId
        }
    });
};

const buildTenantSupportContext = async (req, res, next) => {
    try {
        const tenant = req.tenant || null;
        const tenantAccount = req.tenantAccount || null;
        const tenantId = req.tenantId || tenant?.id || null;
        const tenantAccountId = tenantAccount?.id || null;

        if (!tenantId) {
            return res.status(401).json({
                success: false,
                message: 'Tenant authentication is required'
            });
        }

        const actorLabel =
            tenantAccount?.fullName ||
            tenantAccount?.name ||
            tenantAccount?.displayName ||
            tenant?.businessName ||
            tenant?.name ||
            tenant?.displayName ||
            'Support Agent';

        const supportAgent = await findOrCreateTenantSupportAgent({
            tenantId,
            tenantAccountId,
            displayName: actorLabel,
            title: 'Tenant Support Agent'
        });

        req.supportContext = {
            actorType: 'support_agent',
            actorId: supportAgent.id,
            supportAgentId: supportAgent.id,
            supportAgent,
            tenantId,
            tenantAccountId,
            adminId: null,
            canAccessAllTickets: true,
            isTenantDashboard: true,
            isSupportAgent: true,
            isSuperAdmin: false
        };

        next();
    } catch (error) {
        console.error('Build tenant support context error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to initialize tenant support context'
        });
    }
};

const buildAdminSupportContext = async (req, res, next) => {
    try {
        const adminId = req.adminId || null;
        if (!adminId) {
            return res.status(401).json({
                success: false,
                message: 'Admin authentication is required'
            });
        }

        const [supportAgent, created] = await db.SupportAgent.findOrCreate({
            where: { superAdminId: adminId },
            defaults: {
                superAdminId: adminId,
                displayName: req.adminName || req.adminEmail || 'Support Agent',
                title: 'Support Agent',
                status: 'active',
                presenceStatus: 'offline',
                supportedLanguages: ['ar', 'en'],
                skills: [],
                metadata: {}
            }
        });

        if (created) {
            await supportAgent.update({
                metadata: {
                    ...(supportAgent.metadata || {}),
                    createdFrom: 'support_platform',
                    createdAt: new Date().toISOString()
                }
            }, { hooks: false });
        }

        req.supportContext = {
            actorType: 'support_agent',
            actorId: supportAgent.id,
            supportAgentId: supportAgent.id,
            supportAgent,
            adminId,
            adminRole: req.adminRole || null,
            canAccessAllTickets: req.adminRole === 'super_admin',
            isSuperAdmin: req.adminRole === 'super_admin',
            isSupportAgent: true
        };

        next();
    } catch (error) {
        console.error('Build admin support context error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to initialize support context'
        });
    }
};

module.exports = {
    buildCustomerSupportContext,
    buildTenantSupportContext,
    buildAdminSupportContext
};
