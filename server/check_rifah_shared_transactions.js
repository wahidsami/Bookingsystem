const { Sequelize } = require('sequelize');

const testDbConnection = async (databaseName) => {
    const sequelize = new Sequelize(databaseName, 'postgres', 'postgres', {
        host: 'localhost',
        dialect: 'postgres',
        logging: false
    });

    try {
        await sequelize.authenticate();
        console.log(`\n--- Schema for public.transactions in ${databaseName} ---`);
        const [results] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'transactions'
            ORDER BY ordinal_position;
        `);
        console.table(results);
    } catch (e) {
        console.error(`Failed to connect to ${databaseName}:`, e.message);
    } finally {
        await sequelize.close();
    }
};

(async () => {
    await testDbConnection('rifah_shared');
})();
