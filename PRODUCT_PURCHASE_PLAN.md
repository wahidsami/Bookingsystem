# 🛍️ Product Purchase System - Comprehensive Plan

## 📋 Executive Summary

This plan outlines the implementation of a complete product purchase system with multiple payment options (Pay Online, Pay on Delivery, Pay When Visit) and order tracking capabilities.

---

## 🎯 System Architecture Overview

### Current State:
- ✅ **Product Model** exists with inventory (stock) management
- ✅ **Payment Gateway** exists (fake payment service)
- ✅ **Transaction Model** exists for payment tracking
- ❌ **Order Model** - NEEDS TO BE CREATED
- ❌ **Order Items Model** - NEEDS TO BE CREATED (for multiple products per order)
- ❌ **Shipping Address Model** - NEEDS TO BE CREATED (for delivery)

### Target State:
- Complete order management system
- Multiple payment options
- Inventory tracking
- Order status tracking
- Delivery tracking (optional)

---

## 📊 Database Schema Design

### 1. **Order Model** (New)
```javascript
{
  id: UUID (PK)
  orderNumber: STRING (unique, e.g., "ORD-2026-001234")
  platformUserId: UUID (FK → platform_users)
  tenantId: UUID (FK → tenants)
  
  // Order Details
  status: ENUM('pending', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded')
  paymentMethod: ENUM('online', 'cash_on_delivery', 'pay_on_visit')
  paymentStatus: ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded')
  
  // Pricing
  subtotal: DECIMAL(10,2)  // Sum of all items before tax
  taxAmount: DECIMAL(10,2)  // Total tax
  shippingFee: DECIMAL(10,2)  // Delivery fee (if applicable)
  platformFee: DECIMAL(10,2)  // Platform commission
  totalAmount: DECIMAL(10,2)  // Final total
  
  // Delivery/Pickup
  deliveryType: ENUM('pickup', 'delivery')
  shippingAddress: JSONB  // {street, city, building, floor, apartment, phone, notes}
  pickupDate: DATE  // When customer will pick up (if pay_on_visit)
  
  // Tracking
  trackingNumber: STRING  // For shipped orders
  estimatedDeliveryDate: DATE
  deliveredAt: DATE
  
  // Metadata
  notes: TEXT  // Customer notes
  tenantNotes: TEXT  // Internal notes
  
  timestamps
}
```

### 2. **OrderItem Model** (New)
```javascript
{
  id: UUID (PK)
  orderId: UUID (FK → orders)
  productId: UUID (FK → products)
  
  // Product snapshot (at time of order)
  productName: STRING  // Snapshot
  productPrice: DECIMAL(10,2)  // Snapshot
  productImage: STRING  // Snapshot
  
  quantity: INTEGER
  unitPrice: DECIMAL(10,2)  // Price per unit at time of order
  totalPrice: DECIMAL(10,2)  // quantity * unitPrice
  
  timestamps
}
```

### 3. **ShippingAddress Model** (Optional - can use JSONB in Order)
```javascript
// Can be stored as JSONB in Order model instead of separate table
// For simplicity, we'll use JSONB in Order model
```

---

## 💳 Payment Options & Flow

### Option 1: **Pay Online** 💳
**Flow:**
1. Customer clicks "Buy Now" → Selects "Pay Online"
2. Redirects to payment page (similar to booking payment)
3. Customer enters card details
4. Payment processed → Order created with `paymentStatus: 'paid'`
5. Inventory deducted immediately
6. Order status: `confirmed` → `processing` → `ready_for_pickup` / `shipped`

**When to use:**
- Customer wants to pay immediately
- Product will be shipped/delivered
- Customer wants to secure the order

---

### Option 2: **Pay on Delivery (POD)** 🚚
**Flow:**
1. Customer clicks "Buy Now" → Selects "Pay on Delivery"
2. Customer enters shipping address
3. Order created with `paymentStatus: 'pending'`, `paymentMethod: 'cash_on_delivery'`
4. Inventory **reserved** (not deducted yet)
5. Order status: `confirmed` → `processing` → `shipped` → `delivered`
6. When delivered, tenant marks as "Paid" → `paymentStatus: 'paid'`
7. Inventory deducted when payment confirmed

**When to use:**
- Customer prefers to pay when receiving product
- Local delivery available
- Customer wants to verify product before payment

---

### Option 3: **Pay When Visit** 🏢
**Flow:**
1. Customer clicks "Buy Now" → Selects "Pay When Visit"
2. Customer selects pickup date/time (optional)
3. Order created with `paymentStatus: 'pending'`, `paymentMethod: 'pay_on_visit'`
4. Inventory **reserved** (not deducted yet)
5. Order status: `confirmed` → `processing` → `ready_for_pickup`
6. Customer visits salon → Tenant marks as "Paid" → `paymentStatus: 'paid'`
7. Inventory deducted when payment confirmed

**When to use:**
- Customer will pick up at salon
- Customer wants to see product before paying
- Local pickup preferred

---

## 🔄 Order Status Lifecycle

```
pending → confirmed → processing → [ready_for_pickup | shipped] → delivered → completed
                                                                    ↓
                                                                 cancelled
                                                                    ↓
                                                                 refunded
```

**Status Definitions:**
- **pending**: Order just created, awaiting confirmation
- **confirmed**: Order confirmed, payment received (or reserved for POD/POV)
- **processing**: Tenant is preparing the order
- **ready_for_pickup**: Order ready for customer pickup
- **shipped**: Order shipped (for delivery orders)
- **delivered**: Order delivered to customer
- **completed**: Order fulfilled, payment confirmed
- **cancelled**: Order cancelled (before fulfillment)
- **refunded**: Order refunded

---

## 📦 Inventory Management

### Strategy:
1. **Pay Online**: Deduct inventory immediately upon order confirmation
2. **POD/POV**: Reserve inventory (deduct when payment confirmed)
3. **Stock Check**: Before creating order, verify stock availability
4. **Low Stock Alert**: Alert tenant when stock < threshold

### Implementation:
```javascript
// When order created (Pay Online)
if (paymentMethod === 'online' && paymentStatus === 'paid') {
  product.stock -= quantity;
  product.soldCount += quantity;
}

// When order created (POD/POV)
if (paymentMethod === 'cash_on_delivery' || paymentMethod === 'pay_on_visit') {
  // Reserve stock (don't deduct yet)
  // Create order with reserved quantity
}

// When payment confirmed (POD/POV)
if (paymentStatus changes to 'paid') {
  product.stock -= quantity;
  product.soldCount += quantity;
}
```

---

## 🚚 Delivery/Tracking System

### Basic Tracking (Phase 1):
- Manual tracking by tenant
- Tenant updates order status
- Customer sees status updates in their order history

### Advanced Tracking (Phase 2 - Future):
- Integration with delivery service API
- Automatic tracking number updates
- Real-time delivery status
- SMS/Email notifications

### For Now:
- Simple status updates
- Tenant can add tracking number manually
- Customer can view order status in dashboard

---

## 🎨 User Interface Flow

### Product Modal → Purchase Flow:

1. **Click "Buy Now"** (replaces "Contact for Purchase")
2. **Payment Method Selection Modal:**
   ```
   ┌─────────────────────────────┐
   │  Choose Payment Method      │
   ├─────────────────────────────┤
   │  💳 Pay Online              │
   │     Pay now with card       │
   │                             │
   │  🚚 Pay on Delivery         │
   │     Pay when delivered      │
   │                             │
   │  🏢 Pay When Visit          │
   │     Pay at salon            │
   └─────────────────────────────┘
   ```

3. **Based on Selection:**
   - **Pay Online** → Payment page (existing) → Order created
   - **POD** → Shipping address form → Order created
   - **Pay When Visit** → Pickup date selection (optional) → Order created

---

## 📁 File Structure

### Backend:
```
server/src/
├── models/
│   ├── Order.js          (NEW)
│   └── OrderItem.js      (NEW)
├── controllers/
│   ├── orderController.js (NEW)
│   └── paymentController.js (UPDATE - add product payment)
├── services/
│   ├── orderService.js   (NEW)
│   └── paymentService.js (UPDATE - add product payment)
└── routes/
    └── orderRoutes.js    (NEW)
```

### Frontend:
```
client/src/app/
├── products/
│   ├── purchase/
│   │   ├── page.tsx      (NEW - Payment method selection)
│   │   └── delivery/
│   │       └── page.tsx  (NEW - Shipping address form)
│   └── orders/
│       ├── page.tsx      (NEW - Order history)
│       └── [id]/
│           └── page.tsx (NEW - Order details)
└── dashboard/
    └── orders/
        └── page.tsx      (NEW - User orders)
```

---

## 🔧 Implementation Phases

### Phase 1: Core Order System (MVP)
- [ ] Create Order & OrderItem models
- [ ] Create order creation endpoint
- [ ] Implement inventory reservation/deduction
- [ ] Basic order status management
- [ ] User order history page

### Phase 2: Payment Options
- [ ] Pay Online integration (reuse booking payment)
- [ ] Pay on Delivery flow
- [ ] Pay When Visit flow
- [ ] Payment method selection UI

### Phase 3: Order Management
- [ ] Tenant order management dashboard
- [ ] Order status updates
- [ ] Payment status updates (for POD/POV)
- [ ] Order cancellation & refunds

### Phase 4: Delivery & Tracking
- [ ] Shipping address management
- [ ] Basic tracking (manual updates)
- [ ] Order tracking page for customers
- [ ] Delivery notifications

### Phase 5: Advanced Features (Future)
- [ ] Shopping cart (multiple products)
- [ ] Order reviews & ratings
- [ ] Automated delivery tracking
- [ ] Inventory alerts
- [ ] Order analytics

---

## 💡 Best Practices

### 1. **Inventory Management:**
- Always check stock before creating order
- Use database transactions for order creation + inventory update
- Handle race conditions (multiple users buying last item)

### 2. **Payment Security:**
- Never store card details
- Use existing payment gateway
- Validate payment before order confirmation

### 3. **Order Tracking:**
- Store product snapshot in OrderItem (price, name, image)
- Products can change, but order should reflect what was ordered
- Use orderNumber for easy reference

### 4. **User Experience:**
- Clear payment method selection
- Show estimated delivery/pickup time
- Send order confirmation email/SMS
- Allow order cancellation (with policy)

### 5. **Tenant Management:**
- Easy order management dashboard
- Bulk status updates
- Order filtering & search
- Revenue tracking per order

---

## 🎯 Recommended Approach

**Start with Phase 1 & 2 (MVP):**
1. Create Order & OrderItem models
2. Implement "Pay Online" first (reuse existing payment flow)
3. Add "Pay When Visit" (simpler, no delivery needed)
4. Add "Pay on Delivery" (requires shipping address)

**Why this order?**
- Pay Online: Reuse existing payment infrastructure
- Pay When Visit: Simplest, no delivery complexity
- Pay on Delivery: Most complex, requires address management

---

## ❓ Questions to Consider

1. **Shopping Cart?** 
   - Start with single product purchase
   - Add cart later if needed

2. **Delivery Service Integration?**
   - Start with manual tracking
   - Add API integration later

3. **Order Cancellation Policy?**
   - Allow cancellation within X hours?
   - Automatic refund for online payments?

4. **Inventory Alerts?**
   - Email tenant when stock low?
   - Show "Only X left" to customers?

---

## 📝 Next Steps

1. **Review this plan** - Confirm approach
2. **Create Order & OrderItem models**
3. **Implement Pay Online flow** (reuse booking payment)
4. **Add order history page**
5. **Implement other payment methods**

---

**Ready to start implementation, Captain?** 🚀
