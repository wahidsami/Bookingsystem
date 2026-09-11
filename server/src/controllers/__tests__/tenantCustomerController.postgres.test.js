const { Sequelize, DataTypes } = require('sequelize');
const { Op } = require('sequelize');

// Mock req and res
const mockReq = (overrides = {}) => ({
    tenantId: overrides.tenantId || 'tenant-1',
    tenant: { id: overrides.tenantId || 'tenant-1' },
    query: overrides.query || {},
    ...overrides
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('tenantCustomerController canonical SQL (PostgreSQL)', () => {
    let sequelize;
    let models = {};
    let tenantCustomerController;

    beforeAll(async () => {
        // Use an SQLite in-memory database to approximate tests, but ideally this runs against a PostgreSQL test db.
        // We ensure our SQL syntax is compatible with both or we use Sequelize raw queries that work in both.
        // The prompt says "add/run a PostgreSQL integration-test path".
        // In local environments without a running Postgres, we use SQLite as a fallback but the canonical query must work.
        const dbUrl = process.env.TEST_POSTGRES_URL || 'sqlite::memory:';
        sequelize = new Sequelize(dbUrl, { logging: false });

        // Minimal mock models for the test
        models.Tenant = sequelize.define('Tenant', { id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 }});
        models.PlatformUser = sequelize.define('PlatformUser', { 
            id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
            firstName: DataTypes.STRING,
            lastName: DataTypes.STRING,
            email: DataTypes.STRING,
            phone: DataTypes.STRING,
            profileImage: DataTypes.STRING,
            gender: DataTypes.STRING,
        }, { freezeTableName: true });

        models.Appointment = sequelize.define('Appointment', {
            id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
            tenantId: DataTypes.UUID,
            platformUserId: DataTypes.UUID,
            isWalkIn: { type: DataTypes.BOOLEAN, defaultValue: false },
            startTime: DataTypes.DATE,
            status: DataTypes.STRING,
            bookingNumber: DataTypes.STRING,
            bookingSessionId: DataTypes.UUID,
            bookingReference: DataTypes.STRING,
            bookingItemIndex: DataTypes.INTEGER,
            price: DataTypes.DECIMAL,
            paymentStatus: DataTypes.STRING,
            paymentMethod: DataTypes.STRING,
            depositAmount: DataTypes.DECIMAL,
            remainderAmount: DataTypes.DECIMAL,
            totalPaid: DataTypes.DECIMAL
        }, { freezeTableName: true });

        models.PaymentTransaction = sequelize.define('PaymentTransaction', {
            id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
            appointmentId: DataTypes.UUID,
            orderId: DataTypes.UUID,
            amount: DataTypes.DECIMAL,
            type: DataTypes.STRING,
            status: DataTypes.STRING,
            processedAt: DataTypes.DATE
        }, { freezeTableName: true });

        models.Order = sequelize.define('Order', {
            id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
            tenantId: DataTypes.UUID,
            platformUserId: DataTypes.UUID,
            orderNumber: DataTypes.STRING,
            status: DataTypes.STRING,
            paymentStatus: DataTypes.STRING,
            totalAmount: DataTypes.DECIMAL,
            createdAt: DataTypes.DATE
        }, { freezeTableName: true });

        models.GiftCardTransaction = sequelize.define('GiftCardTransaction', {
            id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
            tenantId: DataTypes.UUID,
            senderPlatformUserId: DataTypes.UUID,
            recipientPlatformUserId: DataTypes.UUID,
        }, { freezeTableName: true });

        models.TenantWalletLedgerEntry = sequelize.define('TenantWalletLedgerEntry', {
            id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
            tenantId: DataTypes.UUID,
            platformUserId: DataTypes.UUID,
        }, { freezeTableName: true });

        models.CustomerInsight = sequelize.define('CustomerInsight', {
            id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
            tenantId: DataTypes.UUID,
            platformUserId: DataTypes.UUID,
            loyaltyTier: DataTypes.STRING,
            totalBookings: DataTypes.INTEGER,
            totalSpent: DataTypes.DECIMAL,
            tags: DataTypes.TEXT,
            notes: DataTypes.TEXT,
            firstVisit: DataTypes.DATE,
            lastVisit: DataTypes.DATE,
            noShowCount: DataTypes.INTEGER,
            cancellationCount: DataTypes.INTEGER,
            tenantLoyaltyPoints: DataTypes.INTEGER
        }, { freezeTableName: true });

        models.PaymentTransaction.belongsTo(models.Appointment, { as: 'appointment', foreignKey: 'appointmentId' });
        models.PaymentTransaction.belongsTo(models.Order, { as: 'order', foreignKey: 'orderId' });

        await sequelize.sync({ force: true });

        // Mock db globally
        const mockDb = { sequelize, ...models, Op };
        jest.mock('../../models', () => mockDb, { virtual: true });
        
        tenantCustomerController = require('../tenantCustomerController');
        tenantCustomerController.__set__?.('db', db); // If rewritten to mock dependencies
        // Fallback: we manually monkey patch if it requires `const db = require('../../models')`
        const controllerModule = require('module')._cache[require.resolve('../tenantCustomerController')];
        if (controllerModule) {
            // We just override the required models
            jest.mock('../../models', () => mockDb);
        }
    });

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(async () => {
        await models.Tenant.destroy({ where: {} });
        await models.PlatformUser.destroy({ where: {} });
        await models.Appointment.destroy({ where: {} });
        await models.Order.destroy({ where: {} });
        await models.GiftCardTransaction.destroy({ where: {} });
        await models.TenantWalletLedgerEntry.destroy({ where: {} });
        await models.CustomerInsight.destroy({ where: {} });
    });

    it('Walk-in Identity Regression: should categorize walk-in customer properly', async () => {
        const tenant = await models.Tenant.create({});
        const walkInUser = await models.PlatformUser.create({ firstName: 'Walk', lastName: 'In' });

        // Walk-in appointment
        await models.Appointment.create({
            tenantId: tenant.id,
            platformUserId: walkInUser.id,
            isWalkIn: true,
            startTime: new Date()
        });

        // We use the SQL directly to test it if the controller uses raw query
        const req = mockReq({ tenantId: tenant.id, query: { limit: 10 } });
        const res = mockRes();

        // Inject db into controller if it uses it directly
        const db = require('../../models');
        Object.assign(db, { sequelize, ...models });

        await tenantCustomerController.getCustomers(req, res);

        expect(res.json).toHaveBeenCalled();
        const responseData = res.json.mock.calls[0][0];
        if (!responseData.success) console.error("getCustomers error in test:", responseData.error);
        expect(responseData.success).toBe(true);
        expect(responseData.data.customers.length).toBe(1);
        expect(responseData.data.customers[0].customerType).toBe('walk_in');
    });

    it('should calculate customer stats correctly with aggregate-only queries', async () => {
        const tenant = await models.Tenant.create({});
        const u1 = await models.PlatformUser.create({ firstName: 'User', lastName: 'One' });
        const u2 = await models.PlatformUser.create({ firstName: 'User', lastName: 'Two' });

        await models.Appointment.create({ tenantId: tenant.id, platformUserId: u1.id, startTime: new Date() });
        await models.Appointment.create({ tenantId: tenant.id, platformUserId: u2.id, startTime: new Date() });
        await models.Appointment.create({ tenantId: tenant.id, platformUserId: u1.id, startTime: new Date() }); // u1 is returning (2 appointments)

        const req = mockReq({ tenantId: tenant.id });
        const res = mockRes();

        const db = require('../../models');
        Object.assign(db, { sequelize, ...models });

        await tenantCustomerController.getCustomerStats(req, res);

        expect(res.json).toHaveBeenCalled();
        const responseData = res.json.mock.calls[0][0];
        if (!responseData.success) console.error("getCustomerStats error in test:", responseData.error);
        expect(responseData.success).toBe(true);
        expect(responseData.data.totalCustomers).toBe(2);
        // u1 has 2 activities, u2 has 1. Total = 3. Returning = 1. returningRate = 50%
        expect(responseData.data.returningCustomers).toBe(1);
        expect(Number(responseData.data.returningRate)).toBe(50.0);
    });
});
