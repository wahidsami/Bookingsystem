process.env.NODE_ENV = 'development';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'postgres';
process.env.POSTGRES_DB = 'rifah_clean';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5432';

const { Sequelize } = require('sequelize');
const db = require('./src/models');
const orderService = require('./src/services/orderService');
const { v4: uuidv4 } = require('uuid');

async function testRealFlow() {
    try {
        const tenant = await db.Tenant.findOne();
        const product = await db.Product.findOne({ where: { tenantId: tenant.id } });
        const platformUser = await db.PlatformUser.findOne();

        console.log('Testing createOrder with Product ID:', product.id);

        const order = await orderService.createOrder({
            platformUserId: platformUser.id,
            tenantId: tenant.id,
            items: [{ productId: product.id, quantity: 1 }],
            paymentMethod: 'pay_on_visit',
            deliveryType: 'pickup',
            notes: 'test'
        });

        console.log('Order created:', order.id);

        await orderService.updatePaymentStatus(order.id, 'paid', {
            paymentMethod: 'cash',
            processedBy: null,
            metadata: { source: 'tenant_cart_products' }
        });

        console.log('Payment updated');
    } catch (err) {
        console.error('ERROR in real flow:', err);
    } finally {
        process.exit(0);
    }
}

testRealFlow();
