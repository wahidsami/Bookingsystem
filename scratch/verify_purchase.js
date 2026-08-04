const db = require('./server/src/models');
const tenantCartController = require('./server/src/controllers/tenantCartController');
const { v4: uuidv4 } = require('uuid');

// A long URL that would have failed with VARCHAR(255)
const LONG_URL = 'https://s3.eu-central-1.amazonaws.com/bookingsystem-tenant-uploads/products/123456789.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20231024%2Feu-central-1%2Fs3%2Faws4_request&X-Amz-Date=20231024T120000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aee6587664654b0c2e39986b6EXAMPLE1234567890abcdef1234567890abcdef&extra_padding_to_ensure_length_is_well_over_255_characters_so_it_fails_on_old_schema=1234567890123456789012345678901234567890';

async function setupTestData() {
    // 1. Get a tenant
    const tenant = await db.Tenant.findOne();
    if (!tenant) throw new Error('No tenant found');
    
    // 2. Get a platform user
    const user = await db.PlatformUser.findOne();
    if (!user) throw new Error('No user found');
    
    // 3. Create a test product with a long image URL
    const product = await db.Product.create({
        tenantId: tenant.id,
        name_en: 'Test Product Long URL',
        name_ar: 'Test Product Long URL Ar',
        rawPrice: 100,
        images: [LONG_URL],
        stock: 10,
        soldCount: 0
    });
    
    return { tenant, user, product };
}

async function verify() {
    console.log('Starting verification...');
    try {
        const { tenant, user, product } = await setupTestData();
        console.log(`Created test product ${product.id} with stock ${product.stock}`);
        
        // Mock request to tenantCartController.purchaseProducts
        const req = {
            tenantId: tenant.id,
            userId: user.id,
            body: {
                items: [
                    { productId: product.id, quantity: 2 }
                ],
                customerId: user.id,
                recipientType: 'self',
                notes: 'Verification test order',
                paymentMethod: 'cash'
            }
        };
        
        const res = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { this.data = data; return this; },
            statusCode: 200,
            data: null
        };
        
        // Execute purchase
        await tenantCartController.purchaseProducts(req, res);
        
        if (res.statusCode !== 200) {
            console.error('Purchase failed:', res.data);
            process.exit(1);
        }
        
        console.log('Purchase succeeded! Order ID:', res.data.order.id);
        const orderId = res.data.order.id;
        
        // 1. Verify Inventory updates correctly
        const updatedProduct = await db.Product.findByPk(product.id);
        console.log(`Inventory updated: expected 8, got ${updatedProduct.stock}`);
        if (updatedProduct.stock !== 8) throw new Error('Inventory mismatch');
        
        // 2. Verify OrderItem stores the complete image URL
        const orderItem = await db.OrderItem.findOne({ where: { orderId } });
        if (!orderItem) throw new Error('OrderItem not found');
        console.log(`OrderItem productImage length: ${orderItem.productImage?.length}`);
        if (orderItem.productImage !== LONG_URL) throw new Error('OrderItem image mismatch');
        
        // 3. Verify CustomerInvoice is generated
        const invoice = await db.CustomerInvoice.findOne({ where: { entityType: 'order', entityId: orderId } });
        console.log(`CustomerInvoice exists: ${!!invoice}`);
        if (!invoice) throw new Error('CustomerInvoice missing');
        
        // 4. Verify PaymentTransaction is generated
        const paymentTx = await db.PaymentTransaction.findOne({ where: { orderId } });
        console.log(`PaymentTransaction exists: ${!!paymentTx}`);
        if (!paymentTx) throw new Error('PaymentTransaction missing');
        
        // 5. Verify Transaction ledger is generated
        const ledgerTx = await db.Transaction.findOne({ where: { orderId } });
        console.log(`Transaction ledger exists: ${!!ledgerTx}`);
        if (!ledgerTx) throw new Error('Transaction ledger missing');
        
        console.log('✅ ALL VERIFICATIONS PASSED');
        
    } catch (err) {
        console.error('Verification error:', err);
    } finally {
        process.exit(0);
    }
}
verify();
