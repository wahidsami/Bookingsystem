/**
 * Check users in database
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.POSTGRES_DB || 'rifah_shared',
    process.env.POSTGRES_USER || 'postgres',
    process.env.POSTGRES_PASSWORD || 'dev_password',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5434,
        dialect: 'postgres',
        logging: false
    }
);

async function checkUsers() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established.\n');

        // Check platform users
        const [users] = await sequelize.query(`
            SELECT 
                id,
                email,
                phone,
                "firstName",
                "lastName",
                "emailVerified",
                "phoneVerified",
                "isActive",
                "createdAt"
            FROM platform_users
            ORDER BY "createdAt" DESC;
        `);

        console.log(`📊 Found ${users.length} platform users:\n`);
        
        if (users.length === 0) {
            console.log('   No users found in database.');
        } else {
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.email}`);
                console.log(`   Phone: ${user.phone}`);
                console.log(`   Name: ${user.firstName} ${user.lastName}`);
                console.log(`   Email Verified: ${user.emailVerified}`);
                console.log(`   Phone Verified: ${user.phoneVerified}`);
                console.log(`   Active: ${user.isActive}`);
                console.log(`   Created: ${user.createdAt}`);
                console.log('');
            });
        }

        // Check for specific emails
        console.log('\n🔍 Checking for specific emails:');
        const emails = ['wahidsami@gmail.com', 'wahid@gmail.com'];
        
        for (const email of emails) {
            const [results] = await sequelize.query(`
                SELECT email, phone, "firstName", "lastName", "createdAt"
                FROM platform_users
                WHERE email = :email;
            `, {
                replacements: { email }
            });
            
            if (results.length > 0) {
                console.log(`✅ ${email} - EXISTS`);
                console.log(`   Phone: ${results[0].phone}`);
                console.log(`   Name: ${results[0].firstName} ${results[0].lastName}`);
            } else {
                console.log(`❌ ${email} - NOT FOUND`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

checkUsers();

