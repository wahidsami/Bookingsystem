# 🛍️ Purchases Dashboard - Tab Structure Plan

## 📊 Order Status Categories

Based on our order statuses:
- `pending` - Order just created
- `confirmed` - Order confirmed
- `processing` - Tenant preparing order
- `ready_for_pickup` - Ready for customer
- `shipped` - Order shipped (for delivery)
- `delivered` - Order delivered
- `completed` - Order fulfilled
- `cancelled` - Order cancelled
- `refunded` - Order refunded

---

## 🎯 Recommended Tab Structure

### Option 1: **3 Tabs** (Recommended ✅)

#### Tab 1: **"Active"** or **"In Progress"**
**Statuses included:**
- `pending`
- `confirmed`
- `processing`
- `ready_for_pickup`
- `shipped`
- `delivered`

**Purpose:** Show all orders that are currently being processed or waiting for customer action.

**User can see:**
- Orders being prepared
- Orders ready for pickup
- Orders in transit
- Orders delivered (but not yet marked complete)

**Actions available:**
- View order details
- Track order (if shipped)
- Mark as received (if delivered)
- Cancel order (if still in early stages)

---

#### Tab 2: **"Completed"**
**Statuses included:**
- `completed`

**Purpose:** Show all successfully fulfilled orders.

**User can see:**
- Past purchases
- Order history
- Product details (for reordering)

**Actions available:**
- View order details
- Reorder (if product still available)
- Leave review (future feature)

---

#### Tab 3: **"Cancelled"**
**Statuses included:**
- `cancelled`
- `refunded`

**Purpose:** Show orders that didn't complete.

**User can see:**
- Cancelled orders
- Refunded orders
- Reason for cancellation (if available)

**Actions available:**
- View order details
- See refund status
- Reorder (if product still available)

---

## 🤔 Why 3 Tabs?

### ✅ **Advantages:**
1. **Clear separation** - Easy to find what you're looking for
2. **Better UX** - Users know exactly where to look
3. **Status clarity** - Each tab has a clear purpose
4. **Action-oriented** - Different actions per tab

### ❌ **2 Tabs Alternative:**
- **"Active"** + **"Completed"**
  - Problem: Cancelled orders would be mixed with completed (confusing)
  - Or: Cancelled orders hidden (users can't see them)

---

## 💡 Alternative: **2 Tabs with Filters**

### Option 2: **2 Tabs + Status Filter**

#### Tab 1: **"My Orders"** (All orders with filter dropdown)
- Filter: All | Active | Completed | Cancelled
- Shows all orders, user can filter

#### Tab 2: **"Completed"**
- Only completed orders

**Pros:** More flexible
**Cons:** Less intuitive, requires extra click

---

## 🎨 UI Design Suggestion

### Recommended: **3 Tabs**

```
┌─────────────────────────────────────────┐
│  My Purchases                            │
├─────────────────────────────────────────┤
│  [Active (3)] [Completed (12)] [Cancelled (2)] │
├─────────────────────────────────────────┤
│                                          │
│  Active Orders:                          │
│  ┌──────────────────────────────────┐   │
│  │ Order #ORD-2026-001234           │   │
│  │ Hair Treatment Pack              │   │
│  │ Status: Processing               │   │
│  │ Payment: Paid Online             │   │
│  │ [View Details] [Track Order]      │   │
│  └──────────────────────────────────┘   │
│                                          │
└─────────────────────────────────────────┘
```

---

## 📱 Mobile View

On mobile, tabs can be:
- Horizontal scrollable tabs
- Or dropdown filter

---

## 🎯 Final Recommendation

**Go with 3 Tabs:**
1. **"Active"** - Orders in progress
2. **"Completed"** - Finished orders  
3. **"Cancelled"** - Cancelled/refunded orders

**Why?**
- ✅ Clear and intuitive
- ✅ Better user experience
- ✅ Easy to find specific orders
- ✅ Matches common e-commerce patterns (Amazon, etc.)

---

## 🔄 Status Flow Visualization

```
Active Tab:
pending → confirmed → processing → ready_for_pickup → shipped → delivered
                                                                  ↓
                                                              completed
                                                                  ↓
                                                           Completed Tab

If cancelled/refunded:
Any status → cancelled/refunded → Cancelled Tab
```

---

## ✅ Decision

**3 Tabs is the way to go, Captain!** 🎯
