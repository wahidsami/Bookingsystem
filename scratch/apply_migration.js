const db = require('./server/src/models');
const migration = require('./server/migrations/20260804125722-change-order-item-product-image-to-text.js');

async function apply() {
    try {
        await migration.up(db.sequelize.getQueryInterface(), db.Sequelize);
        console.log('Migration applied successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}
apply();
