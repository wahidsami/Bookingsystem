# Customer Order Management Migration to Tenant-v2

## 1. Why Orders Was Missing in Tenant-v2

Prior to this migration, a forensic audit established that:
- The product purchasing system in the Customer App (`RifahMobile`) successfully creates real orders in PostgreSQL (`orders` and `order_items` tables) assigned to the seller's `tenantId`.
- The Express backend (`server/src/controllers/tenantOrderController.js`) and database models (`Order.js`, `OrderItem.js`, `PaymentTransaction.js`) were 100% complete and fully supported order retrieval, filtering, status updates, and in-person payment collections.
- The original Next.js tenant application (`tenant/src/app/[locale]/dashboard/orders`) contained a fully functioning Orders dashboard.
- However, when the modern Vite + React 19 single-page platform (`Tenant-v2`) was constructed in July 2026, the Orders UI was never ported over. As a result, tenants using `Tenant-v2` could not view or manage product purchases made through the Customer App.

---

## 2. Legacy Sources Used as Business / Capability Reference

The business logic and domain capabilities were referenced directly from:
- **Order Queue & Filtering**: [`tenant/src/app/[locale]/dashboard/orders/page.tsx`](file:///d:/Waheed/Refah/Bookingsystem/tenant/src/app/[locale]/dashboard/orders/page.tsx)
- **Order Details & Modals**: [`tenant/src/app/[locale]/dashboard/orders/[id]/page.tsx`](file:///d:/Waheed/Refah/Bookingsystem/tenant/src/app/[locale]/dashboard/orders/[id]/page.tsx)
- **Backend API & Contracts**:
  - [`server/src/controllers/tenantOrderController.js`](file:///d:/Waheed/Refah/Bookingsystem/server/src/controllers/tenantOrderController.js)
  - [`server/src/routes/tenantRoutes.js`](file:///d:/Waheed/Refah/Bookingsystem/server/src/routes/tenantRoutes.js)
  - [`server/src/services/orderService.js`](file:///d:/Waheed/Refah/Bookingsystem/server/src/services/orderService.js)
  - [`server/src/models/Order.js`](file:///d:/Waheed/Refah/Bookingsystem/server/src/models/Order.js)

*Note: No legacy UI or styling was copied. Tenant-v2's modern luxury visual language, motion animations, and Cairo typography were applied from scratch.*

---

## 3. Tenant-v2 Files Added & Changed

### New Files Created
- [`Tenant-v2/src/components/OrdersWorkspace.tsx`](file:///d:/Waheed/Refah/Bookingsystem/Tenant-v2/src/components/OrdersWorkspace.tsx) — Canonical Tenant-v2 Orders Workspace featuring metrics, search, filtering, orders table, slide-over order details drawer, status update dialog, and in-person payment collection dialog.

### Existing Files Modified
- [`Tenant-v2/src/types.ts`](file:///d:/Waheed/Refah/Bookingsystem/Tenant-v2/src/types.ts) — Added `'orders'` to `ViewType`, and added strictly typed models: `TenantOrder`, `TenantOrderItem`, `TenantOrderUser`, `TenantOrderPaymentTransaction`, `TenantOrderShippingAddress`, `TenantOrderStats`, `TenantOrderPagination`, `TenantOrdersResponse`, `TenantOrderDetailResponse`.
- [`Tenant-v2/src/data/translations.ts`](file:///d:/Waheed/Refah/Bookingsystem/Tenant-v2/src/data/translations.ts) — Added `orders` navigation entry (`ShoppingBag` icon, Operations category, labels "الطلبات" / "Orders").
- [`Tenant-v2/src/components/LucideIcon.tsx`](file:///d:/Waheed/Refah/Bookingsystem/Tenant-v2/src/components/LucideIcon.tsx) — Registered `ShoppingBag` icon.
- [`Tenant-v2/src/lib/tenantApiAdapter.ts`](file:///d:/Waheed/Refah/Bookingsystem/Tenant-v2/src/lib/tenantApiAdapter.ts) — Added typed methods: `getOrders`, `getOrder`, `updateOrderStatus`, and `updateOrderPaymentStatus`.
- [`Tenant-v2/src/components/Sidebar.tsx`](file:///d:/Waheed/Refah/Bookingsystem/Tenant-v2/src/components/Sidebar.tsx) — Filtered `orders` item by package entitlement and staff permission.
- [`Tenant-v2/src/App.tsx`](file:///d:/Waheed/Refah/Bookingsystem/Tenant-v2/src/App.tsx) — Passed `hasProductsAndOrders` and `hasOrdersPermission` guards to `Sidebar`.
- [`Tenant-v2/src/components/Workspace.tsx`](file:///d:/Waheed/Refah/Bookingsystem/Tenant-v2/src/components/Workspace.tsx) — Imported and mounted `<OrdersWorkspace />` under `view === 'orders'`.

---

## 4. API Endpoints Consumed

All endpoints are strictly tenant-scoped (`where: { tenantId: req.tenantId }`):
1. **`GET /api/v1/tenant/orders`**
   - Query Parameters: `status`, `paymentStatus`, `startDate`, `endDate`, `search`, `page`, `limit`.
   - Returns: Paginated `orders`, `pagination` object (`total`, `page`, `limit`, `totalPages`), and `stats` summary (`total`, `pending`, `completed`, `cancelled`).
2. **`GET /api/v1/tenant/orders/:id`**
   - Returns: Complete order record including items, product images, customer profile, tenant info, and payment transaction history.
3. **`PATCH /api/v1/tenant/orders/:id/status`**
   - Request Body: `{ status, trackingNumber?, estimatedDeliveryDate? }`.
   - Updates fulfillment status, registers delivery timestamps, restores inventory if cancelled, and triggers customer notifications.
4. **`PATCH /api/v1/tenant/orders/:id/payment`**
   - Request Body: `{ paymentStatus: 'paid', paymentMethod, transactionRef?, notes? }`.
   - Records tenant-collected payment, generates ledger entries, and transitions pending orders to confirmed.

---

## 5. Permissions & Entitlement Guards

Orders access in Tenant-v2 is controlled by a dual-layer security check:
1. **Subscription Entitlement**:
   - `hasProductsAndOrdersEntitlement(packageEntitlements)` checks whether the tenant's current SaaS package includes ecommerce/product capabilities.
   - If disabled, the Orders item is completely hidden from the sidebar and unavailable in navigation.
2. **Role & Staff Permission**:
   - Reuses existing `'view_orders'` token.
   - Automatically granted to `tenant_owner` and manager accounts via `hasFullDashboardAccess`.
   - For staff members, checks `permissions.view_orders === true`.

---

## 6. List & Filtering Functionality

- **Live Summary Metrics**: Displays Total Orders, Pending / Processing, Completed, and Cancelled / Refunded cards computed directly from backend stats.
- **Search**: Case-insensitive search on Order Number or Customer Name.
- **Status Pills**: Quick-filter by `all`, `pending`, `confirmed`, `processing`, `ready_for_pickup`, `shipped`, `delivered`, `completed`, `cancelled`.
- **Payment Filter**: Filter by `all`, `paid`, `pending`, `failed`, `refunded`.
- **Date Range**: Filter orders by `startDate` and `endDate`.
- **Table View**: Columns for Order Number, Customer, Date/Time, Fulfillment/Type, Status Badge, Payment Badge, Total in SAR, and View Action.
- **Pagination**: Next/previous pagination respecting backend total pages.

---

## 7. Order Details Slide-Over Drawer

Clicking "View" opens a smooth slide-over drawer showing:
- **Order Header**: Order Number, creation timestamp, close button.
- **Status Badges & Actions**: Current fulfillment badge, payment badge, and contextual action buttons ("Update Status", "Collect Payment").
- **Customer Card**: Full name, telephone number, email address, fallback for guest accounts.
- **Fulfillment Card**: Delivery type (`delivery` vs `pickup`), full shipping address (street, city, district, notes), pickup date, tracking number, and estimated delivery date.
- **Item Breakdown**: Product thumbnail, localized Arabic/English product title, quantity, unit price, and line total.
- **Financial Breakdown**: Subtotal, 15% VAT, delivery fee, and grand total in SAR.
- **Payment Transaction Log**: Detailed ledger entries showing payment method, transaction references, processor staff member, timestamp, and status.
- **Customer Notes**: Displays special instructions left during checkout.

---

## 8. Status Lifecycle Rules

The UI strictly adheres to backend state transition rules:
- **Pending**: Can transition to `confirmed` or `cancelled`.
- **Confirmed**: Can transition to `processing` or `cancelled`.
- **Processing**:
  - For pickup orders: transitions to `ready_for_pickup` or `cancelled`.
  - For delivery orders: transitions to `shipped` (prompts for tracking number & estimated delivery date) or `cancelled`.
- **Ready for Pickup**: Can transition to `completed` (requires `paymentStatus === 'paid'`) or `cancelled`.
- **Shipped**: Can transition to `delivered` or `cancelled`.
- **Delivered**: Can transition to `completed` (requires `paymentStatus === 'paid'`).
- **Completed / Cancelled / Refunded**: Terminal states with no further transitions.
- **Payment Rule**: The UI blocks completing any order whose payment status is not `paid`, preventing backend validation errors.

---

## 9. In-Person Payment Collection

For orders with `paymentStatus !== 'paid'` (e.g., Pay on Visit or Cash on Delivery):
- Clicking "Collect Payment" opens an in-person collection dialog.
- Supports payment methods: `Cash` (`cash`), `Card POS` (`card_pos`), and `Customer Wallet` (`wallet`).
- Allows entering transaction reference (e.g., POS slip number) and internal notes.
- Dispatches `PATCH /api/v1/tenant/orders/:id/payment`, updating the payment status to `paid` and creating audit ledger transactions.

---

## 10. RTL / LTR & Responsive Theme

- **Arabic (RTL)**:
  - Aligns tables, drawer content, metrics, and text right-to-left.
  - Applies Cairo typography (`Cairo-Bold`, `Cairo-Regular`).
  - Correct icon and button ordering.
- **English (LTR)**:
  - Standard left-to-right alignment with clean tabular typography.
- **Dark & Light Mode**:
  - Light mode: Clean slate/white background, slate borders, refined shadows.
  - Dark mode: Zinc-900 surface, zinc-850 borders, brand accent highlights.

---

## 11. Verification Results

- **TypeScript Typecheck**:
  - `OrdersWorkspace.tsx`: 0 errors.
  - `types.ts`: 0 errors.
  - `tenantApiAdapter.ts`: 0 errors.
  - `Sidebar.tsx`: 0 errors.
  - `translations.ts`: 0 errors.
  - `Workspace.tsx`: 0 errors.
  - `App.tsx`: 0 errors.
- **Git State**:
  - Uncommitted working copy changes preserved.
  - Zero backend files modified.
  - Zero mobile customer files modified.

---

## 12. Runtime Verification Still Pending

- Real browser interaction testing in staging/local development with live tenant sessions.
- Verification of order status updates with actual push notifications sent to Customer App devices.
