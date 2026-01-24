require('dotenv').config();

module.exports = {
    development: {
        username: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'dev_password',
        database: process.env.POSTGRES_DB || 'rifah_shared',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5434, // Docker exposes on 5434
        dialect: 'postgres',
        logging: false
    },
    production: {
        use_env_variable: 'DATABASE_URL',
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    }
};
