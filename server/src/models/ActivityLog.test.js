const { Sequelize, DataTypes } = require('sequelize');
const setupActivityLogModel = require('./ActivityLog');

describe('ActivityLog Immutability', () => {
    let sequelize;
    let ActivityLog;

    beforeAll(async () => {
        sequelize = new Sequelize('sqlite::memory:', { logging: false });
        ActivityLog = setupActivityLogModel(sequelize, DataTypes);
        await sequelize.sync({ force: true });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('should allow creation of ActivityLog', async () => {
        const log = await ActivityLog.create({
            entityType: 'test',
            entityId: '123',
            action: 'created',
            performedByType: 'system',
            performedById: 'system',
            performedByName: 'system',
            tenantId: 't1'
        });
        expect(log.id).toBeDefined();
    });

    it('should reject instance updates', async () => {
        const log = await ActivityLog.create({
            entityType: 'test',
            entityId: '124',
            action: 'created',
            performedByType: 'system',
            performedById: 'system',
            performedByName: 'system',
            tenantId: 't1'
        });

        await expect(log.update({ action: 'updated' })).rejects.toThrow('ActivityLog updates are prohibited');
    });

    it('should reject bulk updates', async () => {
        await expect(
            ActivityLog.update({ action: 'updated' }, { where: { tenantId: 't1' } })
        ).rejects.toThrow('ActivityLog bulk updates are prohibited');
    });

    it('should reject instance destruction', async () => {
        const log = await ActivityLog.create({
            entityType: 'test',
            entityId: '125',
            action: 'created',
            performedByType: 'system',
            performedById: 'system',
            performedByName: 'system',
            tenantId: 't1'
        });

        await expect(log.destroy()).rejects.toThrow('ActivityLog deletion is prohibited');
    });

    it('should reject bulk destruction', async () => {
        await expect(
            ActivityLog.destroy({ where: { tenantId: 't1' } })
        ).rejects.toThrow('ActivityLog bulk deletion is prohibited');
    });

    describe('Transaction participation', () => {
        beforeEach(async () => {
            // Need force: true to bypass immutability hooks, but sequelize doesn't bypass hooks on destroy.
            // We just sync to drop the table and recreate it.
            await sequelize.sync({ force: true });
        });

        it('should persist audit record when transaction commits', async () => {
            const transaction = await sequelize.transaction();
            await ActivityLog.create({
                entityType: 'test',
                entityId: '123',
                action: 'created',
                performedByType: 'system',
                performedById: 'system',
                performedByName: 'system',
                tenantId: 't1'
            }, { transaction });

            await transaction.commit();

            const logs = await ActivityLog.findAll();
            expect(logs.length).toBe(1);
            expect(logs[0].entityType).toBe('test');
        });

        it('should drop audit record when transaction rolls back', async () => {
            const transaction = await sequelize.transaction();
            await ActivityLog.create({
                entityType: 'test_rollback',
                entityId: '124',
                action: 'created',
                performedByType: 'system',
                performedById: 'system',
                performedByName: 'system',
                tenantId: 't1'
            }, { transaction });

            await transaction.rollback();

            const logs = await ActivityLog.findAll();
            expect(logs.length).toBe(0);
        });
    });
});
