const auditController = require('./auditController');
const db = require('../models');

jest.mock('../models', () => {
    return {
        ActivityLog: {
            findAndCountAll: jest.fn(),
            findByPk: jest.fn(),
            findAll: jest.fn(),
        }
    };
});

describe('Audit Controller Unit Tests', () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            query: {},
            params: {},
            tenant: undefined,
            tenantId: undefined
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    // --- Admin List ---
    it('Admin List: should apply filters correctly', async () => {
        req.query = { 
            tenantId: 't1', 
            entityType: 'booking',
            action: 'created',
            operationId: 'op1',
            correlationId: 'corr1',
            performedByType: 'user',
            performedById: 'u1',
            from: '2026-01-01',
            to: '2026-12-31',
            page: '2',
            limit: '10'
        };

        db.ActivityLog.findAndCountAll.mockResolvedValue({ count: 1, rows: [{ id: 'log1' }] });

        await auditController.listAdminAuditLogs(req, res);

        expect(db.ActivityLog.findAndCountAll).toHaveBeenCalledTimes(1);
        const callArgs = db.ActivityLog.findAndCountAll.mock.calls[0][0];
        
        expect(callArgs.where.tenantId).toBe('t1');
        expect(callArgs.where.entityType).toBe('booking');
        expect(callArgs.where.action).toBe('created');
        expect(callArgs.where.operationId).toBe('op1');
        expect(callArgs.where.correlationId).toBe('corr1');
        expect(callArgs.where.performedByType).toBe('user');
        expect(callArgs.where.performedById).toBe('u1');
        expect(callArgs.where.createdAt).toBeDefined();
        
        expect(callArgs.limit).toBe(10);
        expect(callArgs.offset).toBe(10);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    // --- Tenant Isolation ---
    it('Tenant List: should enforce tenant isolation', async () => {
        req.tenant = { id: 't-isolated' };
        // Maliciously trying to query another tenant
        req.query = { tenantId: 't-other' }; 
        db.ActivityLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

        await auditController.listTenantAuditLogs(req, res);

        const callArgs = db.ActivityLog.findAndCountAll.mock.calls[0][0];
        // Ensure tenant isolation overrides the query param
        expect(callArgs.where.tenantId).toBe('t-isolated');
    });

    it('Tenant Operation Lookup: should enforce tenant isolation', async () => {
        req.tenant = { id: 't-isolated' };
        req.params = { operationId: 'op1' };
        db.ActivityLog.findAll.mockResolvedValue([]);

        await auditController.getTenantOperationHistory(req, res);

        const callArgs = db.ActivityLog.findAll.mock.calls[0][0];
        expect(callArgs.where.tenantId).toBe('t-isolated');
        expect(callArgs.where.operationId).toBe('op1');
    });

    it('Tenant Correlation Lookup: should enforce tenant isolation', async () => {
        req.tenant = { id: 't-isolated' };
        req.params = { correlationId: 'corr1' };
        db.ActivityLog.findAll.mockResolvedValue([]);

        await auditController.getTenantCorrelationHistory(req, res);

        const callArgs = db.ActivityLog.findAll.mock.calls[0][0];
        expect(callArgs.where.tenantId).toBe('t-isolated');
        expect(callArgs.where.correlationId).toBe('corr1');
    });

    it('Tenant Entity Lookup: should enforce tenant isolation', async () => {
        req.tenant = { id: 't-isolated' };
        req.params = { entityType: 'booking', entityId: 'b1' };
        db.ActivityLog.findAll.mockResolvedValue([]);

        await auditController.getTenantEntityHistory(req, res);

        const callArgs = db.ActivityLog.findAll.mock.calls[0][0];
        expect(callArgs.where.tenantId).toBe('t-isolated');
        expect(callArgs.where.entityType).toBe('booking');
        expect(callArgs.where.entityId).toBe('b1');
    });

    it('Tenant Detail: should enforce tenant isolation', async () => {
        req.tenant = { id: 't-isolated' };
        req.params = { id: 'log1' };
        // We need to use findOne for tenant details isolation, let's verify it uses findOne with tenantId
        // Wait, did we mock findOne? Let's add it.
        db.ActivityLog.findOne = jest.fn().mockResolvedValue(null);

        await auditController.getTenantAuditLogDetails(req, res);

        const callArgs = db.ActivityLog.findOne.mock.calls[0][0];
        expect(callArgs.where.tenantId).toBe('t-isolated');
        expect(callArgs.where.id).toBe('log1');
    });

    // --- Admin Endpoints ---
    it('Admin Entity Lookup: should return records', async () => {
        req.params = { entityType: 'booking', entityId: 'b1' };
        db.ActivityLog.findAll.mockResolvedValue([{ id: 'log1' }]);
        await auditController.getAdminEntityHistory(req, res);
        const callArgs = db.ActivityLog.findAll.mock.calls[0][0];
        expect(callArgs.where.entityType).toBe('booking');
        expect(callArgs.where.entityId).toBe('b1');
    });

    it('Admin Operation Lookup: should return records', async () => {
        req.params = { operationId: 'op1' };
        db.ActivityLog.findAll.mockResolvedValue([]);
        await auditController.getAdminOperationHistory(req, res);
        const callArgs = db.ActivityLog.findAll.mock.calls[0][0];
        expect(callArgs.where.operationId).toBe('op1');
    });

    it('Admin Correlation Lookup: should return records', async () => {
        req.params = { correlationId: 'corr1' };
        db.ActivityLog.findAll.mockResolvedValue([]);
        await auditController.getAdminCorrelationHistory(req, res);
        const callArgs = db.ActivityLog.findAll.mock.calls[0][0];
        expect(callArgs.where.correlationId).toBe('corr1');
    });
});
