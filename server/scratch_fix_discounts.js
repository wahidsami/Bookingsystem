const db = require('./src/models');

async function fixOrderDiscounts() {
    try {
        console.log('Connecting to database...');
        
        const invoices = await db.CustomerInvoice.findAll({
            where: {
                entityType: 'order'
            }
        });
        
        console.log(`Found ${invoices.length} order invoices.`);
        
        let dirtyCount = 0;
        for (const invoice of invoices) {
            const discount = Number(invoice.discountAmount);
            if (discount > 0) {
                dirtyCount++;
                console.log(`Invoice ${invoice.invoiceNumber} has dirty discount: ${discount}`);
                invoice.discountAmount = 0;
                await invoice.save();
                console.log(` -> Fixed to 0`);
            }
        }
        
        console.log(`Fixed ${dirtyCount} invoices.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixOrderDiscounts();
