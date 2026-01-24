const db = require('../models');

const createTenantSchema = async (schema) => {
    try {
        await db.sequelize.createSchema(schema);
        console.log(`Schema ${schema} created successfully.`);

        // Here we would sync tenant-specific models to this schema
        // For now, we just create the schema

        return true;
    } catch (error) {
        console.error(`Error creating schema ${schema}:`, error);
        throw error;
    }
};

module.exports = {
    createTenantSchema
};
