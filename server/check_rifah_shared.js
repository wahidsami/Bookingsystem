const { Sequelize } = require('sequelize');

const testDbConnection = async (databaseName) => {
    const sequelize = new Sequelize(databaseName, 'postgres', 'postgres', {
        host: 'localhost',
        dialect: 'postgres',
        logging: false
    });

    try {
        await sequelize.authenticate();
        console.log(`\n--- Tables in ${databaseName} ---`);
        const [results] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        console.log(results.map(r => r.table_name).join(', '));
    } catch (e) {
        console.error(`Failed to connect to ${databaseName}:`, e.message);
    } finally {
        await sequelize.close();
    }
};

(async () => {
    await testDbConnection('rifah_shared');
})();
