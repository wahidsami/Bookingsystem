# Admin Dashboard Financial Analysis - Tenant Earnings & Commission

## 🎯 Executive Summary

Your system **tracks every dollar** that tenants make. Here's what you're capturing:

| Data Point | Tracked? | Where |
|-----------|----------|-------|
| ✅ **Tenant Gross Revenue** | YES | Transactions.amount + Appointments.price |
| ✅ **Platform Commission** | YES | Transactions.platformFee + Appointments.platformFee |
| ✅ **Tenant Net Revenue** | YES | Transactions.tenantRevenue + Appointments.tenantRevenue |
| ✅ **Employee Commissions** | YES | Appointments.employeeCommission |
| ✅ **Tenant Net After Employees** | YES | Calculated (tenantRevenue - employeeCommissions) |
| ✅ **Hours Worked** | PARTIAL | Staff schedules tracked, but needs aggregation |
| ✅ **Booking Count** | YES | Appointments table |
| ✅ **Payment Status** | YES | Transaction.status + Appointment.paymentStatus |

---

## 💰 COMMISSION STRUCTURE

### 1. Platform Commission (What YOU Earn)

**Per Package:**
```
Free Trial Plan:         5.00% commission
Starter Plan:            7.00% commission  
Professional Plan:       8.00% commission
Enterprise Plan:         3.50% commission
Custom Plans:            Variable (2.50% - 8.00%)
```

**How It Works:**
```
Booking Amount:          SAR 100.00
├─ Platform Commission:  SAR 8.00 (8% for Professional plan)
└─ Tenant Gets:          SAR 92.00

Order Amount:            SAR 500.00
├─ Platform Commission:  SAR 40.00 (8%)
└─ Tenant Gets:          SAR 460.00
```

**Data Location:**
```javascript
// In Transactions table:
{
  amount: 100.00,           // Total customer paid
  platformFee: 8.00,        // Your commission (WHAT YOU EARN)
  tenantRevenue: 92.00,     // What tenant gets
  type: 'booking'
}

// In Appointments table:
{
  price: 100.00,            // Total customer paid
  platformFee: 8.00,        // Your commission
  tenantRevenue: 92.00,     // What tenant gets
  status: 'completed'
}
```

---

## 👥 EMPLOYEE COMMISSION

### 2. Employee Commission (What You PAY Staff)

**Per Employee:**
```
Default Rate:            10% of service price
Custom Rates:            Configurable per service
Service-Specific:        Can override default rate
```

**Example:**
```
Booking Price:           SAR 100.00
├─ Platform Fee (8%):    SAR 8.00 ← You keep this
├─ Employee Commission:  SAR 10.00 ← You pay this to staff
└─ Tenant Profit:        SAR 82.00 (92 - 10)

From Customer SAR 100:
  ✓ Platform (You):  SAR 8.00
  ✓ Employee:        SAR 10.00
  ✓ Tenant:          SAR 82.00
```

**Data Location:**
```javascript
// In Appointments table:
{
  price: 100.00,
  platformFee: 8.00,              // Your commission
  employeeCommission: 10.00,      // What you pay to staff
  tenantRevenue: 92.00,           // What tenant keeps
  status: 'completed'
}

// In Staff model:
{
  commissionRate: 10.00,          // % commission on services
  name: "Sarah Ahmed"
}
```

---

## 📊 COMPLETE FINANCIAL BREAKDOWN

### What Happens in ONE Booking (SAR 100 service)

```
CUSTOMER PAYS:                    SAR 100.00
├─ Tax (if applicable):          SAR 5.00 (5%)
├─ Raw Service Price:            SAR 95.00

BREAKDOWN:
1. Platform Commission:           SAR 8.00    (8% of 100) ✓ YOU
2. Tax (to tenant):              SAR 5.00    ✓ TENANT
3. Raw Price:                    SAR 95.00   ✓ TENANT
4. Employee Commission:          -SAR 10.00  ✗ TENANT PAYS
5. Tenant Net:                   SAR 90.00   ✓ TENANT (95 + 5 - 10)

YOUR TOTAL EARNINGS:             SAR 8.00
TENANT TOTAL EARNINGS:           SAR 90.00
EMPLOYEE EARNINGS:               SAR 10.00
TOTAL:                          SAR 108.00  (includes tax)
```

---

## 📈 TRACKING HOURS

### Current System:

**What's Tracked:**
```javascript
// Staff Schedule (staff_schedules table):
{
  staffId: "uuid",
  dayOfWeek: 1,           // Monday = 1
  startTime: "09:00",
  endTime: "20:00",       // 11 hours = working hours tracked
  isActive: true
}

// Each appointment creates a booking:
{
  startTime: "2025-01-22 14:00:00",
  endTime: "2025-01-22 14:30:00",    // 30 minutes = hours worked
  duration: 30,                       // in minutes
  staff: { name: "Sarah Ahmed" }
}
```

**What You CAN Calculate:**
```
Total Hours Scheduled:    Derived from schedules
Total Hours Worked:       SUM(appointment durations) / 60
Utilization Rate:         Hours Worked / Hours Scheduled

Example:
- Sarah works: 9am-5pm (8 hours/day)
- Bookings: 6 appointments × 30 mins = 3 hours
- Utilization: 3/8 = 37.5%
```

---

## 🔍 DATA STRUCTURE IN DETAIL

### Transaction Model
```javascript
{
  id: UUID,
  platformUserId: UUID,           // Who paid (customer)
  tenantId: UUID,                 // Who got paid
  appointmentId: UUID,            // Which service
  orderId: UUID,                  // Which product (if any)
  amount: DECIMAL(10,2),          // Total paid (YOUR COMMISSION + TENANT REVENUE)
  currency: 'SAR',
  type: 'booking',                // Type: booking, product_purchase, refund, etc.
  status: 'completed',            // pending, completed, failed, refunded
  platformFee: DECIMAL(10,2),     // ✓ YOUR COMMISSION
  tenantRevenue: DECIMAL(10,2),   // ✓ TENANT GETS (amount - platformFee)
  createdAt: TIMESTAMP
}
```

### Appointment Model
```javascript
{
  id: UUID,
  tenantId: UUID,                 // Which salon/business
  customerId: UUID,               // Who booked
  serviceId: UUID,
  staffId: UUID,                  // Which employee
  
  // Pricing breakdown:
  rawPrice: DECIMAL,              // Base service price
  taxAmount: DECIMAL,             // Tax (usually 5%)
  price: DECIMAL,                 // Total customer pays
  
  // Commission breakdown:
  platformFee: DECIMAL,           // ✓ YOUR COMMISSION (usually 8%)
  tenantRevenue: DECIMAL,         // ✓ WHAT TENANT KEEPS (price - platformFee)
  employeeCommission: DECIMAL,    // ✓ WHAT YOU PAY EMPLOYEE
  
  paymentStatus: 'pending'|'paid',
  status: 'completed'|'confirmed'|'cancelled',
  startTime: TIMESTAMP,
  duration: INTEGER,              // minutes
  createdAt: TIMESTAMP
}
```

### Staff Model
```javascript
{
  id: UUID,
  tenantId: UUID,
  name: "Sarah Ahmed",
  email: "sarah@example.com",
  phone: "+966...",
  
  // Commission config:
  commissionRate: DECIMAL,        // e.g., 10.00 for 10% per service
  commission: DECIMAL,            // Legacy field
  
  // Hours tracking:
  skillTags: JSONB,               // What services they do
  createdAt: TIMESTAMP
}
```

---

## 📊 WHAT THE ADMIN DASHBOARD CURRENTLY SHOWS

### Financial Page (`/dashboard/financial`)
```
Displays:
├─ Total Revenue (Platform Fees Collected)
│  └─ All platformFee values SUM from Transactions
├─ This Month Revenue
│  └─ Filtered by date
├─ Growth % comparison
└─ Revenue by period
```

**Problem:** ⚠️ **INCOMPLETE**
- Only shows YOUR revenue (platformFee)
- Doesn't show tenant revenues
- Doesn't show employee commissions
- No per-tenant breakdown
- No hours/utilization data

### Clients/Tenants Page (`/dashboard/clients`)
```
Displays:
├─ List of all tenants (businesses)
├─ Basic info: name, email, city, business type
├─ Status & Plan
├─ stats.totalBookings (if available)
└─ stats.totalRevenue (if available)
```

**Problem:** ⚠️ **INCOMPLETE**
- Stats are NOT calculated (mock data returns 0)
- No tenant earnings shown
- No commission breakdown
- No hours data
- No payment reconciliation

---

## 🔧 WHAT'S MISSING - Implementation Gap

### Currently NOT Exposed in Admin Dashboard:

1. **❌ Tenant Financial Summary**
   - How much each tenant has earned
   - How much platform commission they paid
   - How much they paid employees

2. **❌ Per-Tenant Commission Report**
   - Commission rate per package
   - Total commissions paid to platform
   - Commission trends

3. **❌ Employee Hours & Earnings**
   - Total hours worked per employee per tenant
   - Commission earned by employee
   - Utilization rate per employee
   - Hours scheduled vs. actually worked

4. **❌ Revenue Reconciliation**
   - What was paid by customers
   - What went to tenants
   - What went to platform
   - What went to employees

---

## 💡 RECOMMENDATIONS - What to Build

### 1. Tenant Financial Dashboard (Per Tenant)
```typescript
interface TenantFinancial {
  // Revenue data
  totalGrossRevenue: number;      // What customers paid
  totalPlatformFees: number;      // What YOU collected (8%)
  totalTenantRevenue: number;     // What tenant keeps
  totalEmployeeCommissions: number; // What you paid employees
  
  // Breakdown
  bookingRevenue: number;         // From services
  productRevenue: number;         // From products
  
  // Status
  paidToTenant: number;           // Already transferred
  pendingPayments: number;        // Awaiting payout
  
  // Performance
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  
  // Time period
  period: '30d' | '90d' | 'ytd' | 'custom'
  dateRange: { from: Date, to: Date }
}
```

### 2. Employee Hours Report (Per Tenant)
```typescript
interface EmployeeHours {
  staffId: UUID;
  staffName: string;
  
  // Scheduled
  totalHoursScheduled: number;    // Sum of schedule hours
  daysScheduled: number;
  
  // Actual Work
  totalHoursWorked: number;       // Sum of appointment durations
  totalBookings: number;
  
  // Earnings
  commissionRate: number;         // % or fixed rate
  totalEarnings: number;          // Sum of commissions
  
  // Utilization
  utilizationRate: number;        // actual / scheduled %
}
```

### 3. Commission Summary Report
```typescript
interface CommissionReport {
  period: string;
  
  // Platform earnings
  totalBookingValue: number;      // What customers paid
  platformCommissionRate: number; // e.g., 8%
  totalPlatformEarnings: number;  // What you earned
  
  // Breakdown by tenant
  tenants: Array<{
    tenantId: UUID;
    tenantName: string;
    commission_rate: number;      // Their package rate
    bookingValue: number;
    platformFee: number;
    tenantRevenue: number;
  }>;
  
  // Summary
  totalRevenueSplit: {
    platform: number;             // Your share
    tenants: number;              // Their share
    employees: number;            // Employee commissions
  };
}
```

---

## 🗂️ DATABASE QUERIES TO GET DATA

### Query 1: Total Platform Earnings (What You Make)
```sql
SELECT 
  SUM(platformFee) as total_platform_earnings,
  COUNT(*) as total_transactions,
  DATE_TRUNC('month', createdAt) as month
FROM transactions
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', createdAt)
ORDER BY month DESC;
```

**Result:**
```
total_platform_earnings | total_transactions | month
        8500.00        |       1200        | 2025-01-01
        7200.50        |       950         | 2024-12-01
```

### Query 2: Tenant Revenue (What They Make)
```sql
SELECT 
  tenantId,
  t.name as tenant_name,
  SUM(tenantRevenue) as total_tenant_revenue,
  SUM(platformFee) as total_commissions_paid,
  COUNT(*) as total_bookings
FROM transactions
JOIN tenants t ON tenantId = t.id
WHERE status = 'completed'
GROUP BY tenantId, t.name
ORDER BY total_tenant_revenue DESC;
```

**Result:**
```
tenantId | tenant_name | total_tenant_revenue | total_commissions_paid | total_bookings
uuid1    | Salon A     |      45000.00        |       5000.00         |       250
uuid2    | Salon B     |      32000.00        |       3800.00         |       180
```

### Query 3: Employee Hours & Earnings (Per Tenant)
```sql
SELECT 
  s.id as staff_id,
  s.name as staff_name,
  COUNT(*) as total_bookings,
  SUM(EXTRACT(EPOCH FROM (a.endTime - a.startTime))/3600) as hours_worked,
  SUM(a.employeeCommission) as total_commission,
  s.commissionRate
FROM appointments a
JOIN staff s ON a.staffId = s.id
WHERE a.status = 'completed'
  AND a.tenantId = 'target-tenant-id'
GROUP BY s.id, s.name, s.commissionRate
ORDER BY hours_worked DESC;
```

**Result:**
```
staff_id | staff_name  | total_bookings | hours_worked | total_commission | commissionRate
uuid1    | Sarah Ahmed |      150       |    75.5      |    7550.00       |     10.00
uuid2    | Fatima Al   |      120       |    60.0      |    6000.00       |     10.00
```

### Query 4: Commission Breakdown (By Package)
```sql
SELECT 
  p.name as plan_name,
  p.platformCommission as commission_rate,
  COUNT(DISTINCT t.id) as tenant_count,
  SUM(tr.platformFee) as total_commissions_earned
FROM tenants t
JOIN subscription_packages p ON t.plan = p.name
LEFT JOIN transactions tr ON t.id = tr.tenantId AND tr.status = 'completed'
WHERE t.status = 'approved'
GROUP BY p.name, p.platformCommission
ORDER BY total_commissions_earned DESC;
```

**Result:**
```
plan_name         | commission_rate | tenant_count | total_commissions_earned
Professional      |      8.00       |      45      |      125000.00
Starter           |      7.00       |      30      |       85000.00
Enterprise        |      3.50       |      10      |       42500.00
```

---

## 🎯 IMPLEMENTATION PRIORITY

### Phase 1 (Immediate - Most Important)
1. ✅ Create endpoint: `GET /api/v1/admin/financial/tenant-revenue`
   - Lists all tenant earnings
   - Show platform commission paid
   - Show net revenue to tenant
   
2. ✅ Create endpoint: `GET /api/v1/admin/financial/employee-hours/:tenantId`
   - Hours worked per employee
   - Commission earned
   - Utilization rate

### Phase 2 (Important)
1. Create detailed financial report page
   - Tenant earnings chart
   - Commission breakdown
   - Period comparison

2. Create employee payroll report
   - Hours & earnings per staff
   - Export for payment processing

### Phase 3 (Nice to Have)
1. Real-time analytics dashboard
2. Predictive revenue forecasting
3. Tenant profitability scoring

---

## 📋 SUMMARY TABLE

| Metric | Currently Tracked | Currently Shown in Admin | Priority to Add |
|--------|------------------|----------------------|-----------------|
| Your Commission (platformFee) | ✅ YES | ✅ YES (partial) | Medium |
| Tenant Revenue | ✅ YES | ❌ NO | 🔴 HIGH |
| Employee Commission | ✅ YES | ❌ NO | 🔴 HIGH |
| Tenant Hours Worked | ✅ YES | ❌ NO | 🔴 HIGH |
| Tenant Utilization Rate | ✅ Calculable | ❌ NO | 🟡 MEDIUM |
| Revenue Breakdown Chart | ❌ NO | ❌ NO | 🔴 HIGH |
| Per-Tenant Financial Details | ❌ Partial | ❌ NO | 🔴 HIGH |
| Commission Rate Breakdown | ✅ YES | ❌ NO | 🟡 MEDIUM |

---

## 🔐 SECURITY NOTES

- ✅ All financial data is in encrypted transactions table
- ✅ Audit logs track all financial changes
- ✅ Platform fees are automatically calculated
- ✅ No manual adjustment possible without admin action
- ✅ All payments tracked with timestamps

---

## 📞 NEXT STEPS

To see tenant earnings in admin dashboard:

1. **Build Financial Endpoint** - Query Transactions table
2. **Add Admin API Methods** - `getTenantFinancials()`, `getEmployeeHours()`
3. **Create Dashboard Page** - `/dashboard/financial/tenants`
4. **Add Charts** - Revenue breakdown, commission trends, etc.
5. **Export Reports** - CSV/PDF for accounting

Would you like me to build any of these endpoints? 🚀
