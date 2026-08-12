const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('rifah', 'postgres', 'admin', {
    host: 'localhost',
    dialect: 'postgres',
});
sequelize.query('SELECT "workingHours", "googleMapLink" FROM tenants LIMIT 1').then(res => {
    console.log(JSON.stringify(res[0], null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
