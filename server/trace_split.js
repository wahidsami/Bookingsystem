const express = require('express');
const request = require('supertest');
const { app } = require('d:/Waheed/Refah/Bookingsystem/server/src/app');
const db = require('d:/Waheed/Refah/Bookingsystem/server/src/models');
const { generateToken } = require('d:/Waheed/Refah/Bookingsystem/server/src/utils/tokenUtils');
const tenantCartController = require('d:/Waheed/Refah/Bookingsystem/server/src/controllers/tenantCartController');
const orderService = require('d:/Waheed/Refah/Bookingsystem/server/src/services/orderService');
const splitPaymentService = require('d:/Waheed/Refah/Bookingsystem/server/src/services/splitPaymentService');

// Capture values
const captured = {
  reqBody: null,
  createOrderArgs: null,
  orderSubtotal: null,
  orderTaxAmount: null,
  orderTotalAmount: null,
  itemTotals: [],
  normalizeArgs: null,
  safeAmount: null,
  normalizedAllocations: null,
  allocationSum: null,
  difference: null,
  threshold: null,
  executionOrder: []
};

function logOrder(step) {
  captured.executionOrder.push(step);
}

// Patch tenantCartController.purchaseProducts
const originalPurchaseProducts = tenantCartController.purchaseProducts;
tenantCartController.purchaseProducts = async (req, res) => {
  logOrder('receive request');
  captured.reqBody = req.body;
  return await originalPurchaseProducts(req, res);
};

// Patch orderService.createOrder
const originalCreateOrder = orderService.createOrder;
orderService.createOrder = async (orderData, options) => {
  logOrder('createOrder');
  captured.createOrderArgs = orderData;
  const order = await originalCreateOrder(orderData, options);
  
  logOrder('Order.create');
  captured.orderSubtotal = order.subtotal;
  captured.orderTaxAmount = order.taxAmount;
  captured.orderTotalAmount = order.totalAmount;
  
  for (const item of order.items || []) {
    logOrder('OrderItem.create');
    captured.itemTotals.push({
      itemPrice: item.price,
      itemTotal: item.total,
      productRawPrice: item.product?.rawPrice,
      productPrice: item.product?.price,
      productTaxRate: item.product?.taxRate
    });
  }
  return order;
};

// Patch db.CustomerInvoice.create to log execution
const originalInvoiceCreate = db.CustomerInvoice.create;
db.CustomerInvoice.create = async function(...args) {
  logOrder('Invoice.create');
  return originalInvoiceCreate.apply(this, args);
};

// Patch normalizePaymentAllocations
const originalNormalize = splitPaymentService.normalizePaymentAllocations;
splitPaymentService.normalizePaymentAllocations = (args) => {
  logOrder('normalizePaymentAllocations');
  captured.normalizeArgs = args;
  try {
    const result = originalNormalize(args);
    captured.normalizedAllocations = result;
    return result;
  } catch (err) {
    if (err.message.includes('Payment allocations must add up to the payment amount')) {
       // We need to recreate the calculation to log the exact difference
       const { amount, paymentAllocations } = args;
       const parseMoney = (val) => Number(parseFloat(val || 0).toFixed(2));
       const safeAmount = parseMoney(amount);
       captured.safeAmount = safeAmount;
       const sum = paymentAllocations.reduce((acc, alloc) => acc + parseMoney(alloc.amount), 0);
       captured.allocationSum = sum;
       captured.difference = Math.abs(safeAmount - sum);
       captured.threshold = 0.01;
       logOrder('ROLLBACK');
    }
    throw err;
  }
};

async function run() {
  const tenant = await db.Tenant.findOne({ where: { isPlatform: false } });
  const tenantAccount = await db.TenantAccount.findOne({ where: { tenantId: tenant.id } });
  const product = await db.Product.findOne({ where: { tenantId: tenant.id, isActive: true, price: { [db.Sequelize.Op.gt]: 0 } } });
  
  if (!product) throw new Error('No active product found');
  
  console.log(`Testing with Product ID: ${product.id}, Price: ${product.price}, rawPrice: ${product.rawPrice}, taxRate: ${product.taxRate}`);

  const token = generateToken(tenantAccount);

  const payload = {
    items: [
      { productId: product.id, quantity: 1 }
    ],
    customerFirstName: 'Test',
    customerLastName: 'Forensics',
    paymentMethod: 'split',
    // Deliberately providing 79.35 (simulating bad frontend) so we can see the math
    paymentAllocations: [
      { method: 'cash', amount: "39.68" },
      { method: 'wallet', amount: "39.67" }
    ]
  };

  const res = await request(app)
    .post('/api/v1/tenant/cart/products/purchase')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);

  console.log("Status:", res.status);
  console.log("Response:", res.body);
  console.log("Captured Data:", JSON.stringify(captured, null, 2));
}

run().catch(console.error).finally(() => process.exit(0));
