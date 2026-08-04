const db = require('./server/src/models');

async function check() {
    try {
        const sqlIndices = `
            SELECT
                t.relname AS table_name,
                i.relname AS index_name,
                a.attname AS column_name
            FROM
                pg_class t,
                pg_class i,
                pg_index ix,
                pg_attribute a
            WHERE
                t.oid = ix.indrelid
                AND i.oid = ix.indexrelid
                AND a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)
                AND t.relkind = 'r'
                AND t.relname = 'order_items'
                AND a.attname = 'product_image';
        `;
        const indices = await db.sequelize.query(sqlIndices);
        console.log('Indices on product_image:', indices[0]);

        const sqlConstraints = `
            SELECT
                tc.constraint_name, 
                tc.constraint_type, 
                kcu.column_name 
            FROM 
                information_schema.table_constraints tc 
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name 
                AND tc.table_schema = kcu.table_schema 
            WHERE 
                tc.table_name = 'order_items' 
                AND kcu.column_name = 'product_image';
        `;
        const constraints = await db.sequelize.query(sqlConstraints);
        console.log('Constraints on product_image:', constraints[0]);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
