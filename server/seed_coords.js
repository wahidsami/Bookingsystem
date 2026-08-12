const db = require('./src/models');

async function seed() {
    try {
        const tenant = await db.Tenant.findOne({ where: { slug: 'luxury-spa' } });
        if (tenant) {
            await tenant.update({
                coordinates: {
                    lat: 24.7136,
                    lng: 46.6753
                }
            });
            console.log('Updated luxury-spa with coordinates: Riyadh, Saudi Arabia');
        } else {
            console.log('luxury-spa not found');
            const anyTenant = await db.Tenant.findOne();
            if (anyTenant) {
                 await anyTenant.update({
                    coordinates: {
                        lat: 24.7136,
                        lng: 46.6753
                    }
                });
                console.log(`Updated ${anyTenant.slug} with coordinates: Riyadh, Saudi Arabia`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
seed();
