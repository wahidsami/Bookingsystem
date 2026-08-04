delete process.env.REDIS_URL;
process.env.NODE_ENV = 'development';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'postgres';
process.env.POSTGRES_DB = 'rifah_shared';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';

const redisService = require('./src/services/redisService');
redisService.initRedis = () => null;
redisService.getRedisClient = () => null;
redisService.acquireLock = async () => true;
redisService.releaseLock = async () => {};

const db = require('./src/models');
const publicTenantController = require('./src/controllers/publicTenantController');
const tenantCartController = require('./src/controllers/tenantCartController');

async function runEndToEndVerification() {
  console.log('====================================================');
  console.log('STARTING END-TO-END COMMERCIAL PIPELINE VERIFICATION');
  console.log('====================================================');

  await db.sequelize.authenticate();
  console.log('✓ Database connected.');

  // Find an active tenant
  const tenant = await db.Tenant.findOne({ where: { status: 'active' } });
  if (!tenant) throw new Error('No active tenant found');
  console.log(`Using Tenant: ${tenant.name} (${tenant.id})`);

  // Find or create a staff member
  let staff = await db.Staff.findOne({ where: { tenantId: tenant.id } });
  if (!staff) {
    staff = await db.Staff.create({
      tenantId: tenant.id,
      name: 'Test Stylist',
      email: 'stylist@example.com',
      phone: '+966500000888',
      isActive: true,
      workingHours: {
        monday: { isWorking: true, start: '08:00', end: '20:00' },
        tuesday: { isWorking: true, start: '08:00', end: '20:00' },
        wednesday: { isWorking: true, start: '08:00', end: '20:00' },
        thursday: { isWorking: true, start: '08:00', end: '20:00' },
        friday: { isWorking: true, start: '08:00', end: '20:00' },
        saturday: { isWorking: true, start: '08:00', end: '20:00' },
        sunday: { isWorking: true, start: '08:00', end: '20:00' }
      }
    });
  }
  console.log(`Using Staff: ${staff.name} (${staff.id})`);

  // Find a service
  let service = await db.Service.findOne({ where: { tenantId: tenant.id } });
  if (!service) {
    service = await db.Service.create({
      tenantId: tenant.id,
      name_en: 'Hair Styling',
      name_ar: 'تصفيف الشعر',
      price: 150.00,
      rawPrice: 150.00,
      duration: 60,
      isActive: true
    });
  } else {
    await service.update({ price: 150.00, rawPrice: 150.00 });
  }
  console.log(`Using Service: ${service.name_en || service.name_ar} (${service.id})`);

  if (db.ServiceEmployee) {
    await db.ServiceEmployee.findOrCreate({
      where: { staffId: staff.id, serviceId: service.id }
    }).catch(() => {});
  }

  // Find or create a product
  let product = await db.Product.findOne({ where: { tenantId: tenant.id, isAvailable: true } });
  if (!product) {
    product = await db.Product.create({
      tenantId: tenant.id,
      name_en: 'Test Shampoo',
      name_ar: 'شامبو اختبار',
      price: 50.00,
      rawPrice: 50.00,
      stock: 100,
      soldCount: 0,
      isAvailable: true
    });
  }
  console.log(`Using Product: ${product.name_en} (${product.id}) - Initial Stock: ${product.stock}, SoldCount: ${product.soldCount}`);

  // Find or create a user
  let user = await db.PlatformUser.findOne();
  if (!user) {
    user = await db.PlatformUser.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'testuser@example.com',
      phone: '+966500000999'
    });
  }
  console.log(`Using User: ${user.firstName} ${user.lastName} (${user.id})`);

  function mockRes() {
    let statusCode = 200;
    let jsonBody = null;
    return {
      status(code) { statusCode = code; return this; },
      json(data) { jsonBody = data; return this; },
      once() { return this; },
      on() { return this; },
      emit() { return this; },
      get result() { return { statusCode, jsonBody }; }
    };
  }

  // ==========================================
  // FLOW 1: APPOINTMENT SALE
  // ==========================================
  console.log('\n--- FLOW 1: APPOINTMENT SALE ---');
  const futureDays = Math.floor(Math.random() * 100) + 1;
  const targetDate = new Date(Date.now() + futureDays * 86400000);
  const dateStr = targetDate.toISOString().split('T')[0];
  const apptReq = {
    params: { tenantId: tenant.id },
    body: {
      serviceId: service.id,
      staffId: staff.id,
      date: dateStr,
      time: '14:00',
      startTime: targetDate.toISOString(),
      customerName: 'Public Customer',
      customerEmail: 'public_customer@example.com',
      customerPhone: '+966500000001',
      paymentMethod: 'online-full'
    }
  };
  const apptRes = mockRes();
  await publicTenantController.createPublicBooking(apptReq, apptRes);
  console.log('Create Public Booking Result:', apptRes.result.statusCode, JSON.stringify(apptRes.result.jsonBody));

  const newApptId = apptRes.result.jsonBody?.data?.bookingId || apptRes.result.jsonBody?.data?.appointment?.id;
  if (!newApptId) throw new Error('Failed to create appointment');
  const [apptRows] = await db.sequelize.query(`SELECT id, status, "paymentStatus", price FROM appointments WHERE id = '${newApptId}';`);
  const [apptPtRows] = await db.sequelize.query(`SELECT id, type, status, amount FROM payment_transactions WHERE "appointment_id" = '${newApptId}';`);
  const [apptInvRows] = await db.sequelize.query(`SELECT id, status, "totalAmount" FROM customer_invoices WHERE "entityType" = 'appointment' AND "entityId" = '${newApptId}';`);
  const apptInvId = apptInvRows[0]?.id;
  const [apptInvItemRows] = apptInvId ? await db.sequelize.query(`SELECT id, "nameEn", "lineTotal" FROM customer_invoice_items WHERE "invoiceId" = '${apptInvId}';`) : [[]];
  const [apptLedgerRows] = await db.sequelize.query(`SELECT id, "entityType", amount, status FROM financial_ledger_entries WHERE "entityType" = 'Booking' AND "entityId" = '${newApptId}';`);

  console.log('SQL Verification [Appointment]:');
  console.log('  appointments COUNT:', apptRows.length, apptRows[0] || {});
  console.log('  payment_transactions COUNT:', apptPtRows.length, apptPtRows[0] || {});
  console.log('  customer_invoices COUNT:', apptInvRows.length, apptInvRows[0] || {});
  console.log('  customer_invoice_items COUNT:', apptInvItemRows.length, apptInvItemRows[0] || {});
  console.log('  financial_ledger_entries COUNT:', apptLedgerRows.length, apptLedgerRows[0] || {});

  // ==========================================
  // FLOW 2: PRODUCT SALE
  // ==========================================
  console.log('\n--- FLOW 2: PRODUCT SALE ---');
  const initialStock = Number(product.stock);
  const initialSoldCount = Number(product.soldCount);

  const productReq = {
    tenantId: tenant.id,
    staffId: null,
    userId: user.id,
    body: {
      items: [{ productId: product.id, quantity: 2 }],
      customerName: 'Product Buyer',
      customerEmail: 'buyer@example.com',
      customerPhone: '+966500000002',
      paymentMethod: 'cash'
    }
  };
  const productRes = mockRes();
  await tenantCartController.purchaseProducts(productReq, productRes);
  console.log('Purchase Products Result:', productRes.result.statusCode, JSON.stringify(productRes.result.jsonBody));

  const newOrderId = productRes.result.jsonBody?.order?.id || productRes.result.jsonBody?.data?.id || productRes.result.jsonBody?.data?.order?.id;
  if (!newOrderId) throw new Error('Failed to create order');

  // Verify Product SQL
  const [orderRows] = await db.sequelize.query(`SELECT id, "orderNumber", status, "paymentStatus", "totalAmount" FROM orders WHERE id = '${newOrderId}';`);
  const [orderItemRows] = await db.sequelize.query(`SELECT id, "productId", quantity, "totalPrice" FROM order_items WHERE "orderId" = '${newOrderId}';`);
  const [orderPtRows] = await db.sequelize.query(`SELECT id, type, status, amount FROM payment_transactions WHERE "order_id" = '${newOrderId}';`);
  const [orderInvRows] = await db.sequelize.query(`SELECT id, status, "totalAmount" FROM customer_invoices WHERE "entityType" = 'order' AND "entityId" = '${newOrderId}';`);
  const orderInvId = orderInvRows[0]?.id;
  const [orderInvItemRows] = orderInvId ? await db.sequelize.query(`SELECT id, "nameEn", quantity, "lineTotal" FROM customer_invoice_items WHERE "invoiceId" = '${orderInvId}';`) : [[]];
  const [orderLedgerRows] = await db.sequelize.query(`SELECT id, "entityType", amount, status FROM financial_ledger_entries WHERE "entityType" = 'Order' AND "entityId" = '${newOrderId}';`);
  const [updatedProductRows] = await db.sequelize.query(`SELECT id, stock, "soldCount" FROM products WHERE id = '${product.id}';`);

  const updatedStock = Number(updatedProductRows[0].stock);
  const updatedSoldCount = Number(updatedProductRows[0].soldCount);

  console.log('SQL Verification [Product]:');
  console.log('  orders COUNT:', orderRows.length, orderRows[0] || {});
  console.log('  order_items COUNT:', orderItemRows.length, orderItemRows[0] || {});
  console.log('  payment_transactions COUNT:', orderPtRows.length, orderPtRows[0] || {});
  console.log('  customer_invoices COUNT:', orderInvRows.length, orderInvRows[0] || {});
  console.log('  customer_invoice_items COUNT:', orderInvItemRows.length, orderInvItemRows[0] || {});
  console.log('  financial_ledger_entries COUNT:', orderLedgerRows.length, orderLedgerRows[0] || {});
  console.log(`  Product stock: ${initialStock} -> ${updatedStock} (Delta: ${updatedStock - initialStock})`);
  console.log(`  Product soldCount: ${initialSoldCount} -> ${updatedSoldCount} (Delta: ${updatedSoldCount - initialSoldCount})`);

  // ==========================================
  // FLOW 3: GIFT CARD SALE
  // ==========================================
  console.log('\n--- FLOW 3: GIFT CARD SALE ---');

  // Find a gift card package or mock one
  let giftPackage = await db.TenantGiftCardPackage.findOne({ where: { tenantId: tenant.id } });
  if (!giftPackage) {
    giftPackage = await db.TenantGiftCardPackage.create({
      tenantId: tenant.id,
      title_en: 'VIP Gift Card',
      title_ar: 'بطاقة هدايا',
      priceAmount: 100.00,
      walletCreditAmount: 100.00,
      isActive: true
    });
  }

  const giftReq = {
    tenantId: tenant.id,
    staffId: null,
    userId: user.id,
    body: {
      packageId: giftPackage.id,
      customerName: 'Gift Customer',
      recipientName: 'Gift Recipient',
      recipientEmail: 'recipient@example.com',
      recipientPhone: '+966500000003',
      paymentMethod: 'cash'
    }
  };
  const giftRes = mockRes();
  await tenantCartController.purchaseGiftCard(giftReq, giftRes);
  console.log('Purchase Gift Card Result:', giftRes.result.statusCode, JSON.stringify(giftRes.result.jsonBody));

  const newGiftTxId = giftRes.result.jsonBody?.transaction?.id || giftRes.result.jsonBody?.data?.transactionId || giftRes.result.jsonBody?.data?.id;
  if (!newGiftTxId) throw new Error('Failed to create gift card transaction');

  const [giftTxRows] = await db.sequelize.query(`SELECT id, "tenantId", "purchaseAmount", status FROM tenant_gift_card_transactions WHERE id = '${newGiftTxId}';`);
  const [giftPtRows] = await db.sequelize.query(`SELECT id, type, status, amount, metadata FROM payment_transactions WHERE metadata->>'giftCardTransactionId' = '${newGiftTxId}';`);
  const [giftLedgerRows] = await db.sequelize.query(`SELECT id, "entityType", amount, status FROM financial_ledger_entries WHERE "entityType" = 'GiftCard' AND "entityId" = '${newGiftTxId}';`);

  console.log('SQL Verification [Gift Card]:');
  console.log('  tenant_gift_card_transactions COUNT:', giftTxRows.length, giftTxRows[0] || {});
  console.log('  payment_transactions COUNT:', giftPtRows.length, giftPtRows[0] || {});
  console.log('  financial_ledger_entries COUNT:', giftLedgerRows.length, giftLedgerRows[0] || {});

  console.log('\n====================================================');
  console.log('ALL FLOWS EXECUTED SUCCESSFULLY!');
  console.log('====================================================');
  await db.sequelize.close();
}

runEndToEndVerification().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
