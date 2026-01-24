# Phase 2.5: Platform User System & Multi-Tenancy

**Duration**: 2 weeks  
**Priority**: CRITICAL - Foundation Fix  
**Status**: Planned

---

## 🎯 Objective

Transform Rifah from a single-tenant system to a true multi-tenant platform where:
- **End users** have ONE account to book at ANY salon/spa
- **Tenants** (salons) can see their customers and analytics
- **Platform** maintains unified user data and cross-tenant history

---

## 🏗️ Architecture Changes

### Current (Broken) Architecture:
```
Tenant A Schema:
  ├── customers (isolated)
  ├── appointments
  └── services

Tenant B Schema:
  ├── customers (isolated) ❌ DUPLICATE USER!
  ├── appointments
  └── services
```

### New (Fixed) Architecture:
```
Public Schema (Platform-Wide):
  ├── platform_users (end customers - SINGLE SOURCE OF TRUTH)
  ├── tenants (salons/spas)
  └── platform_admins

Tenant A Schema:
  ├── services
  ├── staff
  ├── appointments (references platform_users.id)
  └── customer_insights (analytics per user)

Tenant B Schema:
  ├── services
  ├── staff
  ├── appointments (references platform_users.id)
  └── customer_insights (analytics per user)
```

---

## 📋 Deliverables

### 1. Backend - Database Models

#### 1.1 PlatformUser Model (Public Schema)
```javascript
// server/src/models/PlatformUser.js
{
  id: UUID,
  email: STRING (unique),
  phone: STRING (unique),
  password: STRING (hashed),
  firstName: STRING,
  lastName: STRING,
  dateOfBirth: DATE,
  gender: ENUM('male', 'female', 'other'),
  profileImage: STRING,
  
  // Preferences
  preferredLanguage: ENUM('en', 'ar'),
  notificationPreferences: JSONB,
  
  // Platform-wide data
  walletBalance: DECIMAL(10,2),
  loyaltyPoints: INTEGER,
  totalSpent: DECIMAL(10,2),
  totalBookings: INTEGER,
  
  // Auth
  emailVerified: BOOLEAN,
  phoneVerified: BOOLEAN,
  lastLogin: TIMESTAMP,
  
  // Status
  isActive: BOOLEAN,
  isBanned: BOOLEAN,
  
  timestamps: true
}
```

#### 1.2 Update Appointment Model
```javascript
// Link to platform user instead of tenant-specific customer
{
  platformUserId: UUID (references public.platform_users),
  // Remove customerId field
}
```

#### 1.3 CustomerInsight Model (Per Tenant)
```javascript
// server/src/models/CustomerInsight.js
// Analytics per user per tenant
{
  id: UUID,
  platformUserId: UUID (references public.platform_users),
  tenantId: UUID,
  
  // Tenant-specific stats
  totalBookings: INTEGER,
  totalSpent: DECIMAL(10,2),
  averageRating: DECIMAL(3,2),
  lastVisit: TIMESTAMP,
  
  // Preferences at this salon
  favoriteServices: ARRAY,
  favoriteStaff: ARRAY,
  preferredTimes: ARRAY,
  
  // Loyalty
  loyaltyTier: ENUM('bronze', 'silver', 'gold', 'platinum'),
  tenantLoyaltyPoints: INTEGER,
  
  // Notes
  notes: TEXT,
  tags: ARRAY,
  
  timestamps: true
}
```

#### 1.4 PaymentMethod Model
```javascript
// server/src/models/PaymentMethod.js
{
  id: UUID,
  platformUserId: UUID,
  type: ENUM('card', 'wallet', 'apple_pay', 'stc_pay'),
  
  // Card details (encrypted)
  cardLast4: STRING,
  cardBrand: STRING,
  cardExpiry: STRING,
  
  // Tokenization
  stripePaymentMethodId: STRING,
  
  isDefault: BOOLEAN,
  isActive: BOOLEAN,
  
  timestamps: true
}
```

#### 1.5 Transaction Model
```javascript
// server/src/models/Transaction.js
{
  id: UUID,
  platformUserId: UUID,
  tenantId: UUID,
  appointmentId: UUID,
  
  amount: DECIMAL(10,2),
  currency: STRING (default: 'SAR'),
  type: ENUM('booking', 'refund', 'wallet_topup', 'loyalty_redemption'),
  status: ENUM('pending', 'completed', 'failed', 'refunded'),
  
  paymentMethodId: UUID,
  stripeTransactionId: STRING,
  
  platformFee: DECIMAL(10,2),
  tenantRevenue: DECIMAL(10,2),
  
  metadata: JSONB,
  
  timestamps: true
}
```

---

### 2. Backend - Authentication System

#### 2.1 User Auth Routes
```javascript
// server/src/routes/userAuthRoutes.js

POST   /api/v1/auth/user/register
POST   /api/v1/auth/user/login
POST   /api/v1/auth/user/logout
POST   /api/v1/auth/user/refresh-token
POST   /api/v1/auth/user/forgot-password
POST   /api/v1/auth/user/reset-password
POST   /api/v1/auth/user/verify-email
POST   /api/v1/auth/user/verify-phone
POST   /api/v1/auth/user/resend-verification
```

#### 2.2 User Profile Routes
```javascript
// server/src/routes/userRoutes.js

GET    /api/v1/users/profile
PUT    /api/v1/users/profile
DELETE /api/v1/users/account

GET    /api/v1/users/bookings (all bookings across all tenants)
GET    /api/v1/users/bookings/:id
GET    /api/v1/users/transactions
GET    /api/v1/users/loyalty-points

GET    /api/v1/users/payment-methods
POST   /api/v1/users/payment-methods
DELETE /api/v1/users/payment-methods/:id
PUT    /api/v1/users/payment-methods/:id/set-default

POST   /api/v1/users/wallet/topup
GET    /api/v1/users/wallet/balance
```

#### 2.3 JWT Authentication Middleware
```javascript
// server/src/middleware/authUser.js
// Verify JWT token and attach user to request
```

---

### 3. Backend - Tenant Customer Directory

#### 3.1 Tenant Customer Routes
```javascript
// server/src/routes/tenantCustomerRoutes.js
// For salon owners to view their customers

GET    /api/v1/tenant/customers (users who booked at this salon)
GET    /api/v1/tenant/customers/:userId
GET    /api/v1/tenant/customers/:userId/bookings
GET    /api/v1/tenant/customers/:userId/insights
PUT    /api/v1/tenant/customers/:userId/notes
POST   /api/v1/tenant/customers/:userId/tags

GET    /api/v1/tenant/customers/export (CSV/Excel)
GET    /api/v1/tenant/customers/analytics
```

---

### 4. Frontend - User Registration & Login

#### 4.1 Pages
```
/register - User registration form
/login - User login form
/forgot-password - Password recovery
/verify-email - Email verification
/verify-phone - Phone OTP verification
```

#### 4.2 Components
```typescript
// client/src/components/auth/RegisterForm.tsx
// client/src/components/auth/LoginForm.tsx
// client/src/components/auth/SocialLogin.tsx (Google, Apple)
// client/src/components/auth/PhoneVerification.tsx
```

---

### 5. Frontend - User Dashboard

#### 5.1 Dashboard Pages
```
/dashboard - User home
/dashboard/bookings - All bookings (across all salons)
/dashboard/bookings/:id - Booking details
/dashboard/payments - Payment methods
/dashboard/wallet - Wallet & top-up
/dashboard/loyalty - Loyalty points
/dashboard/profile - Edit profile
/dashboard/settings - Preferences & notifications
```

#### 5.2 Key Features
- **Booking History**: Timeline view of all bookings
- **Upcoming Appointments**: Next 7 days
- **Favorite Salons**: Quick access
- **Payment Methods**: Manage cards
- **Loyalty Dashboard**: Points, tier, rewards
- **Notifications**: Booking confirmations, reminders

---

### 6. Frontend - Tenant Customer Directory

#### 6.1 Tenant Dashboard Pages
```
/tenant/dashboard - Salon owner home
/tenant/customers - Customer directory
/tenant/customers/:id - Customer profile
/tenant/analytics - Customer analytics
```

#### 6.2 Features
- **Customer List**: Searchable, filterable
- **Customer Profile**: Booking history, spending, preferences
- **Customer Insights**: Favorite services, visit frequency
- **Customer Segmentation**: VIP, regular, new
- **Export**: Download customer data

---

### 7. Updated Booking Flow

#### Old Flow (Broken):
```
1. User enters name/phone
2. Creates tenant-specific customer record
3. Books appointment
```

#### New Flow (Fixed):
```
1. User logs in (or registers)
2. Selects salon
3. Selects service
4. Books appointment (linked to platform user)
5. Pays (saved payment method or new)
6. Confirmation sent to user account
```

---

## 🔧 Migration Strategy

### Step 1: Create New Models
- Add PlatformUser model
- Add CustomerInsight model
- Add PaymentMethod model
- Add Transaction model

### Step 2: Migrate Existing Data
```sql
-- Migrate existing customers to platform users
INSERT INTO public.platform_users (email, phone, name)
SELECT DISTINCT email, phone, name FROM tenant_a.customers;

-- Create customer insights per tenant
INSERT INTO tenant_a.customer_insights (platform_user_id, ...)
SELECT ... FROM tenant_a.customers;

-- Update appointments to reference platform users
UPDATE tenant_a.appointments
SET platform_user_id = (
  SELECT id FROM public.platform_users 
  WHERE phone = (SELECT phone FROM tenant_a.customers WHERE id = appointments.customer_id)
);
```

### Step 3: Update Booking Service
- Modify `createAppointment` to use `platformUserId`
- Remove `customerName` and `customerPhone` from request
- Require authentication

### Step 4: Deploy Frontend
- Add login/register pages
- Add user dashboard
- Update booking flow to require auth

---

## 📊 Success Metrics

### Technical KPIs:
- ✅ Zero duplicate user records across tenants
- ✅ Single login for all salons
- ✅ Unified booking history
- ✅ Cross-tenant loyalty points

### User Experience KPIs:
- 🎯 Registration completion rate: >80%
- 🎯 Login success rate: >95%
- 🎯 Booking completion (logged in): >70%
- 🎯 User retention: >60%

### Business KPIs:
- 🎯 Average bookings per user: >3
- 🎯 Cross-tenant bookings: >20%
- 🎯 Saved payment methods: >50%

---

## 🚨 Breaking Changes

### API Changes:
1. **Booking Creation**:
   - OLD: `POST /api/v1/bookings/create { customerName, customerPhone }`
   - NEW: `POST /api/v1/bookings/create { platformUserId }` (from JWT)

2. **Customer Endpoints**:
   - REMOVED: `/api/v1/customers` (tenant-specific)
   - NEW: `/api/v1/tenant/customers` (view platform users who booked)

### Database Changes:
1. **Appointments Table**:
   - REMOVE: `customerId` column
   - ADD: `platformUserId` column

2. **Customer Table**:
   - DEPRECATED: Move to `customer_insights`

---

## 📅 Implementation Timeline

### Week 1: Backend
- **Day 1-2**: Create new models (PlatformUser, CustomerInsight, PaymentMethod, Transaction)
- **Day 3-4**: Build auth system (register, login, JWT)
- **Day 5**: Update booking service to use platform users
- **Day 6-7**: Build tenant customer directory APIs

### Week 2: Frontend
- **Day 8-9**: Build registration/login pages
- **Day 10-11**: Build user dashboard
- **Day 12-13**: Update booking flow (require auth)
- **Day 14**: Build tenant customer directory UI

---

## 🔒 Security Considerations

1. **Password Security**:
   - bcrypt with salt rounds: 12
   - Password strength requirements
   - Rate limiting on login attempts

2. **JWT Tokens**:
   - Access token: 15 minutes
   - Refresh token: 7 days
   - Secure HTTP-only cookies

3. **Data Privacy**:
   - GDPR/PDPL compliance
   - User data export
   - Right to deletion
   - Tenant data isolation

4. **Payment Security**:
   - PCI DSS compliance
   - Tokenization (Stripe)
   - No raw card storage
   - Encrypted payment methods

---

## 🎯 Next Phase

After Phase 2.5 completion:
- ✅ Users can register once, book anywhere
- ✅ Tenants can see their customer directory
- ✅ Platform has unified user analytics
- ➡️ **Ready for Phase 3: Payment Integration**

---

**Estimated Effort**: 2 weeks (1 backend developer + 1 frontend developer)  
**Priority**: CRITICAL - Must complete before payments  
**Dependencies**: Phase 2 (Booking System)  
**Blocks**: Phase 3 (Payment Integration)
