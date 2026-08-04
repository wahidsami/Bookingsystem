const db = require('./server/src/models');

async function check() {
    try {
        const products = await db.Product.findAll();
        for (const p of products) {
            if (p.name_en && p.name_en.length > 200) {
                console.log('Long name_en:', p.id, p.name_en.length);
            }
            if (p.images && p.images.length > 0) {
                for (const img of p.images) {
                    if (img && img.length > 255) {
                        console.log('Long image url in product:', p.id, img.length, img.substring(0, 50));
                    }
                }
            }
        }
        console.log('Check complete');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
