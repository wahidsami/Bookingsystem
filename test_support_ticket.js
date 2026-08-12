const db = require('./server/src/models');
const supportService = require('./server/src/services/supportPlatformService');

async function run() {
    let tenant, user, category;
    try {
        // Find a tenant
        tenant = await db.Tenant.findOne({ where: { isActive: true } });
        if (!tenant) throw new Error("No active tenant found");

        // Find a leaf category
        category = await db.SupportCategory.findOne({
            where: { isActive: true },
            order: [['createdAt', 'DESC']]
        });
        
        // We'll just create a mock actor
        const actor = {
            actorType: 'tenant_admin',
            actorId: '00000000-0000-0000-0000-000000000000',
            tenantId: tenant.id
        };

        const result = await supportService.createTicket({
            actor,
            tenantId: tenant.id,
            customerPlatformUserId: null,
            supportCategoryId: category ? category.id : null,
            subject: "Test Ticket Fix",
            description: "Testing ticket auto generation",
            priority: "low",
            source: "system",
            sourceChannel: "system"
        });

        console.log("Success! Ticket created:", result.ticketNumber);
        
        // Verify it was created
        const createdTicket = await db.SupportTicket.findByPk(result.id);
        if (createdTicket && createdTicket.ticketNumber) {
             console.log("Verified in DB:", createdTicket.ticketNumber);
        } else {
             console.error("Not found in DB!");
        }

    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        await db.sequelize.close();
    }
}

run();
