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
    buildAdminSupportContext
};
