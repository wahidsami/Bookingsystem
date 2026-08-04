const models = require('./src/models');
const { sequelize } = models;

async function check() {
    try {
        console.log("=== DB CONNECTION INFO ===");
        console.log("Database config:", sequelize.config.database);
        console.log("Host config:", sequelize.config.host);
        console.log("Port config:", sequelize.config.port);
        
        let [dbRes] = await sequelize.query("SELECT current_database();");
        console.log("\nSELECT current_database():", dbRes[0].current_database);

        let [schemaRes] = await sequelize.query("SELECT current_schema();");
        console.log("SELECT current_schema():", schemaRes[0].current_schema);

        let [pathRes] = await sequelize.query("SHOW search_path;");
        console.log("SHOW search_path:", pathRes[0].search_path);

        console.log("\n=== TABLES IN PUBLIC SCHEMA ===");
        let [tables] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public';");
        for (let t of tables) {
            console.log(t.table_name);
        }
        
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sequelize.close();
    }
}

check();
