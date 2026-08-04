const { Sequelize } = require('sequelize');
const config = require('./server/config/config.json');
const dbConfig = config.development;

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    port: dbConfig.port || 5432,
    logging: false
});

async function checkConstraints() {
    try {
        await sequelize.authenticate();
        
        const res1 = await sequelize.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'public.transactions'::regclass;
        `);
        console.log("TRANSACTIONS CONSTRAINTS:", res1[0]);

        const res2 = await sequelize.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'public.payment_transactions'::regclass;
        `);
        console.log("PAYMENT_TRANSACTIONS CONSTRAINTS:", res2[0]);

    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

checkConstraints();
