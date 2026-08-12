const { Sequelize } = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require('./server/src/config/config.js')[env];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

async function checkColumns() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        const columns = await queryInterface.describeTable('appointments');
        console.log(Object.keys(columns));
    } catch (e) {
        console.error(e);
    } finally {
        sequelize.close();
    }
}
checkColumns();
