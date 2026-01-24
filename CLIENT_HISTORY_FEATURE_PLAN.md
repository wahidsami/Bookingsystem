# Client History Feature - Comprehensive Plan

## Overview
Enhance the tenant dashboard's "Customers" section to provide a complete view of client interactions, including both **service bookings** and **product purchases**. This will give tenant admins a unified view of each customer's complete history with their business.

---

## Current State Analysis

### What Exists Now:
1. **Customers List Page** (`/dashboard/customers`)
   - Shows customers who have **booked appointments** (services only)
   - Displays: name, contact, total bookings, total spent, loyalty tier, last visit
   - Filters: search, sort by last visit/spent/bookings, loyalty tier filter
   - Stats: total customers, new this month, returning rate, avg bookings

2. **Customer Detail Page** (`/dashboard/customers/[id]`)
   - Shows customer profile with avatar
   - Statistics: total bookings, completed bookings, total spent, avg booking value
   - Preferences: favorite services, preferred staff, preferred time
   - Recent appointments (last 10)
   - Notes and tags (tenant-specific)

3. **Backend API** (`tenantCustomerController.js`)
   - `getCustomers()` - Only includes customers with appointments
   - `getCustomer(id)` - Only shows appointment history
   - Uses `CustomerInsight` model for tenant-specific data
   - Currently tracks: appointments, spending from appointments, loyalty points

### What's Missing:
1. ❌ Customers who **only bought products** (never booked services) are not shown
2. ❌ Product purchase history is not displayed
3. ❌ Total spent calculation doesn't include product purchases
4. ❌ No unified timeline showing both services and products
5. ❌ No filtering by "service only", "product only", or "both"

---

## Proposed Enhancements

### Phase 1: Backend API Updates

#### 1.1 Update `getCustomers()` Endpoint
**File:** `server/src/controllers/tenantCustomerController.js`

**Changes:**
- Include customers who have **either** appointments **or** orders (or both)
- Add `totalOrders` and `totalProductsPurchased` to customer data
- Update `totalSpent` to include both appointment spending AND product spending
- Add `lastPurchaseDate` (could be appointment or product order)
- Add `customerType` field: `'service_only'`, `'product_only'`, or `'both'`

**New Query Logic:**
```javascript
// Find customers with appointments OR orders
const customersWithAppointments = await db.PlatformUser.findAll({
  include: [{ model: db.Appointment, as: 'appointments', ... }]
});

const customersWithOrders = await db.PlatformUser.findAll({
  include: [{ model: db.Order, as: 'orders', where: { tenantId } }]
});

// Merge and deduplicate
```

#### 1.2 Update `getCustomer(id)` Endpoint
**File:** `server/src/controllers/tenantCustomerController.js`

**Changes:**
- Include order history alongside appointment history
- Calculate stats from both sources:
  - `totalBookings` (from appointments)
  - `totalOrders` (from orders)
  - `totalSpent` = appointment spending + product spending
  - `totalProductsPurchased` (sum of quantities from all orders)
- Add `recentOrders` array (similar to `recentAppointments`)
- Add `favoriteProducts` (most purchased products)
- Update `lastVisit` to be the most recent of: last appointment OR last order

**New Response Structure:**
```javascript
{
  // ... existing customer data ...
  totalBookings: number,
  totalOrders: number,
  totalProductsPurchased: number,
  totalSpent: number, // includes both
  recentAppointments: [...],
  recentOrders: [...], // NEW
  favoriteServices: [...],
  favoriteProducts: [...], // NEW
  lastVisit: Date, // most recent of appointment or order
  customerType: 'service_only' | 'product_only' | 'both'
}
```

#### 1.3 Create New Endpoint: `getCustomerHistory(id)`
**File:** `server/src/controllers/tenantCustomerController.js`

**Purpose:** Unified timeline of all customer interactions

**Response:**
```javascript
{
  success: true,
  data: {
    history: [
      {
        type: 'appointment' | 'order',
        id: string,
        date: Date,
        status: string,
        amount: number,
        details: {
          // For appointments: service, staff, duration
          // For orders: products, delivery type, items
        }
      },
      // ... sorted by date DESC
    ],
    summary: {
      totalInteractions: number,
      totalSpent: number,
      firstInteraction: Date,
      lastInteraction: Date
    }
  }
}
```

---

### Phase 2: Frontend Updates

#### 2.1 Update Customers List Page
**File:** `tenant/src/app/[locale]/dashboard/customers/page.tsx`

**Changes:**
- Add new column: "Type" showing icon/badge for service/product/both
- Update "Bookings" column to show "Services" count
- Add new column: "Orders" showing product order count
- Update "Spent" to reflect total (services + products)
- Add filter dropdown: "All", "Services Only", "Products Only", "Both"
- Update stats cards:
  - "Total Customers" includes product-only customers
  - Add "Product Customers" stat card
  - Update "Total Spent" to include products

**New UI Elements:**
```tsx
// Type badge
{customer.customerType === 'both' && <Badge>Services & Products</Badge>}
{customer.customerType === 'service_only' && <Badge>Services Only</Badge>}
{customer.customerType === 'product_only' && <Badge>Products Only</Badge>}
```

#### 2.2 Enhance Customer Detail Page
**File:** `tenant/src/app/[locale]/dashboard/customers/[id]/page.tsx`

**Changes:**
- Add "Customer Type" badge in profile card
- Update statistics section:
  - Split into "Services" and "Products" subsections
  - Show: Total Bookings, Total Orders, Total Products Purchased
  - Combined Total Spent
- Add new "Product Preferences" section (similar to "Service Preferences")
  - Favorite products (most purchased)
  - Preferred delivery method
- Replace "Recent Appointments" with **"Recent Activity"** timeline:
  - Unified view showing both appointments and orders
  - Color-coded: Blue for appointments, Green for orders
  - Clickable to view details
  - Filter tabs: "All", "Services", "Products"

**New Timeline Component:**
```tsx
<div className="space-y-4">
  {history.map((item) => (
    <div key={item.id} className={`p-4 rounded-lg border-l-4 ${
      item.type === 'appointment' ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'
    }`}>
      <div className="flex justify-between">
        <div>
          <span className="font-semibold">
            {item.type === 'appointment' ? '📅 Service' : '🛍️ Product Order'}
          </span>
          <p>{item.details.summary}</p>
        </div>
        <div className="text-right">
          <Currency amount={item.amount} />
          <p className="text-sm text-gray-500">{formatDate(item.date)}</p>
        </div>
      </div>
    </div>
  ))}
</div>
```

#### 2.3 Create Customer History Page (Optional - Future Enhancement)
**File:** `tenant/src/app/[locale]/dashboard/customers/[id]/history/page.tsx`

**Purpose:** Dedicated full-page view of complete customer history

**Features:**
- Timeline view with all interactions
- Filter by type, date range, status
- Export history to PDF/CSV
- Charts: Spending over time, Service vs Product breakdown
- Search within history

---

### Phase 3: Database Considerations

#### 3.1 CustomerInsight Model Updates
**File:** `server/src/models/CustomerInsight.js`

**Potential New Fields:**
- `totalOrders` (integer)
- `totalProductsPurchased` (integer)
- `totalSpentFromProducts` (decimal)
- `lastProductPurchase` (date)
- `favoriteProducts` (JSON array)

**Note:** These can be calculated on-the-fly, but caching in `CustomerInsight` would improve performance.

#### 3.2 Indexing
- Ensure indexes on `Order.platformUserId` and `Order.tenantId`
- Composite index on `(platformUserId, tenantId)` for faster queries

---

## Implementation Steps

### Step 1: Backend - Update Customer Queries ✅
1. Modify `getCustomers()` to include customers with orders
2. Update `getCustomer(id)` to include order data
3. Create `getCustomerHistory(id)` endpoint
4. Update calculations to include product spending

### Step 2: Frontend - Update Customers List ✅
1. Add "Type" column and badges
2. Add "Orders" column
3. Add customer type filter
4. Update stats cards

### Step 3: Frontend - Enhance Customer Detail ✅
1. Add customer type badge
2. Update statistics section
3. Add product preferences section
4. Create unified timeline component
5. Add filter tabs for activity type

### Step 4: Testing ✅
1. Test with customers who have:
   - Only services
   - Only products
   - Both services and products
2. Verify calculations are correct
3. Test filtering and sorting
4. Test pagination with mixed data

### Step 5: Polish & Optimization ✅
1. Add loading states
2. Optimize queries (consider caching)
3. Add error handling
4. Update translations
5. Add tooltips and help text

---

## API Endpoints Summary

### Existing (to be updated):
- `GET /api/v1/tenant/customers` - Include product customers
- `GET /api/v1/tenant/customers/:id` - Include order history
- `GET /api/v1/tenant/customers/stats` - Include product stats

### New:
- `GET /api/v1/tenant/customers/:id/history` - Unified timeline

---

## UI/UX Considerations

1. **Visual Distinction:**
   - Use different icons/colors for services vs products
   - Blue theme for services, Green theme for products
   - Clear badges/labels

2. **Information Hierarchy:**
   - Most important: Total spent (combined)
   - Secondary: Breakdown by type
   - Tertiary: Individual transactions

3. **Mobile Responsiveness:**
   - Timeline should stack vertically on mobile
   - Filters should be collapsible
   - Tables should scroll horizontally

4. **Performance:**
   - Lazy load history items
   - Paginate timeline (load more button)
   - Cache customer stats

---

## Success Metrics

1. ✅ All customers visible (service-only, product-only, both)
2. ✅ Accurate total spending (services + products)
3. ✅ Complete history view (unified timeline)
4. ✅ Fast page load times (< 2s)
5. ✅ Easy filtering and search

---

## Future Enhancements (Post-MVP)

1. **Analytics Dashboard:**
   - Customer lifetime value charts
   - Service vs Product revenue breakdown
   - Customer acquisition trends

2. **Smart Insights:**
   - "This customer usually buys products, suggest a service"
   - "Frequent service customer, recommend products"
   - Churn prediction

3. **Communication:**
   - Send targeted offers based on history
   - Birthday specials for loyal customers
   - Re-engagement campaigns

4. **Export & Reporting:**
   - Export customer history to PDF
   - Generate customer reports
   - Email history summaries

---

## Notes

- **Backward Compatibility:** Ensure existing functionality continues to work
- **Data Migration:** No migration needed, just query updates
- **Performance:** Consider adding database indexes if queries are slow
- **Testing:** Test with various customer scenarios (service-only, product-only, both)

---

## Estimated Implementation Time

- **Backend Updates:** 4-6 hours
- **Frontend Updates:** 6-8 hours
- **Testing & Polish:** 2-3 hours
- **Total:** ~12-17 hours

---

**Status:** 📋 Planning Complete - Ready for Implementation
