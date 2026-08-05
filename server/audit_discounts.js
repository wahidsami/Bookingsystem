require('dotenv').config();
const path = require('path');
const { db } = require('./src/models');
const { Op } = require('sequelize');

async function auditDiscounts() {
    try {
        console.log("Connecting to database...");
        
        let totalDiscounts = 0;
        
        const orders = await db.Order.findAll({
            where: {
                status: { [Op.in]: ['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed'] }
            },
            attributes: ['id', 'orderNumber', 'subtotal', 'taxAmount', 'shippingFee', 'totalAmount', 'platformFee', 'tenantId']
        });
        
        console.log(`Found ${orders.length} orders.`);
        console.log("\nOrders contributing to discounts:");
        
        for (const order of orders) {
            const subtotal = Number(order.subtotal || 0);
            const taxAmount = Number(order.taxAmount || 0);
            const shippingFee = Number(order.shippingFee || 0);
            const totalAmount = Number(order.totalAmount || 0);
            const discount = Math.max((subtotal + taxAmount + shippingFee) - totalAmount, 0);
            
            // Due to floating point math, check if discount > 0.01
            if (discount > 0.01) {
                totalDiscounts += discount;
                console.log(`Transaction (Order) ID: ${order.id} / ${order.orderNumber}`);
                console.log(`  Tenant ID: ${order.tenantId}`);
                console.log(`  Gross Amount (Subtotal): ${subtotal}`);
                console.log(`  Stored Discount: 0.00 (No explicit field)`);
                console.log(`  VAT (taxAmount): ${taxAmount}`);
                console.log(`  Platform Fee: ${order.platformFee}`);
                console.log(`  Coupon/Promotion/Gift Card: 0`);
                console.log(`  Final Amount (totalAmount): ${totalAmount}`);
                console.log(`  Calculated Mathematical Discount: ${discount.toFixed(2)}`);
                console.log('-------------------------------------------');
            }
        }
        
        console.log(`\nTotal Mathematical Discounts from Orders: ${totalDiscounts.toFixed(2)} SAR`);
        
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

auditDiscounts();
