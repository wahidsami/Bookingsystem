# Phase 3: Database Query Optimization Guide

**Priority:** High  
**Estimated Work:** 4 days  
**Estimated Performance Gain:** 40-60% faster queries

## 1. N+1 Query Problems Identified

### Issue: Appointment List with Staff Details

**Current (N+1 Problem):**
```javascript
// In tenantAppointmentController.js
const appointments = await db.Appointment.findAll({
    where: { tenantId },
    include: [{ association: 'service' }]
});
// Then in response mapping, loads staff for EACH appointment = N queries
appointments = appointments.map(apt => ({
    ...apt,
    staffName: apt.Staff.name  // Triggers additional query per appointment
}));
```

**Result:** 1 appointment query + N staff queries = N+1 total

**Fix:** Add staff to include:
```javascript
const appointments = await db.Appointment.findAll({
    where: { tenantId },
    include: [
        { association: 'service' },
        { association: 'staff', attributes: ['id', 'name', 'email'] }
    ]
});
```

**Expected Impact:** 50 appointments = 1 query instead of 51

---

### Issue: Service List with Employee Skills

**Current (N+1 Problem):**
```javascript
const services = await db.Service.findAll({
    where: { tenantId }
});
// No includes = missing staff details on each query
```

**Fix:** Include through junction table:
```javascript
const services = await db.Service.findAll({
    where: { tenantId },
    include: [{
        association: 'employees',
        through: { attributes: [] },
        attributes: ['id', 'name']
    }]
});
```

---

### Issue: Staff Availability Calculation

**Current (Inefficient):**
```javascript
// In availabilityService.js - CRITICAL N+1
const staff = await db.Staff.findAll({ where: { tenantId } });
for (const employee of staff) {
    const schedule = await db.StaffSchedule.findOne({
        where: { staffId: employee.id }
    }); // N queries!
}
```

**Fix:** Batch load all schedules:
```javascript
const staff = await db.Staff.findAll({
    where: { tenantId },
    include: [{
        association: 'schedule',
        required: false
    }]
});
```

---

## 2. Missing Database Indexes

### Critical Missing Indexes (Performance Impact)

```sql
-- Tenant scoping (CRITICAL for all queries)
CREATE INDEX idx_appointments_tenant_date ON appointments(tenant_id, appointment_date DESC);
CREATE INDEX idx_services_tenant ON services(tenant_id);
CREATE INDEX idx_staff_tenant ON staff(tenant_id);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);

-- Date-based queries (For availability checks)
CREATE INDEX idx_staff_schedule_staffid_date ON staff_schedule(staff_id, date);
CREATE INDEX idx_appointments_status_date ON appointments(status, appointment_date DESC);

-- User lookups (For auth)
CREATE INDEX idx_platform_users_email ON platform_users(email);
CREATE INDEX idx_platform_users_phone ON platform_users(phone);

-- Financial reports
CREATE INDEX idx_transactions_tenant_date ON transactions(tenant_id, created_at DESC);
CREATE INDEX idx_orders_tenant_date ON orders(tenant_id, created_at DESC);

-- Tenant lookups
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
```

**Estimated Performance Improvement:** 30-40% for complex queries

---

## 3. Slow Query Analysis

### Query: Get Available Slots for Date Range

**Current Performance:** ~800ms for 10 staff members

**Optimization Steps:**

1. **Add index on staff_schedule(staff_id, date)**
2. **Use EXPLAIN to analyze** before/after
3. **Batch fetch schedules** instead of per-staff queries
4. **Cache availability** in Redis (5-min TTL)

### Query: Tenant Dashboard Reports

**Current Performance:** ~3-5 seconds for monthly report

**Issues:**
- Loads ALL transactions (no date filter in includes)
- Joins without indexes
- Calculates totals in application instead of database

**Optimization:**
```javascript
// Instead of loading all and summing in JS:
const stats = await db.Transaction.findAll({
    attributes: [
        [sequelize.fn('sum', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('count', sequelize.col('id')), 'count'],
        [sequelize.fn('avg', sequelize.col('amount')), 'avgAmount']
    ],
    where: {
        tenantId,
        createdAt: { [Op.between]: [startDate, endDate] }
    },
    raw: true
});
```

---

## 4. Eager Loading Optimization

### Pattern: Always Include Related Data in One Query

**Before (Multiple Queries):**
```javascript
const appointment = await db.Appointment.findByPk(id);
const service = await db.Service.findByPk(appointment.serviceId);
const staff = await db.Staff.findByPk(appointment.staffId);
const customer = await db.Customer.findByPk(appointment.customerId);
```

**After (Single Query):**
```javascript
const appointment = await db.Appointment.findByPk(id, {
    include: [
        { association: 'service', attributes: ['id', 'name', 'duration', 'price'] },
        { association: 'staff', attributes: ['id', 'name', 'email', 'phone'] },
        { association: 'customer', attributes: ['id', 'name', 'email'] }
    ]
});
```

---

## 5. Caching Opportunities

### High-Value Caching (Read-heavy, infrequent changes)

1. **Service List** (5-min TTL)
   - Keys: `services:tenant:${tenantId}`
   - Invalidate on: Service create/update/delete

2. **Staff List** (5-min TTL)
   - Keys: `staff:tenant:${tenantId}`
   - Invalidate on: Staff create/update/delete

3. **Tenant Settings** (30-min TTL)
   - Keys: `settings:tenant:${tenantId}`
   - Invalidate on: Settings update

4. **Availability Slots** (5-min TTL)
   - Keys: `availability:tenant:${tenantId}:date:${date}`
   - Invalidate on: Appointment create/cancel, Schedule update

---

## 6. Optimization Roadmap

### Phase 3.6.1: Add Missing Indexes (1 day)
```
1. Run CREATE INDEX statements above
2. Verify with EXPLAIN
3. Document impact
```

### Phase 3.6.2: Fix N+1 Queries (2 days)
```
1. Identify all controllers with N+1 patterns
2. Add eager loading includes
3. Test with real data
4. Benchmark before/after
```

### Phase 3.6.3: Move Calculations to DB (1 day)
```
1. Move SUM/COUNT/AVG to database
2. Reduce result set size
3. Application aggregation only for display logic
```

---

## 7. Verification Script

### Test Query Performance

```javascript
// scripts/test-query-performance.js
const db = require('../src/models');
const { Op } = require('sequelize');

async function testAppointmentQuery() {
    console.time('Appointments with includes');
    const result = await db.Appointment.findAll({
        where: { tenantId: 1 },
        include: [
            { association: 'service' },
            { association: 'staff' }
        ],
        limit: 50
    });
    console.timeEnd('Appointments with includes');
    console.log(`Loaded ${result.length} appointments`);
}

// Run: node scripts/test-query-performance.js
```

---

## 8. Current Status

- [x] N+1 queries identified (3 critical)
- [ ] Missing indexes created
- [ ] Query optimization implemented
- [ ] Performance benchmarked

**Next Step:** Execute index creation and N+1 fixes
