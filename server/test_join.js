const models = require('./src/models');
const { sequelize } = models;
sequelize.options.logging = console.log; // Enable logging

async function testJoin() {
    try {
        await sequelize.authenticate();
        console.log("Connected to", sequelize.config.database);

        const appointments = await models.Appointment.findAll({
            include: [{
                model: models.PaymentTransaction,
                as: 'paymentTransactions'
            }],
            limit: 1
        });
        
        console.log("Appointment query successful.");
    } catch (err) {
        console.error("ERROR during Appointment join:");
        console.error(err.message);
    } finally {
        await sequelize.close();
    }
}

testJoin();
