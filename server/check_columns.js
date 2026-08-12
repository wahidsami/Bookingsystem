const db = require('./src/models');
(async () => {
  try {
    const columns = await db.sequelize.getQueryInterface().describeTable('Tenants');
    console.log(Object.keys(columns));
  } catch(e) {
    console.error(e.message);
  }
  process.exit();
})();
