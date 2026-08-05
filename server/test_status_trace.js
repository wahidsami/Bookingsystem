const path = require('path');
process.env.NODE_ENV = 'development';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'postgres';
process.env.POSTGRES_DB = 'rifah_clean';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5432';

const db = require('./src/models');
const tenantAppointmentController = require('./src/controllers/tenantAppointmentController');

async function runTrace() {
    try {
        await db.sequelize.authenticate();
        
        // Find any active appointment
        let appointment = await db.Appointment.findOne({
            where: {
                status: ['pending', 'confirmed', 'checked_in']
            },
            order: [['createdAt', 'DESC']]
        });

        if (!appointment) {
            console.log("No active appointment found, creating one for test...");
            const tenant = await db.Tenant.findOne();
            const platformUser = await db.PlatformUser.findOne();
            const service = await db.Service.findOne();
            const staff = await db.Staff.findOne();
            if (!tenant || !platformUser || !service || !staff) {
                console.log("Missing required entities to create appointment.");
                process.exit(0);
            }
            appointment = await db.Appointment.create({
                tenantId: tenant.id,
                platformUserId: platformUser.id,
                serviceId: service.id,
                staffId: staff.id,
                status: 'pending',
                paymentStatus: 'pending',
                price: 100,
                totalPaid: 0,
                remainingBalance: 100,
                remainderAmount: 100,
                outstandingAmount: 100,
                startTime: new Date(),
                endTime: new Date(Date.now() + 3600000),
                customerConfirmationStatus: 'not_required'
            });
        }

        console.log(`Testing with Appointment ID: ${appointment.id}`);

        const req = {
            tenantId: appointment.tenantId,
            userId: 'ad3d16c7-ae09-4ac6-8b5d-df35ce41d3d2', // valid uuid
            params: { id: appointment.id },
            body: { status: 'confirmed', notes: 'Testing runtime trace' }
        };

        const res = {
            status: (code) => {
                console.log(`[RESPONSE STATUS]: ${code}`);
                return res;
            },
            json: (data) => {
                console.log(`[RESPONSE JSON]:`, JSON.stringify(data, null, 2));
            }
        };

        console.log("\n================ TRACE START ================\n");
        await tenantAppointmentController.updateAppointmentStatus(req, res);
        console.log("\n================ TRACE END ================\n");

    } catch (err) {
        console.error("Script error:", err);
    } finally {
        await db.sequelize.close();
    }
}

runTrace();
