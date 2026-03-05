const db = require('./src/models');
const { Op } = require('sequelize');

async function checkQueries() {
    await db.sequelize.authenticate();
    console.log('✅ Connected to DB');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const checks = [
        { name: '1. Tenant Count', fn: () => db.Tenant.count() },
        { name: '2. Pending Tenant Count', fn: () => db.Tenant.count({ where: { status: 'pending' } }) },
        { name: '3. PlatformUser Count', fn: () => db.PlatformUser.count() },
        { name: '4. Trans Sum', fn: () => db.Transaction.sum('platformFee', { where: { status: 'completed' } }) },
        { name: '5. Appointment Count', fn: () => db.Appointment.count() },
        {
            name: '6. Tenant Types', fn: () => db.Tenant.findAll({
                attributes: ['businessType', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
                where: { status: 'approved' },
                group: ['businessType']
            })
        },
        {
            name: '7. Chart: Users', fn: () => db.PlatformUser.findAll({
                attributes: [
                    [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
                ],
                where: { createdAt: { [Op.gte]: thisMonthStart } },
                group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))]
            })
        },
        {
            name: '8. ActivityLog Order', fn: () => db.ActivityLog.findAll({
                order: [['createdAt', 'DESC']],
                limit: 20
            })
        }
    ];

    for (const check of checks) {
        try {
            const res = await check.fn();
            console.log(`✅ ${check.name} -> OK (Value: ${Array.isArray(res) ? 'Array[' + res.length + ']' : res})`);
        } catch (e) {
            console.error(`❌ ${check.name} -> ERROR: ${e.message}`);
        }
    }
    process.exit(0);
}

checkQueries().catch(console.error);
