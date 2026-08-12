const { Sequelize } = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('./server/src/config/config.js')[env];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

async function checkColumns() {
    try {
        const [results] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'appointments';");
        console.log(results.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        sequelize.close();
    }
}
checkColumns();
