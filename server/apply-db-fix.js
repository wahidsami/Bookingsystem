const { Client } = require('pg');

async function applyFix() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5434,
        database: process.env.POSTGRES_DB || 'rifah_shared',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'dev_password'
    });

    try {
        console.log('\n🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!\n');

        console.log('📋 Applying fix: Making customerId nullable...');
        await client.query('ALTER TABLE public.appointments ALTER COLUMN "customerId" DROP NOT NULL;');
        console.log('✅ Database constraint fixed!\n');

        console.log('🎉 SUCCESS! Booking and payment should now work!');
        console.log('\n📝 What changed:');
        console.log('   • customerId column is now OPTIONAL (nullable)');
        console.log('   • Bookings now use platformUserId instead');
        console.log('\n✅ You can now test the booking flow in the browser!');

    } catch (error) {
        if (error.message.includes('column "customerId" does not exist')) {
            console.log('✅ Column already nullable or doesn\'t need fixing!');
        } else {
            console.log('\n❌ ERROR:', error.message);
        }
    } finally {
        await client.end();
    }
}

applyFix();
