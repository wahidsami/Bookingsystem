# Refah Tenant Dashboard Documentation

Date: 2026-05-19

## 1. Platform Tech Details
- Application: Tenant Dashboard web app
- Stack: Next.js 14, React 18, TypeScript, Tailwind CSS
- Package path: `tenant/package.json`
- Runtime: Node.js / Next.js server-side rendering and SPA behavior
- API: Backend REST API endpoints under `/api/v1/tenant/*`
- Internationalization: `next-intl`
- Build / start commands:
  - `cd tenant && npm run dev` (local dev on port 3003)
  - `cd tenant && npm run build`
  - `cd tenant && npm run start`

## 2. What It Is
The Tenant Dashboard is the business control center for salon, spa, barbershop, and service center owners.
It enables tenant administrators to manage operations, bookings, staff, sales, customers, marketing, and finance from one interface.

### Target User
- Tenant owner
- Tenant admin
- Operations manager
- Front-desk supervisor

## 3. What It Can Do
- Onboard and configure the tenant business profile
- Manage employees and service providers
- Define service catalog and product sales
- Schedule staff availability and appointment slots
- Handle appointments, rescheduling, and status updates
- Collect payments through POS and track transactions
- Manage customers and customer history
- Publish promotions, hot deals, and customer push notifications
- View billing, subscription, financials, and reports
- Configure tenant-specific settings and public page appearance

## 4. Sections and Structure
The Tenant Dashboard is organized into the following main sections:

### 4.1 Home / Command Center
- Live business summary and KPI cards
- Pending tasks and alerts
- Quick access to appointments, POS, customers, and notifications
- Today vs yesterday comparison
- Default landing page selector

### 4.2 Appointments
- Board view: appointments arranged by provider and time
- Appointment cards: status, customer, service, payment state
- Appointment details drawer
- Reschedule and reassign by drag/drop
- Status updates: Booked, Confirmed, Arrived, Started, Completed, No-show, Cancelled
- Bookings workflow and blocked time management

### 4.3 Customers
- Customer list with search and filters
- Customer workspace and profile
- Appointment history and future bookings
- Transaction and payment history
- Customer lifecycle and loyalty visibility

### 4.4 Employees / Staff
- Add/edit staff profiles
- Staff role assignment (service provider, non-provider)
- Staff permissions and access scope
- Assign services and service categories to employees
- Staff profile photo and contact details

### 4.5 Services
- Create and manage service catalog
- Set English/Arabic names, descriptions, price, duration, and images
- Assign service providers/staff
- Control service visibility and booking eligibility
- Payment option selection per service

### 4.6 Products
- Product catalog management
- Product pricing, inventory, and availability
- Media upload and publish states
- Product order processing

### 4.7 Orders
- Order list and status filters
- Order details and fulfillment tracking
- Payment tracking and order updates

### 4.8 POS / Collections
- Point-of-sale page for in-center payments
- Collect payments, booking fees, and outstanding balances
- Record cash or manual payments when needed
- Link POS receipt to appointment payment status

### 4.9 Marketing
- Hot Deals management
- Customer Push notifications
- Reviews monitoring and moderation
- Public page setup and tenant page configuration

### 4.10 Billing and Finance
- My Bills page for invoices and dues
- My Subscription page for plan details
- Financial overview for revenue and collections
- Payroll / employee commission tracking when available

### 4.11 Reports
- Report generation and previews
- Analytics for appointments, customers, and sales
- Exportable report workflows

### 4.12 Settings
- Business profile and contact information
- Booking and appointment settings
- Notification preferences
- Payment settings
- Localization and language
- Default landing page
- Tenant public page and branding

## 5. Available Features by Section
### Home / Command Center
- Business health at a glance
- Pending approvals or action items
- Shortcut cards for operations and revenue

### Appointments
- View bookings in board format
- Filter by provider and date range
- Open appointment detail drawer
- Reassign provider by drag/drop
- Reschedule booking time or provider
- Update appointment lifecycle status
- Check payment and customer details

### Customers
- Search by name, phone, or email
- Customer profile quick access
- View appointments and transactions
- Verify payment state and no-show history
- Review customer engagement data

### Employees / Staff
- Add new team members
- Edit staff details and service access
- Set shift patterns and availability
- Enable staff mobile app access (when supported)
- Assign role-specific permission sets

### Services
- Add new service entry
- Configure price, duration, visibility
- Attach service images and descriptive copy
- Assign provider eligibility per service
- Manage service categories

### Products
- Add product information
- Manage inventory and pricing
- Upload product media
- Set product publish status
- Fulfill incoming orders

### Orders
- View incoming order list
- Filter by order status
- Process and update fulfillment status
- Track payment and customer delivery status

### POS / Collections
- Lookup customer or appointment due balance
- Record payment receipts
- Handle partial payments and deposits
- Sync payment status with booking records

### Marketing
- Create and manage Hot Deals
- Send customer push messages
- Configure review collection and display
- Manage public page content, tabs, and contact details

### Billing and Finance
- Review bills and invoices
- Check subscription plan and limits
- Monitor financial health and cash flow
- Access payroll summaries when enabled

### Reports
- Generate custom reports
- Preview reports before export
- Review booking and revenue analytics

### Settings
- Update business details
- Configure booking and service rules
- Manage notification settings
- Set language and appearance
- Control tenant public page and branding

## 6. Operational Notes
- The tenant dashboard is the primary business surface for center operations.
- Complete staff and service setup before accepting bookings.
- Verify appointment schedule and staff availability daily.
- Use POS to reconcile manual payments and outstanding balances.
- Keep customer profiles updated for high-value client engagement.
- Use marketing sections to drive deals and appointment volume.
- Review reports regularly for operational and financial decisions.
