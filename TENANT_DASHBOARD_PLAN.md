# 🏢 Rifah Tenant Dashboard - Implementation Plan

## Document Overview
This document outlines the complete implementation plan for the **Tenant Dashboard** (Salon/Spa/Barbershop owners portal). This is the third pillar of the Rifah platform, enabling business owners to manage their operations independently.

**Last Updated**: November 25, 2025  
**Status**: 📋 Planning Phase  
**Port**: `3003` (localhost:3003)

---

## 🎯 Platform Architecture Overview

| Application | Port | Users | Status |
|-------------|------|-------|--------|
| **Client App** | 3000 | End customers | ✅ Implemented |
| **Admin Dashboard** | 3002 | Super admins (Rifah team) | ✅ Implemented |
| **Tenant Dashboard** | 3003 | Salon/Spa owners | 🚧 To Build |
| **Backend API** | 5000 | All applications | ✅ Running |

---

## 📋 Core Requirements Analysis

### 1. 🛍️ **Service Management** (Enhanced)

**Form Fields for Adding/Editing Services:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Service Name | Text | ✅ Yes | e.g., "Haircut", "Massage" |
| Service Image | File Upload | ✅ Yes | Thumbnail for customer-facing page |
| Service Description | Textarea | ✅ Yes | Detailed description |
| **Includes** | Dynamic Array | ❌ No | Sub-service items (e.g., "Shampoo", "Styling") |
| Service Employees | Multi-select | ✅ Yes | Assign one or more employees |
| Has Offer | Toggle (Yes/No) | ✅ Yes | Enable promotional offer |
| Offer Details | Text/Textarea | ⚠️ Conditional | Required if "Has Offer" = Yes |
| Has Gift | Toggle (Yes/No) | ✅ Yes | Include a gift with service |
| Gift Details | Text/Dropdown | ⚠️ Conditional | Free text or select from products |
| **Raw Price** | Number (SAR) | ✅ Yes | Base service price |
| Tax (15%) | Auto-calculated | - | Saudi VAT (15% of raw price) |
| System Commission | Auto-calculated | - | Configurable % from Admin Dashboard |
| **Final Price** | Display Only | - | Raw + Tax + Commission |

**Price Calculation Formula:**
```
Raw Price:         500 SAR
Tax (15%):          75 SAR  (500 * 0.15)
System Fee (10%):   50 SAR  (500 * 0.10) [configurable]
─────────────────────────
Final Price:       625 SAR
```

**Notes:**
- System commission % should be configurable from **Admin Dashboard Settings**
- Can be set globally or per-tenant
- Default: 10% commission

---

### 2. 📦 **Product Management** (NEW)

**E-commerce-style product catalog for gifts and retail sales.**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Product Name | Text | ✅ Yes | e.g., "Hair Oil", "Face Cream" |
| Product Description | Textarea | ✅ Yes | Detailed description |
| Product Image | File Upload | ✅ Yes | Product thumbnail |
| Product Price | Number (SAR) | ✅ Yes | Retail price |
| Category | Dropdown | ✅ Yes | e.g., "Hair Care", "Skin Care" |
| Stock/Inventory | Number | ✅ Yes | Available quantity |
| Is Available | Toggle | ✅ Yes | Enable/disable product |

**Features:**
- Products can be selected as **gifts** when adding services
- Displayed in tenant's customer-facing page
- Track inventory
- Can be sold separately (future: e-commerce integration)

---

### 3. 👥 **Employee Management** (Enhanced)

**Comprehensive employee profiles for scheduling and service assignment.**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Full Name | Text | ✅ Yes | Employee name |
| Nationality | Dropdown | ✅ Yes | e.g., "Saudi", "Egyptian", "Filipino" |
| Bio | Textarea | ❌ No | Short biography |
| Experience | Text/Number | ✅ Yes | e.g., "5 years" or "5" (years) |
| Skills | Multi-tag Input | ✅ Yes | e.g., "Haircut", "Coloring", "Massage" |
| Photo | File Upload | ✅ Yes | Employee photo |
| **Salary** | Number (SAR) | ✅ Yes | Monthly base salary |
| **Working Hours** | Schedule Picker | ✅ Yes | Days and hours (e.g., Sun-Thu, 9AM-6PM) |
| Commission Rate | Number (%) | ❌ No | % of service revenue (optional) |
| Is Active | Toggle | ✅ Yes | Active/Inactive status |

**Working Hours Example:**
```json
{
  "sunday": { "start": "09:00", "end": "18:00" },
  "monday": { "start": "09:00", "end": "18:00" },
  "tuesday": { "start": "09:00", "end": "18:00" },
  "wednesday": { "start": "09:00", "end": "18:00" },
  "thursday": { "start": "09:00", "end": "18:00" },
  "friday": { "off": true },
  "saturday": { "off": true }
}
```

**Features:**
- Once employee is added, they can be assigned to services
- Schedule determines availability for bookings
- Track employee performance and revenue

---

### 4. 📅 **Appointments/Calendar** (Enhanced)

**Visual calendar with detailed appointment information.**

**Calendar View:**
- Day view, Week view, Month view
- Color-coded by status (confirmed, pending, completed, cancelled)
- Click appointment to see details

**Appointment Details Modal/Page:**
| Field | Display |
|-------|---------|
| Client Name | Full name + contact |
| Client Photo | Profile image (if available) |
| Service | Service name + description |
| Employee | Employee name + photo |
| Date & Time | e.g., "Nov 25, 2025 - 10:00 AM - 11:30 AM" |
| Duration | e.g., "90 minutes" |
| **Price Breakdown** | Raw price, Tax, Commission, **Final price** |
| Status | Confirmed / Pending / Completed / Cancelled |
| Payment Status | Paid / Pending / Refunded |
| Created At | Booking timestamp |
| Notes | Customer notes/requests |

**Actions:**
- Approve/Reject (if booking requires approval)
- Cancel booking (with refund)
- Reschedule
- Contact customer

---

### 5. 💰 **Financial Management** (Enhanced)

**Comprehensive financial tracking with employee revenue analysis.**

#### 5.1 Overview Dashboard
- Total revenue (today, this week, this month, all time)
- Pending payouts (from Rifah platform)
- Tax collected (15% VAT)
- Platform fees paid
- Net revenue (after tax and fees)

#### 5.2 Employee Revenue Tracking 🎯
**Filter Options:**
- By Employee
- By Date Range (today, this week, this month, custom)
- By Service

**Employee Revenue Breakdown:**
```
┌─────────────────────────────────────────────────────┐
│ Employee: Ahmed Ali                                  │
│ Period: Nov 1 - Nov 25, 2025                        │
├─────────────────────────────────────────────────────┤
│ Total Bookings:        45                           │
│ Total Revenue:         22,500 SAR                   │
│ Base Salary:           5,000 SAR                    │
│ Commission (10%):      2,250 SAR                    │
│ Total Earnings:        7,250 SAR                    │
└─────────────────────────────────────────────────────┘
```

**Table View:**
| Employee | Bookings | Revenue Generated | Commission | Total Earnings |
|----------|----------|-------------------|------------|----------------|
| Ahmed Ali | 45 | 22,500 SAR | 2,250 SAR | 7,250 SAR |
| Sara Hassan | 38 | 19,000 SAR | 1,900 SAR | 6,900 SAR |

**Future Enhancement (Payroll System):**
- Automatic salary calculation (base + commission)
- Payroll processing
- Pay stubs generation
- Bank transfer integration

#### 5.3 Revenue Breakdown
- Revenue by service
- Revenue by day/week/month
- Peak hours analysis
- Customer retention metrics

---

## 🗂️ Database Schema Changes

### New/Updated Models:

#### 1. **Service Model** (Updated)
```javascript
{
  id: UUID,
  tenantId: UUID,
  name: STRING,
  description: TEXT,
  image: STRING,                    // NEW: Image URL
  includes: JSON,                   // NEW: Array of sub-items
  price: DECIMAL(10, 2),           // Raw price
  taxRate: DECIMAL(5, 2),          // NEW: Tax rate (default 15%)
  commissionRate: DECIMAL(5, 2),   // NEW: System commission %
  finalPrice: DECIMAL(10, 2),      // NEW: Calculated final price
  hasOffer: BOOLEAN,               // NEW
  offerDetails: TEXT,              // NEW
  hasGift: BOOLEAN,                // NEW
  giftType: ENUM('text', 'product'), // NEW
  giftDetails: TEXT,               // NEW: Free text or product ID
  duration: INTEGER,
  category: STRING,
  isActive: BOOLEAN,
  createdAt: DATE,
  updatedAt: DATE
}
```

#### 2. **Product Model** (NEW)
```javascript
{
  id: UUID,
  tenantId: UUID,
  name: STRING,
  description: TEXT,
  image: STRING,
  price: DECIMAL(10, 2),
  category: STRING,
  stock: INTEGER,
  isAvailable: BOOLEAN,
  createdAt: DATE,
  updatedAt: DATE
}
```

#### 3. **Staff Model** (Updated)
```javascript
{
  id: UUID,
  tenantId: UUID,
  name: STRING,
  email: STRING,
  phone: STRING,
  nationality: STRING,             // NEW
  bio: TEXT,                       // NEW
  experience: STRING,              // NEW
  skills: JSON,                    // NEW: Array of skills
  photo: STRING,                   // NEW
  salary: DECIMAL(10, 2),         // NEW
  commissionRate: DECIMAL(5, 2),  // NEW
  workingHours: JSON,             // NEW: Schedule object
  rating: DECIMAL(3, 2),
  isActive: BOOLEAN,
  createdAt: DATE,
  updatedAt: DATE
}
```

#### 4. **ServiceEmployee Model** (NEW - Junction Table)
```javascript
{
  id: UUID,
  serviceId: UUID,
  staffId: UUID,
  createdAt: DATE
}
```

#### 5. **TenantSettings Model** (NEW)
```javascript
{
  id: UUID,
  tenantId: UUID,
  commissionRate: DECIMAL(5, 2),   // Tenant-specific commission (overrides global)
  taxRate: DECIMAL(5, 2),           // Default: 15% (Saudi VAT)
  currency: STRING,                 // Default: SAR
  timezone: STRING,                 // Default: Asia/Riyadh
  businessHours: JSON,              // Operating hours
  bookingSettings: JSON,            // Auto-approval, buffer time, etc.
  paymentSettings: JSON,            // Payment methods, payout details
  createdAt: DATE,
  updatedAt: DATE
}
```

#### 6. **Appointment Model** (Updated)
```javascript
// Add tracking for employee revenue
{
  // ... existing fields
  employeeRevenue: DECIMAL(10, 2), // NEW: Revenue attributed to employee
  tenantRevenue: DECIMAL(10, 2),   // NEW: Revenue after platform fee
  platformFee: DECIMAL(10, 2),     // NEW: Commission taken by Rifah
}
```

---

## 🎨 Frontend Structure

```
tenant/                                 (Port: 3003)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── public/
│   └── fonts/
│       └── Claudion.ttf               # Saudi Riyal symbol font
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Redirect to /login or /dashboard
│   │   ├── login/
│   │   │   └── page.tsx               # Tenant login
│   │   ├── register/
│   │   │   └── page.tsx               # Tenant registration (business signup)
│   │   └── dashboard/
│   │       ├── page.tsx               # Main dashboard (stats, today's bookings)
│   │       ├── services/
│   │       │   ├── page.tsx           # Services list (table/grid)
│   │       │   ├── new/
│   │       │   │   └── page.tsx       # Add new service (complex form)
│   │       │   └── [id]/
│   │       │       └── page.tsx       # Edit service
│   │       ├── products/
│   │       │   ├── page.tsx           # Products list
│   │       │   ├── new/
│   │       │   │   └── page.tsx       # Add new product
│   │       │   └── [id]/
│   │       │       └── page.tsx       # Edit product
│   │       ├── employees/
│   │       │   ├── page.tsx           # Employees list (cards/table)
│   │       │   ├── new/
│   │       │   │   └── page.tsx       # Add new employee
│   │       │   └── [id]/
│   │       │       └── page.tsx       # Edit employee + performance
│   │       ├── appointments/
│   │       │   ├── page.tsx           # Calendar view
│   │       │   └── [id]/
│   │       │       └── page.tsx       # Appointment details
│   │       ├── customers/
│   │       │   ├── page.tsx           # Customers list
│   │       │   └── [id]/
│   │       │       └── page.tsx       # Customer details + history
│   │       ├── financial/
│   │       │   ├── page.tsx           # Financial overview
│   │       │   ├── employees/
│   │       │   │   └── page.tsx       # Employee revenue breakdown
│   │       │   └── reports/
│   │       │       └── page.tsx       # Detailed financial reports
│   │       └── settings/
│   │           ├── page.tsx           # Business settings (profile, hours)
│   │           ├── billing/
│   │           │   └── page.tsx       # Billing & payout settings
│   │           └── notifications/
│   │               └── page.tsx       # Notification preferences
│   ├── components/
│   │   ├── TenantLayout.tsx           # Main layout (sidebar, header)
│   │   ├── Currency.tsx               # Saudi Riyal symbol component
│   │   ├── ServiceForm.tsx            # Reusable service form
│   │   ├── ProductForm.tsx            # Reusable product form
│   │   ├── EmployeeForm.tsx           # Reusable employee form
│   │   ├── SchedulePicker.tsx         # Working hours picker
│   │   ├── ImageUpload.tsx            # Image upload component
│   │   ├── PriceCalculator.tsx        # Price breakdown display
│   │   ├── AppointmentCalendar.tsx    # Calendar component
│   │   └── RevenueChart.tsx           # Financial charts
│   ├── contexts/
│   │   ├── TenantAuthContext.tsx      # Tenant authentication
│   │   └── TenantContext.tsx          # Current tenant data
│   └── lib/
│       ├── api.ts                     # API client (with tenant auth)
│       └── currency.ts                # Currency formatting
```

---

## 🔧 Backend API Endpoints (New/Updated)

### Service Management
```
POST   /api/v1/tenant/services              # Create service
GET    /api/v1/tenant/services              # List services
GET    /api/v1/tenant/services/:id          # Get service
PUT    /api/v1/tenant/services/:id          # Update service
DELETE /api/v1/tenant/services/:id          # Delete service
POST   /api/v1/tenant/services/:id/image    # Upload service image
```

### Product Management (NEW)
```
POST   /api/v1/tenant/products              # Create product
GET    /api/v1/tenant/products              # List products
GET    /api/v1/tenant/products/:id          # Get product
PUT    /api/v1/tenant/products/:id          # Update product
DELETE /api/v1/tenant/products/:id          # Delete product
POST   /api/v1/tenant/products/:id/image    # Upload product image
```

### Employee Management
```
POST   /api/v1/tenant/employees             # Create employee
GET    /api/v1/tenant/employees             # List employees
GET    /api/v1/tenant/employees/:id         # Get employee
PUT    /api/v1/tenant/employees/:id         # Update employee
DELETE /api/v1/tenant/employees/:id         # Delete employee
POST   /api/v1/tenant/employees/:id/photo   # Upload employee photo
GET    /api/v1/tenant/employees/:id/revenue # Get employee revenue
```

### Appointments
```
GET    /api/v1/tenant/appointments          # List appointments
GET    /api/v1/tenant/appointments/:id      # Get appointment details
PUT    /api/v1/tenant/appointments/:id      # Update appointment (approve/reject)
DELETE /api/v1/tenant/appointments/:id      # Cancel appointment
GET    /api/v1/tenant/appointments/calendar # Calendar data
```

### Financial
```
GET    /api/v1/tenant/financial/overview    # Financial overview
GET    /api/v1/tenant/financial/employees   # Employee revenue breakdown
GET    /api/v1/tenant/financial/reports     # Detailed reports
GET    /api/v1/tenant/financial/transactions # Transaction history
```

### Settings
```
GET    /api/v1/tenant/settings              # Get tenant settings
PUT    /api/v1/tenant/settings              # Update tenant settings
GET    /api/v1/tenant/profile               # Get business profile
PUT    /api/v1/tenant/profile               # Update business profile
```

---

## 🔐 Admin Dashboard Enhancement

### Settings Section (NEW)

**Add to Admin Dashboard:**
```
/admin/dashboard/settings/
├── general/              # Platform-wide settings
├── commission/           # System commission rates
│   ├── Global rate      # Default: 10%
│   └── Per-tenant rates # Override for specific tenants
└── tax/                 # Tax configuration
    └── Default: 15% (Saudi VAT)
```

**Commission Settings:**
- **Global Commission**: Default rate for all tenants (e.g., 10%)
- **Tenant Override**: Set custom rate for specific tenants
- **Audit Log**: Track all changes to commission rates

---

## 🚀 Implementation Phases

### **Phase 1: Foundation (Week 1)** 🎯
**Goal**: Basic tenant dashboard structure and authentication

- [ ] Create `tenant/` Next.js app (port 3003)
- [ ] Implement tenant authentication (login/register)
- [ ] Create `TenantAuthContext` and `TenantLayout`
- [ ] Build main dashboard page (basic stats)
- [ ] Add Saudi Riyal currency component
- [ ] Set up API client with tenant auth

**Backend:**
- [ ] Create tenant authentication endpoints
- [ ] Add `authenticateTenant` middleware
- [ ] Create basic tenant profile endpoints

---

### **Phase 2: Employee Management (Week 1-2)** 👥
**Goal**: Complete employee CRUD and scheduling

- [ ] Update `Staff` model (nationality, bio, experience, skills, salary, workingHours, photo)
- [ ] Build employee list page (cards/table)
- [ ] Build add employee form (all fields + photo upload)
- [ ] Build edit employee page
- [ ] Create working hours/schedule picker component
- [ ] Implement employee photo upload

**Backend:**
- [ ] Update Staff model with new fields
- [ ] Create employee CRUD endpoints
- [ ] Add employee photo upload endpoint
- [ ] Validate working hours format

---

### **Phase 3: Product Management (Week 2)** 📦
**Goal**: E-commerce product catalog

- [ ] Create `Product` model
- [ ] Build product list page
- [ ] Build add/edit product form
- [ ] Implement product image upload
- [ ] Add inventory tracking
- [ ] Create product categories

**Backend:**
- [ ] Create Product model and migrations
- [ ] Create product CRUD endpoints
- [ ] Add product image upload endpoint
- [ ] Add inventory management logic

---

### **Phase 4: Service Management (Week 2-3)** 🛍️
**Goal**: Complete service management with pricing

- [ ] Update `Service` model (image, includes, offers, gifts, pricing)
- [ ] Create `ServiceEmployee` junction model
- [ ] Build service list page
- [ ] Build comprehensive service form:
  - [ ] Basic info (name, description, image)
  - [ ] Includes (dynamic array)
  - [ ] Employee assignment (multi-select)
  - [ ] Offers and gifts
  - [ ] Price calculator (raw + tax + commission)
- [ ] Implement service image upload
- [ ] Display final price breakdown

**Backend:**
- [ ] Update Service model with new fields
- [ ] Create ServiceEmployee model
- [ ] Implement price calculation logic
- [ ] Create service CRUD endpoints
- [ ] Add service image upload endpoint
- [ ] Add employee assignment endpoints

---

### **Phase 5: Appointments & Calendar (Week 3-4)** 📅
**Goal**: Visual calendar with detailed appointment info

- [ ] Build calendar component (day/week/month views)
- [ ] Implement appointment list/filter
- [ ] Build appointment details modal/page
- [ ] Add appointment actions (approve, cancel, reschedule)
- [ ] Show price breakdown in appointments
- [ ] Add employee and customer info in appointments

**Backend:**
- [ ] Update Appointment model (employeeRevenue, tenantRevenue, platformFee)
- [ ] Create tenant appointment endpoints
- [ ] Add appointment approval/cancellation logic
- [ ] Add calendar data endpoint (grouped by date)

---

### **Phase 6: Financial Management (Week 4)** 💰
**Goal**: Comprehensive financial tracking with employee revenue

- [ ] Build financial overview dashboard
- [ ] Build employee revenue breakdown page
- [ ] Add filters (by employee, date range, service)
- [ ] Display revenue charts
- [ ] Show tax and commission breakdown
- [ ] Calculate employee earnings (salary + commission)

**Backend:**
- [ ] Create financial overview endpoint
- [ ] Create employee revenue breakdown endpoint
- [ ] Implement revenue calculation logic
- [ ] Add filtering and date range support

---

### **Phase 7: Admin Dashboard Enhancement (Week 4)** ⚙️
**Goal**: Commission and tax configuration

- [ ] Add Settings section to Admin Dashboard
- [ ] Build commission rate configuration (global + per-tenant)
- [ ] Build tax rate configuration
- [ ] Add audit log for rate changes
- [ ] Update tenant settings model

**Backend:**
- [ ] Create `TenantSettings` model
- [ ] Add admin settings endpoints
- [ ] Implement commission rate override logic
- [ ] Add audit logging for settings changes

---

## ✅ Business Requirements - CONFIRMED:

### 1. **Service Includes** ✅
**Answer**: **Option A** - Free-form text (flexible)
- Display as bullet points with nice bullet icons
- Tenants can add multiple include items
- Example: "• Shampoo", "• Blow-dry", "• Styling"

### 2. **Gift Selection** ✅
**Answer**: **Option C** - Both free text AND product selection
- Tenants can either:
  - Type custom gift description (e.g., "Free hair oil sample")
  - Select from their products catalog
- Flexible approach for different scenarios

### 3. **Employee Commission** ✅
**Answer**: **Option C** - Different rate per service
- Each service can have different commission rate for each employee
- Also controllable from employee page
- Example: Ahmed gets 10% for haircuts, 15% for coloring

### 4. **System Commission** ✅
**Answer**: **Option C** - Both (global default + tenant override)
- **Revenue Streams**:
  1. **Monthly subscription fees** (different packages)
  2. **Commission on bookings** (configurable)
  3. **Premium features** (WhatsApp, SMS, custom features)
- Different subscription tiers may have different commission rates
- Admin can override commission per tenant

### 5. **Product Inventory** ✅
**Answer**: **Option A** - Auto-decrease when service booked
- When product is selected as gift, inventory automatically decreases
- Track product availability
- Alert when inventory is low

### 6. **Appointment Approval** ✅
**Answer**: **Option B** - Tenant chooses (setting)
- Toggle in tenant settings: Auto-approve OR Manual approval
- **Voice notification** when new appointment arrives (important!)
- Receptionist/dashboard user gets notified

### 7. **Employee Revenue** ✅
**Answer**: **Option C** - Full payroll system
- Track: Base salary + Commission + Deductions
- Complete payroll management
- Generate pay stubs
- Calculate total earnings per employee

### 8. **Calendar Access** ✅
**Answer**: **Option C** - Mobile app (future phase)
- **Employee Mobile App** (to be developed after main system is stable)
- Admin creates employee accounts with username/password
- Employee sees: Their calendar, appointments, time, break time
- **Granular Permissions** (set when creating employee account):
  - Show commission (yes/no)
  - Send messages (yes/no)
  - View revenue (yes/no)
  - Other configurable options
- NO access to sensitive financial data (unless permitted)

---

## 🌟 Additional Critical Requirements:

### 1. **Language & Localization** 🌍
- **Default Language**: Arabic (NOT English!)
- **Font**: Cairo (primary font for Arabic)
- **Secondary Language**: English
- All dashboard pages must be bilingual
- RTL support for Arabic

### 2. **Voice Notifications** 🔔
- Voice notification system for new appointments
- Alert receptionist/dashboard users instantly
- Configurable sound/voice settings

### 3. **Subscription Packages** 💎
- Different tiers (Basic, Pro, Premium)
- Different features per tier
- Different commission rates per tier
- Feature marketplace (WhatsApp, SMS, custom features)

### 4. **Flexible Architecture** 🔧
- System must be flexible for future modifications
- Modular design for easy feature additions
- Scalable for new business models

### 5. **Employee App** 📱 (Future Phase)
- Mobile app for employees
- Login with credentials created by admin
- View personal schedule only
- Granular permissions system
- NO financial data (unless permitted)

### 6. **Revenue Model** 💰
1. **Subscription Fees** (monthly/annual)
2. **Booking Commissions** (% of each transaction)
3. **Premium Features** (pay-per-feature):
   - WhatsApp notifications
   - SMS notifications
   - Custom integrations
   - Advanced analytics
   - Marketing tools

---

## 🎯 Recommended Implementation Order:

**My Suggestion:**
1. ✅ **Phase 1-2**: Foundation + Employees (Week 1) - CRITICAL
2. ✅ **Phase 3**: Products (Week 2) - Needed for gifts
3. ✅ **Phase 4**: Services (Week 2-3) - Core feature
4. ✅ **Phase 5**: Appointments (Week 3-4) - Core feature
5. ✅ **Phase 6**: Financial (Week 4) - Important for tenant
6. ✅ **Phase 7**: Admin Settings (Week 4) - Final polish

**Total Timeline: 4 weeks** for complete Tenant Dashboard

---

## 🚀 Ready to Start, Captain?

**Answer my 8 questions above, and I'll immediately start building Phase 1!** 

Or, if you want me to make reasonable assumptions and just start coding, say "**Let's fly, Captain!**" and I'll begin! 🎯🚀
