# Refah Admin Dashboard Documentation

Date: 2026-05-19

## 1. Platform Tech Details
- Application: Super Admin Dashboard for the Refah platform
- Stack: Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts
- Package path: `admin/package.json`
- Runtime: Node.js / Next.js server-side rendering and SPA behavior
- API: Admin backend endpoints under `/api/v1/admin/*`
- Build / start commands:
  - `cd admin && npm run dev` (local dev on port 3002)
  - `cd admin && npm run build`
  - `cd admin && npm run start`

## 2. What It Is
The Admin Dashboard is the centralized platform management interface for the Refah system.
It is used by super admins and platform operators to manage tenants, users, system-wide financials, activities, and platform settings.

### Target User
- Platform admin
- Super admin
- Support operator
- Operations leader
- Finance controller

## 3. What It Can Do
- Review platform health and key performance metrics
- Approve or reject tenant onboarding applications
- Manage tenant activation, suspension, and reactivation
- View tenant details, documents, and activity logs
- Manage platform users and account statuses
- Monitor revenue, commission, and financial summaries
- Audit all platform actions and activity history
- Configure platform-wide settings and commissions
- View system-wide notifications and alerts

## 4. Sections and Structure
The Admin Dashboard is structured into the following major sections:

### 4.1 Main Dashboard
- Platform statistics: total tenants, users, bookings, revenue
- Growth metrics and trending data
- Pending approvals and alerts
- Recent platform activity feed
- Quick actions to jump to tenants or users

### 4.2 Clients (Tenants) Management
- All tenants list with pagination and filters
- Status filters: approved, pending, suspended, rejected
- Search by tenant name, plan, or business type
- Tenant detail pages with business, owner, and financial data
- Approve, reject, suspend, and reactivate tenants
- Review tenant documents and verification status
- Tenant activity log and audit trail

### 4.3 Users Management
- Platform end-user list (customers)
- Search and filters for verification and status
- Viewing user profiles, booking history, and transactions
- Balance adjustment for wallet or loyalty points
- Account enable / disable actions

### 4.4 Financial Section
- Revenue overview and trend graphs
- Financial details and commission sources
- Tenant earnings and platform commission data
- Payment and payout visibility (limited in current implementation)

### 4.5 Activity Log
- Platform-wide audit trail of actions
- Filter by time range and event type
- Detailed action metadata for transparency

### 4.6 Settings
- Platform configuration options
- Commission percentage and feature plan settings
- Admin user list
- General platform preferences
- Subscription plan summary cards showing monthly, 6-month and annual prices for active packages

### 4.7 Packages / Commercial Plans
- Manage tenant subscription packages and plan configurations.
- Package list cards display:
  - Monthly price
  - 6-month total price
  - Annual total price
  - Featured badge when applicable
  - Active/inactive status.
- Edit or create packages with full limit and feature configuration.
- Pricing is automatically calculated from package components.

#### Package Builder Inputs
- Basic package metadata: English/Arabic name, slug, description, display order, active status, featured flag.
- Platform commission: percentage added on top of base package cost.
- Subscription fee: configurable monthly recurring amount.
- Resource limits:
  - Bookings per month
  - Staff count
  - Services count
  - Products count
  - Storage allowance (GB)
- Core platform features:
  - Products & orders support
  - Internal messaging
  - Reporting
  - Payroll
  - Public page customization
- Marketing and communication features:
  - WhatsApp notifications
  - In-app marketing notifications
  - AI content assistant tokens
  - Promotional emails
  - Search ranking boost
- Marketplace promotion features:
  - New to Refah onboarding days
  - Featured carousel placement and priority
  - Hot deals allowance and auto-approve
  - Featured products count

#### Pricing Model
- Package price is derived from:
  1. Base recurring subscription fee
  2. Resource costs for bookings, staff, services, products, and storage
  3. Add-on feature costs for communications, marketing, reports, payroll, and marketplace promotions
  4. Platform commission percentage applied to the raw package cost
  5. 15% VAT added after commission
- Stored package values include `monthlyPrice`, `sixMonthPrice`, and `annualPrice`.
- The package builder computes totals so admins can preview the commercial impact before saving.

#### Tenant Services Delivered by Refah
- Tenant onboarding and managed subscription plan.
- Booking system infrastructure for appointments and service scheduling.
- Staff and service catalog management.
- Product and order management when enabled.
- Business support tools such as messaging, reporting, payroll, and public page customisation.
- Marketing and promotion capabilities for marketplace visibility, featured placements, hot deals, and new-to-Refah exposure.
- Notification channels including WhatsApp and in-app campaigns.
- Storage for tenant media and catalog assets.

## 5. Available Features by Section
### Main Dashboard
- Real-time platform metrics
- Alerts for pending approvals and issues
- Quick links to critical workflows
- Recent activity summaries

### Clients (Tenants)
- List all tenant businesses
- Filter by status, plan, and search terms
- Review tenant documents and business info
- Approve or reject tenant registrations
- Suspend or reactivate tenant accounts
- Edit tenant information and settings
- View tenant statistics and business health
- Audit tenant action history

### Users
- Search and manage registered customers
- Review bookings and payment history
- Adjust wallet balance or loyalty points
- Activate or deactivate accounts
- Inspect user verification status

### Packages
- Create and maintain tenant subscription packages.
- Define package limits, features, and commercial metadata.
- Preview pricing with platform commission and VAT included.
- Mark plans as featured or inactive for product control.
- Ensure tenant-facing plan summaries are correct before publishing.

### Financial
- Review total and monthly revenue
- Compare revenue growth over time
- Analyze commission performance
- Understand tenant-level financials (planned enhancement)

### Activity Log
- Audit all administrative actions
- Filter on date and type
- Inspect action details for governance

### Settings
- Configure platform-wide fees and commission
- Manage admin access roles and accounts
- Update system-wide general settings

## 6. Operational Notes
- The Admin Dashboard is the main control surface for managing the multi-tenant Refah platform.
- Tenant approval and verification are high-impact actions; use audit logs and document review before approving.
- User management includes both customers and internal platform accounts.
- Financial dashboards should be used to monitor revenue trends and prepare payout decisions.
- Settings should be updated carefully because they affect all tenants or platform-wide behavior.
