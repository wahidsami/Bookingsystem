require('dotenv').config();

const { execFileSync } = require('child_process');
const path = require('path');

const sequelizeCli = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const migrateEnv = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL
    ? 'production'
    : 'development';

try {
    execFileSync(
        sequelizeCli,
        ['--yes', 'sequelize-cli', 'db:migrate', '--env', migrateEnv],
        {
            stdio: 'inherit',
            cwd: path.resolve(__dirname, '..')
        }
    );
} catch (error) {
    console.error('Database migration step failed:', error.message);
    process.exit(1);
}

require('./index.js');
