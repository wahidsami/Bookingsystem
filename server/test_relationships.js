// Quick test to check if staff-service relationships exist
const db = require('./src/models');

async function testRelationships() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Test 1: Get a service with its staff
        console.log('Test 1: Get service with staff...');
        const service = await db.Service.findOne({
            include: [{ model: db.Staff }]
        });

        if (service) {
            console.log(`Service: ${service.name_en}`);
            console.log(`Staff count: ${service.Staff ? service.Staff.length : 0}`);
            if (service.Staff && service.Staff.length > 0) {
                console.log(`First staff: ${service.Staff[0].name}`);
            }
        }

        console.log('\n✅ Test complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testRelationships();
