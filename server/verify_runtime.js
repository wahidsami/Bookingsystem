// Force config override BEFORE loading models
process.env.NODE_ENV = 'development';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'postgres';
process.env.POSTGRES_DB = 'rifah_clean';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5432';

const db = require('./src/models');
const orderService = require('./src/services/orderService');
const tenantCartController = require('./src/controllers/tenantCartController');
const { v4: uuidv4 } = require('uuid');

const verifyRuntime = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('Connected to db for verification');

        // Setup test data
        let tenant = await db.Tenant.findOne();
        if (!tenant) {
            tenant = await db.Tenant.create({
                id: uuidv4(),
                name: 'Test Tenant',
                status: 'active'
            });
        }
        let product = await db.Product.findOne({ where: { tenantId: tenant.id } });
        if (!product) {
            product = await db.Product.create({
                id: uuidv4(),
                tenantId: tenant.id,
                name: 'Test Product',
                name_en: 'Test Product',
                name_ar: 'منتج اختبار',
                price: 50,
                rawPrice: 50,
                stock: 10,
                soldCount: 0,
                isActive: true
            });
        }
        
        let giftPackage = await db.TenantGiftCardPackage.findOne({ where: { tenantId: tenant.id } });
        if (!giftPackage) {
            giftPackage = await db.TenantGiftCardPackage.create({
                id: uuidv4(),
                tenantId: tenant.id,
                title: 'Test Gift Card',
                title_en: 'Test Gift Card',
                title_ar: 'بطاقة هدية اختبار',
                priceAmount: 100,
                walletCreditAmount: 100,
                bonusAmount: 0,
                status: 'active'
            });
        }
        let platformUser = await db.PlatformUser.findOne();
        if (!platformUser) {
            platformUser = await db.PlatformUser.create({
                id: uuidv4(),
                firstName: 'Test',
                lastName: 'User',
                email: 'test' + Date.now() + '@test.com',
                phone: '+1234567890',
                passwordHash: 'dummy'
            });
        }
        const staff = await db.Staff.findOne({ where: { tenantId: tenant.id } });

        console.log('\n--- 1. Testing Product Sale ---');
        try {
            const initialStock = product.stock || 0;
            const initialSoldCount = product.soldCount || 0;

            const order = await orderService.createOrder({
                tenantId: tenant.id,
                platformUserId: platformUser.id,
                customerId: platformUser.id, // optional
                items: [{ productId: product.id, quantity: 1, price: product.price }],
                paymentMethod: 'pay_on_visit',
                orderType: 'pos',
                status: 'completed'
            });

            await orderService.updatePaymentStatus(order.id, 'paid', {
                processedBy: staff ? staff.id : null,
                transactionRef: `TEST-POS-${Date.now()}`
            });

            // Verify Product Sale
            const updatedProduct = await db.Product.findByPk(product.id);
            console.log('Stock reduced:', updatedProduct.stock < initialStock ? 'PASS' : 'FAIL');
            console.log('SoldCount updated:', updatedProduct.soldCount > initialSoldCount ? 'PASS' : 'FAIL');

            const orderItem = await db.OrderItem.findOne({ where: { orderId: order.id } });
            console.log('\nOrder');
            console.log('ID =', order.id);

            console.log('\nOrderItem');
            console.log('ID =', orderItem ? orderItem.id : 'MISSING');

            const orderTx = await db.PaymentTransaction.findOne({ where: { orderId: order.id } });
            console.log('\nPaymentTransaction');
            console.log('ID =', orderTx ? orderTx.id : 'MISSING');
            console.log('Type =', orderTx ? orderTx.type : 'N/A');

            const unifiedTx = await db.Transaction.findOne({ where: { orderId: order.id } });
            console.log('\nTransaction');
            console.log('ID =', unifiedTx ? unifiedTx.id : 'MISSING');
            console.log('Type =', unifiedTx ? unifiedTx.type : 'N/A');

            const orderInvoice = await db.CustomerInvoice.findOne({ where: { entityId: order.id, entityType: 'order' } });
            console.log('\nCustomerInvoice');
            console.log('ID =', orderInvoice ? orderInvoice.id : 'MISSING');

            const invoiceItems = orderInvoice ? await db.CustomerInvoiceItem.findAll({ where: { invoiceId: orderInvoice.id } }) : [];
            console.log('\nCustomerInvoiceItem');
            console.log('ID =', invoiceItems.length > 0 ? invoiceItems.map(i => i.id).join(', ') : 'MISSING');
        } catch(e) {
            console.log('Product Sale failed:', e.message);
        }

        console.log('\n--- 2. Testing Gift Card Sale ---');
        try {
            // Mock req/res for controller
            const req = {
                tenantId: tenant.id,
                userId: platformUser.id,
                tenantAccountId: null,
                staffId: staff ? staff.id : null,
                body: {
                    packageId: giftPackage.id,
                    customerFirstName: 'Test',
                    customerLastName: 'User',
                    customerEmail: `test${Date.now()}@test.com`,
                    customerPhone: `+1234567${Date.now().toString().slice(-4)}`,
                    amount: giftPackage.priceAmount,
                    paymentMethod: 'cash'
                }
            };

            let jsonResult = null;
            let statusCode = 200;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (data) => { jsonResult = data; return res; }
            };

            await tenantCartController.purchaseGiftCard(req, res);

            if (!jsonResult?.success) {
                console.log('Gift Card API failed:', jsonResult);
            } else {
                const giftTx = jsonResult.transaction;
                console.log('tenant_gift_card_transactions row exists:', giftTx ? 'PASS' : 'FAIL');

                const giftPaymentTx = await db.PaymentTransaction.findOne({
                    where: {
                        'metadata.giftCardTransactionId': giftTx.id
                    }
                });
                console.log('payment_transactions row exists:', giftPaymentTx ? 'PASS' : 'FAIL');

                const giftUnifiedTx = await db.Transaction.findOne({
                    where: {
                        'metadata.giftCardTransactionId': giftTx.id
                    }
                });
                console.log('transactions row exists:', giftUnifiedTx ? 'PASS' : 'FAIL');
            }
        } catch(e) {
            console.log('Gift Card Sale failed:', e.message);
        }

        console.log('\n--- 3. Testing Service Sale ---');
        const splitPaymentService = require('./src/services/splitPaymentService');
        let service = await db.Service.findOne({ where: { tenantId: tenant.id } });
        if (!service) {
            let category = await db.ServiceCategory.findOne();
            if (!category) {
                category = await db.ServiceCategory.create({
                    id: uuidv4(),
                    name_en: 'Test Category',
                    name_ar: 'فئة اختبار',
                    isActive: true
                });
            }
            service = await db.Service.create({
                id: uuidv4(),
                tenantId: tenant.id,
                categoryId: category.id,
                name_en: 'Test Service',
                name_ar: 'خدمة اختبار',
                duration: 60,
                price: 150,
                isActive: true
            });
        }
        
        let appointment = await db.Appointment.findOne({ where: { tenantId: tenant.id } });
        if (!appointment) {
            appointment = await db.Appointment.create({
                id: uuidv4(),
                tenantId: tenant.id,
                customerId: platformUser.id,
                serviceId: service.id,
                staffId: staff ? staff.id : uuidv4(),
                startTime: new Date(),
                endTime: new Date(Date.now() + 3600000),
                price: 150,
                totalAmount: 150,
                status: 'confirmed',
                paymentStatus: 'unpaid'
            });
        }
        try {
            await splitPaymentService.processPayment(appointment.id, {
                paymentMethod: 'cash',
                allocations: [{ paymentMethod: 'cash', amount: 150 }]
            });
            console.log('Service Sale PASS');
        } catch(e) {
            console.log('Service Sale FAILED:', e.message);
        }

    } catch (e) {
        console.error('Test script failed:', e);
    } finally {
        await db.sequelize.close();
    }
};

verifyRuntime();
