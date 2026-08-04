const db = require('./server/src/models');

async function check() {
    try {
        const sql = `
            SELECT t.table_name, c.column_name, c.character_maximum_length, c.data_type
            FROM information_schema.columns c
            JOIN information_schema.tables t ON c.table_name = t.table_name
            WHERE t.table_schema = 'public' 
              AND t.table_name IN ('orders', 'order_items', 'transactions', 'payment_transactions', 'customer_invoices', 'customer_invoice_items')
              AND c.data_type = 'character varying'
              AND c.character_maximum_length = 255;
        `;
        const res = await db.sequelize.query(sql);
        console.log('Columns with varchar(255):');
        console.table(res[0]);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
