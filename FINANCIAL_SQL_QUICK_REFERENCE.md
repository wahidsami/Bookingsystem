# Quick Financial Data Reference

## 🚀 Get Instant Financial Data

### SQL Queries to Run Directly

#### 1. How Much Money Are YOU Making? (Platform Commission)
```sql
SELECT 
  DATE_TRUNC('month', "createdAt")::date as month,
  ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as earnings,
  COUNT(*) as transaction_count
FROM transactions
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', "createdAt")
ORDER BY month DESC
LIMIT 12;
```

**Expected Result:**
```
     month     |  earnings  | transaction_count
---------------+------------+-------------------
 2025-01-01    | 8500.00    |      1200
 2024-12-01    | 7200.50    |       950
```

---

#### 2. How Much Is Each TENANT Making? (Their Revenue)
```sql
SELECT 
  t.id,
  t.name,
  COUNT(*) as bookings,
  ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as tenant_earned,
  ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as paid_to_platform,
  t.plan as package
FROM transactions tr
JOIN tenants t ON tr."tenantId" = t.id
WHERE tr.status = 'completed'
GROUP BY t.id, t.name, t.plan
ORDER BY tenant_earned DESC;
```

**Expected Result:**
```
         id        |  name   | bookings | tenant_earned | paid_to_platform | package
-------------------+---------+----------+---------------+------------------+----------
 uuid-salon-1      | Salon A |   250    |  45000.00     |    5000.00       | Professional
 uuid-salon-2      | Salon B |   180    |  32000.00     |    3800.00       | Starter
```

---

#### 3. Employee Hours & Earnings (Per Tenant)
```sql
SELECT 
  t.name as tenant,
  s.name as employee,
  COUNT(*) as bookings,
  ROUND(SUM(a.duration) / 60.0, 1) as hours_worked,
  ROUND(SUM(CAST(a."employeeCommission" as NUMERIC)), 2) as earned
FROM appointments a
JOIN staff s ON a."staffId" = s.id
JOIN tenants t ON a."tenantId" = t.id
WHERE a.status = 'completed'
  AND a."tenantId" = 'TARGET-TENANT-UUID'  -- Replace with actual tenant UUID
GROUP BY t.name, s.name
ORDER BY hours_worked DESC;
```

**Expected Result:**
```
   tenant   |  employee   | bookings | hours_worked | earned
------------+-------------+----------+--------------+--------
 Salon A    | Sarah Ahmed |   150    |    75.5      | 7550.00
 Salon A    | Fatima Al   |   120    |    60.0      | 6000.00
```

---

#### 4. Commission Rate Breakdown (By Plan)
```sql
SELECT 
  p.name as plan,
  p."platformCommission",
  COUNT(DISTINCT tr."tenantId") as tenant_count,
  ROUND(SUM(CAST(tr."platformFee" as NUMERIC)), 2) as total_earned
FROM transactions tr
JOIN tenants t ON tr."tenantId" = t.id
JOIN subscription_packages p ON t.plan = p.name
WHERE tr.status = 'completed'
GROUP BY p.name, p."platformCommission"
ORDER BY total_earned DESC;
```

**Expected Result:**
```
      plan     | platformCommission | tenant_count | total_earned
---------------+-------------------+--------------+--------------
 Professional  |       8.00        |      45      |  125000.00
 Starter       |       7.00        |      30      |   85000.00
 Enterprise    |       3.50        |      10      |   42500.00
```

---

#### 5. What Exactly Happens in Each Booking?
```sql
SELECT 
  DATE_TRUNC('day', a."startTime")::date as date,
  s.name as service,
  st.name as staff,
  ROUND(CAST(a."rawPrice" as NUMERIC), 2) as service_price,
  ROUND(CAST(a."taxAmount" as NUMERIC), 2) as tax,
  ROUND(CAST(a.price as NUMERIC), 2) as customer_paid,
  ROUND(CAST(a."platformFee" as NUMERIC), 2) as your_commission,
  ROUND(CAST(a."tenantRevenue" as NUMERIC), 2) as tenant_gets,
  ROUND(CAST(a."employeeCommission" as NUMERIC), 2) as staff_gets
FROM appointments a
JOIN services s ON a."serviceId" = s.id
JOIN staff st ON a."staffId" = st.id
WHERE a.status = 'completed'
ORDER BY a."startTime" DESC
LIMIT 20;
```

**Expected Result:**
```
   date    |  service  |   staff   | service_price | tax   | customer_paid | your_commission | tenant_gets | staff_gets
-----------+-----------+-----------+---------------+-------+---------------+-----------------+-------------+----------
 2025-01-22| Haircut   | Sarah     |    100.00     | 5.00  |    105.00     |     8.40        |    96.60    |   10.00
 2025-01-22| Coloring  | Fatima    |    150.00     | 7.50  |    157.50     |    12.60        |    144.90   |   15.00
```

---

#### 6. Monthly Revenue Comparison (Growth Analysis)
```sql
WITH monthly_data AS (
  SELECT 
    DATE_TRUNC('month', "createdAt")::date as month,
    ROUND(SUM(CAST(amount as NUMERIC)), 2) as total_revenue,
    ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as your_earnings,
    ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as tenant_earnings,
    COUNT(*) as transaction_count
  FROM transactions
  WHERE status = 'completed'
  GROUP BY DATE_TRUNC('month', "createdAt")
  ORDER BY month DESC
  LIMIT 12
)
SELECT 
  month,
  total_revenue,
  your_earnings,
  tenant_earnings,
  transaction_count,
  ROUND((your_earnings / total_revenue * 100)::numeric, 1) as your_percentage
FROM monthly_data;
```

**Expected Result:**
```
    month    | total_revenue | your_earnings | tenant_earnings | transaction_count | your_percentage
--------------+---------------+---------------+-----------------+-------------------+------------------
 2025-01-01  |  105625.00    |   8450.00     |    97175.00     |      1200         |      8.0
 2024-12-01  |   95300.50    |   7224.00     |    88076.50     |      1050         |      7.6
```

---

#### 7. Top Earning Tenants (Leaderboard)
```sql
SELECT 
  ROW_NUMBER() OVER (ORDER BY total_revenue DESC) as rank,
  t.name,
  COUNT(*) as bookings,
  ROUND(SUM(CAST(tr.amount as NUMERIC)), 2) as gross_revenue,
  ROUND(SUM(CAST(tr."platformFee" as NUMERIC)), 2) as your_commission,
  ROUND(SUM(CAST(tr."tenantRevenue" as NUMERIC)), 2) as tenant_earned
FROM transactions tr
JOIN tenants t ON tr."tenantId" = t.id
WHERE tr.status = 'completed'
  AND tr."createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY t.id, t.name
ORDER BY tenant_earned DESC
LIMIT 10;
```

**Expected Result:**
```
 rank | name     | bookings | gross_revenue | your_commission | tenant_earned
------+----------+----------+---------------+-----------------+---------------
   1  | Salon A  |   250    |   45000.00    |    5000.00      |   40000.00
   2  | Salon B  |   180    |   32000.00    |    3800.00      |   28200.00
   3  | Salon C  |   120    |   18500.00    |    2200.00      |   16300.00
```

---

#### 8. Staff Utilization Report (Hours Worked)
```sql
SELECT 
  t.name as tenant,
  s.name as employee,
  COUNT(DISTINCT DATE(a."startTime")) as days_worked,
  COUNT(*) as total_appointments,
  ROUND(SUM(a.duration) / 60.0, 2) as hours_worked,
  ROUND(AVG(a.duration) / 60.0, 2) as avg_duration_hours
FROM appointments a
JOIN staff s ON a."staffId" = s.id
JOIN tenants t ON a."tenantId" = t.id
WHERE a.status = 'completed'
  AND a."startTime" >= NOW() - INTERVAL '30 days'
GROUP BY t.id, t.name, s.id, s.name
ORDER BY hours_worked DESC;
```

**Expected Result:**
```
  tenant  |  employee   | days_worked | total_appointments | hours_worked | avg_duration_hours
----------+-------------+-------------+--------------------+--------------+-------------------
 Salon A  | Sarah Ahmed |     25      |       150          |    75.50     |      0.50
 Salon A  | Fatima Al   |     22      |       120          |    60.00     |      0.50
 Salon B  | Layla H     |     20      |      100           |    50.25     |      0.50
```

---

## 📊 HOW TO USE THESE QUERIES

### Option 1: Direct Database Query
```bash
# SSH into your database server or use pgAdmin
psql -U rifah_user -d rifah_shared -h localhost -p 5434

# Copy and paste any query above
# Hit Enter to execute
```

### Option 2: From Node.js
```javascript
const db = require('./server/src/models');

// Example: Get tenant earnings
(async () => {
  const result = await db.sequelize.query(`
    SELECT 
      t.name,
      COUNT(*) as bookings,
      ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as earned
    FROM transactions tr
    JOIN tenants t ON tr."tenantId" = t.id
    WHERE tr.status = 'completed'
    GROUP BY t.id, t.name
    ORDER BY earned DESC;
  `);
  
  console.log(result[0]);
})();
```

### Option 3: Build API Endpoint
```javascript
// server/src/controllers/adminFinancialController.js
exports.getTenantFinancials = async (req, res) => {
  try {
    const result = await db.sequelize.query(`
      SELECT 
        t.id, t.name,
        COUNT(*) as bookings,
        ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as earned,
        ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as commission_paid
      FROM transactions
      JOIN tenants t ON "tenantId" = t.id
      WHERE status = 'completed'
      GROUP BY t.id, t.name
    `);
    
    res.json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

---

## 💡 KEY METRICS TO TRACK

### Your Platform (What You Make)
```
Monthly Commission:      Total platformFee for completed transactions
Commission Per Booking:  Avg platformFee
Growth Rate:            % increase month-over-month
```

### Per Tenant (What They Make)
```
Gross Revenue:          Total amount customers paid
Commissions Paid:       Total platformFee deducted
Net Revenue:            Gross - Commissions
Booking Count:          Total completed bookings
Average Booking Value:  Net Revenue / Booking Count
```

### Employee Performance (Hours & Pay)
```
Hours Worked:           Sum of appointment durations
Utilization Rate:       Hours Worked / Hours Scheduled
Commission Earned:      Total from employeeCommission column
Average Transaction:    Commission / Booking Count
```

---

## 🎯 COMMON QUESTIONS ANSWERED

### Q: How much is Salon A making?
**Run Query #2** and find their row

### Q: How much commission am I taking?
**Run Query #1** to see total, or **Query #6** for monthly breakdown

### Q: Which employees are most productive?
**Run Query #8** to see hours worked and bookings

### Q: What's my revenue breakdown by plan?
**Run Query #4** to see commission earnings by package

### Q: How much did I make in January?
**Run Query #1** and filter by month

### Q: What happened in booking #xyz?
**Run Query #5** and look for that specific appointment

---

## 📁 DATABASE TABLES STRUCTURE

**Transactions Table** - Every money movement
- `amount` - Customer paid
- `platformFee` - You keep this (commission)
- `tenantRevenue` - Tenant keeps this
- `status` - 'completed' means money was received

**Appointments Table** - Service bookings
- `price` - Customer paid
- `platformFee` - Your commission
- `tenantRevenue` - Tenant's share
- `employeeCommission` - What you pay staff
- `duration` - Minutes worked

**Tenants Table** - Salon/businesses
- `id` - Unique identifier
- `name` - Business name
- `plan` - Subscription package
- `status` - 'approved', 'pending', 'suspended'

---

**✅ Start with Query #1 to see how much you're making right now!**

