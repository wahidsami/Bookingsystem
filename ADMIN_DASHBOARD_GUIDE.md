# 🎛️ Rifah Super Admin Dashboard

## Overview

The Super Admin Dashboard is the central control panel for managing the Rifah platform. It provides comprehensive tools for managing tenants (salons/spas), users, and financial operations.

## 🚀 Getting Started

### Access URL
- **Admin Dashboard**: http://localhost:3002
- **Default Credentials**: 
  - Email: `admin@rifah.sa`
  - Password: `RifahAdmin@2024`

### Running the Admin Dashboard

```bash
# Install all dependencies
npm run install:all

# Start all services (backend, client, admin)
npm run dev

# Or run admin dashboard only
cd admin && npm run dev
```

## 📊 Dashboard Features

### 1. Main Dashboard
- **Platform Statistics**: Total tenants, users, bookings, revenue
- **Growth Metrics**: Month-over-month comparisons
- **Pending Alerts**: Quick access to pending approvals
- **Recent Activities**: Platform-wide activity feed
- **Quick Actions**: Fast navigation to common tasks

### 2. Clients (Tenants) Management

#### All Clients View
- **List View**: Paginated list of all registered businesses
- **Filters**: Filter by status, business type, plan, search
- **Status Indicators**: Pending, approved, suspended, rejected

#### Pending Approvals
- **Review Queue**: New tenant applications awaiting approval
- **Quick Actions**: Approve or reject with reason
- **Document Verification**: Check uploaded business documents

#### Client Details
- **Business Information**: Name, type, description, contact
- **Owner Details**: Owner name, phone, email
- **Documents**: Commercial register, license, owner ID
- **Statistics**: Bookings, revenue, customers, ratings
- **Activity Log**: All actions taken on this tenant
- **Settings**: Business configuration

#### Client Actions
- ✅ **Approve**: Activate new tenant
- ❌ **Reject**: Decline with reason
- ⏸️ **Suspend**: Temporarily disable
- ▶️ **Reactivate**: Re-enable suspended tenant

### 3. Users Management

#### All Users View
- **List View**: Platform end-users (customers)
- **Filters**: Search, verification status
- **Quick Info**: Wallet balance, loyalty points

#### User Details
- **Profile Information**: Personal details, verification status
- **Booking History**: Past and upcoming appointments
- **Transaction History**: Payment records
- **Balance Adjustment**: Add/deduct wallet or loyalty points

### 4. Financial Section
- **Revenue Overview**: Total and monthly revenue
- **Growth Metrics**: Revenue trends
- **Revenue Breakdown**: Commission sources
- **Payment Methods**: Integration status (coming soon)

### 5. Activity Log
- **Platform-Wide Audit**: All actions across the system
- **Filtering**: By time range
- **Details View**: Full action details and metadata

### 6. Settings
- **Platform Configuration**: Basic settings overview
- **Commission Settings**: Platform fee percentages
- **Subscription Plans**: Pricing tiers display
- **Admin Users**: Current admin accounts

## 🔒 Security Features

### Authentication
- JWT-based authentication with access/refresh tokens
- Session stored in sessionStorage
- Auto-redirect for unauthorized access

### Permissions
- Role-based access control (super_admin, admin, support)
- Granular permissions per resource
- All actions logged with IP and user agent

## 📁 Project Structure

```
admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Redirect to login/dashboard
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   └── dashboard/
│   │       ├── page.tsx        # Main dashboard
│   │       ├── clients/
│   │       │   ├── page.tsx    # All clients
│   │       │   ├── pending/
│   │       │   │   └── page.tsx # Pending approvals
│   │       │   └── [id]/
│   │       │       └── page.tsx # Client details
│   │       ├── users/
│   │       │   ├── page.tsx    # All users
│   │       │   └── [id]/
│   │       │       └── page.tsx # User details
│   │       ├── financial/
│   │       │   └── page.tsx    # Financial overview
│   │       ├── activities/
│   │       │   └── page.tsx    # Activity log
│   │       └── settings/
│   │           └── page.tsx    # Settings
│   ├── components/
│   │   └── AdminLayout.tsx     # Dashboard layout with sidebar
│   ├── contexts/
│   │   └── AuthContext.tsx     # Admin authentication context
│   └── lib/
│       └── api.ts              # Admin API client
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 🎨 UI Design

### Color Scheme (Dark Theme)
- **Background**: Slate 900 (`#0F172A`)
- **Cards**: Slate 800 (`#1E293B`)
- **Primary**: Indigo 500 (`#6366F1`)
- **Success**: Emerald 500 (`#10B981`)
- **Warning**: Amber 500 (`#F59E0B`)
- **Danger**: Red 500 (`#EF4444`)

### Components
- **Cards**: Dark background with subtle borders
- **Tables**: Styled with hover states
- **Badges**: Status indicators with color coding
- **Buttons**: Primary, secondary, success, danger variants
- **Inputs**: Dark styled with focus states

## 🔌 API Endpoints

### Authentication
- `POST /api/v1/auth/admin/login` - Admin login
- `POST /api/v1/auth/admin/refresh-token` - Refresh access token
- `GET /api/v1/auth/admin/profile` - Get admin profile
- `POST /api/v1/auth/admin/logout` - Logout

### Admin APIs
- `GET /api/v1/admin/stats/dashboard` - Dashboard statistics
- `GET /api/v1/admin/stats/activities` - Recent activities
- `GET /api/v1/admin/stats/charts` - Chart data

### Tenants
- `GET /api/v1/admin/tenants` - List all tenants
- `GET /api/v1/admin/tenants/pending` - Pending approvals
- `GET /api/v1/admin/tenants/:id` - Tenant details
- `PUT /api/v1/admin/tenants/:id` - Update tenant
- `POST /api/v1/admin/tenants/:id/approve` - Approve tenant
- `POST /api/v1/admin/tenants/:id/reject` - Reject tenant
- `POST /api/v1/admin/tenants/:id/suspend` - Suspend tenant
- `POST /api/v1/admin/tenants/:id/activate` - Activate tenant

### Users
- `GET /api/v1/admin/users` - List all users
- `GET /api/v1/admin/users/:id` - User details
- `PUT /api/v1/admin/users/:id` - Update user
- `POST /api/v1/admin/users/:id/toggle-status` - Activate/deactivate
- `POST /api/v1/admin/users/:id/adjust-balance` - Adjust wallet/points

## 📈 Future Enhancements

- [ ] Revenue charts with Recharts
- [ ] Tenant payout management
- [ ] Email notification system
- [ ] Advanced analytics
- [ ] Multi-admin with role management
- [ ] Tenant layout template management
- [ ] API rate limiting dashboard
- [ ] System health monitoring

## 🐛 Troubleshooting

### Cannot Login
1. Ensure backend server is running on port 5000
2. Check if super admin was created (check console logs)
3. Verify credentials: `admin@rifah.sa` / `RifahAdmin@2024`

### API Errors
1. Check backend console for errors
2. Verify database connection
3. Ensure all migrations ran successfully

### Missing Data
1. Run seed script: `npm run seed`
2. Check database directly for data
3. Verify tenant status is 'approved' for visibility

