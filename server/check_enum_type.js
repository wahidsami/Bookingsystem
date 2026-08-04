const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgres://postgres:postgres@localhost:5432/rifah_shared', { logging: false });
async function run() {
  const [results] = await sequelize.query(`
    SELECT e.enumlabel
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_payment_transactions_type'
    ORDER BY e.enumsortorder;
  `);
  console.log('ENUM VALUES:', results.map(r => r.enumlabel));
  await sequelize.close();
}
run().catch(console.error);
