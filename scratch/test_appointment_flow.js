const { testDatabaseConnection } = require('../server/src/config/database');
const db = require('../server/src/models');

async function runTests() {
    await testDatabaseConnection();
    console.log('Test logic here');
    process.exit(0);
}

runTests().catch(console.error);
