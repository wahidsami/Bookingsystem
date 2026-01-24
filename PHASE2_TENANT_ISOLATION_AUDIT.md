# Cross-Tenant Data Isolation - Audit & Implementation Guide

## Overview
This guide ensures that all queries properly filter by tenant/user to prevent cross-tenant data leakage.

## Critical Rules

### 1. **User Queries** - Must include `platformUserId`
```javascript
// ❌ WRONG - Gets data from ALL users
const bookings = await db.Appointment.findAll();

// ✅ CORRECT - Gets only this user's data
const bookings = await db.Appointment.findAll({
    where: { platformUserId: req.userId }
});
```

### 2. **Tenant Queries** - Must include `tenantId`
```javascript
// ❌ WRONG - Gets services from ALL tenants
const services = await db.Service.findAll();

// ✅ CORRECT - Gets only this tenant's services
const services = await db.Service.findAll({
    where: { tenantId: req.tenantId }
});
```

### 3. **Staff Queries** - Must include BOTH `tenantId` AND verify ownership
```javascript
// ❌ WRONG - Can see other tenant's staff
const staff = await db.Staff.findByPk(staffId);

// ✅ CORRECT - Verify staff belongs to tenant
const staff = await db.Staff.findByPk(staffId);
if (staff.tenantId !== req.tenantId) {
    throw new Error('Unauthorized');
}

// OR use the isolation helper:
const staff = await db.Staff.findByPk(staffId, {
    where: ensureTenantIsolation.byStaff(staffId, req.tenantId)
});
```

### 4. **Appointment Queries** - Must include BOTH checks
```javascript
// ❌ WRONG - Can see other user's appointments
const appointment = await db.Appointment.findByPk(appointmentId);

// ✅ CORRECT - Verify user ownership
const appointment = await db.Appointment.findByPk(appointmentId, {
    where: {
        platformUserId: req.userId,
        tenantId: req.tenantId
    }
});
```

## Files That Need Audit

### Controllers That Handle Tenant Data:
- [ ] `tenantServiceController.js` - Service CRUD operations
- [ ] `tenantEmployeeController.js` - Staff management
- [ ] `tenantProductController.js` - Product management
- [ ] `tenantAppointmentController.js` - Appointment management
- [ ] `tenantSettingsController.js` - Tenant settings
- [ ] `tenantOrderController.js` - Order management
- [ ] `tenantScheduleController.js` - Schedule management

### Controllers That Handle User Data:
- [ ] `userController.js` - User profile and bookings
- [ ] `bookingController.js` - Booking management
- [ ] `paymentController.js` - Payment processing

### Controllers That Handle Cross-User Data:
- [ ] `customerInsightController.js` - Analytics
- [ ] `dashboardController.js` - Dashboard data

## Audit Checklist

### For Each Controller Method:

1. **Identify Data Scope**
   - Is this data user-specific? → Must filter by `platformUserId`
   - Is this data tenant-specific? → Must filter by `tenantId`
   - Is this cross-tenant? → Must verify authorization

2. **Check ALL queries**
   - `findAll()` - Must have where clause
   - `findByPk()` - Must verify ownership after fetch
   - `findOne()` - Must filter by tenant/user in where clause
   - `count()` - Must filter by tenant/user
   - `update()` - Must verify ownership first
   - `destroy()` - Must verify ownership first

3. **Verify Authorization**
   ```javascript
   // After fetching, verify it belongs to the requester
   if (resource.tenantId !== req.tenantId) {
       throw new Error('Unauthorized');
   }
   ```

## Common Vulnerabilities to Check

### Vulnerability #1: Missing Tenant Filter
```javascript
// ❌ VULNERABLE
router.get('/services', (req, res) => {
    db.Service.findAll(); // Returns ALL services from ALL tenants!
});

// ✅ FIXED
router.get('/services', (req, res) => {
    db.Service.findAll({
        where: { tenantId: req.tenantId }
    });
});
```

### Vulnerability #2: Trusting User-Provided ID
```javascript
// ❌ VULNERABLE
router.get('/service/:id', (req, res) => {
    db.Service.findByPk(req.params.id); // User might request other tenant's service
});

// ✅ FIXED
router.get('/service/:id', (req, res) => {
    const service = db.Service.findByPk(req.params.id);
    if (service.tenantId !== req.tenantId) {
        throw new Error('Unauthorized');
    }
    return service;
});
```

### Vulnerability #3: Admin Endpoints Without Tenant Filter
```javascript
// ❌ VULNERABLE
router.patch('/appointments/:id/status', (req, res) => {
    db.Appointment.update(
        { status: req.body.status },
        { where: { id: req.params.id } }
    );
});

// ✅ FIXED
router.patch('/appointments/:id/status', (req, res) => {
    db.Appointment.update(
        { status: req.body.status },
        { 
            where: { 
                id: req.params.id,
                tenantId: req.tenantId // Add tenant filter
            }
        }
    );
});
```

### Vulnerability #4: Missing User Ownership Check
```javascript
// ❌ VULNERABLE
router.get('/appointments/:id', authenticateUser, (req, res) => {
    const appointment = db.Appointment.findByPk(req.params.id);
    return appointment; // User can fetch other user's appointments!
});

// ✅ FIXED
router.get('/appointments/:id', authenticateUser, (req, res) => {
    const appointment = db.Appointment.findByPk(req.params.id);
    if (appointment.platformUserId !== req.userId) {
        throw new Error('Unauthorized');
    }
    return appointment;
});
```

## Implementation Pattern

### Step 1: Import Isolation Helper
```javascript
const { ensureTenantIsolation } = require('../middleware/tenantIsolation');
```

### Step 2: Add Where Clause
```javascript
// Simple tenant filter
const services = await db.Service.findAll({
    where: ensureTenantIsolation.byTenant(req.tenantId)
});

// With additional filters
const staff = await db.Staff.findAll({
    where: {
        ...ensureTenantIsolation.byTenant(req.tenantId),
        status: 'active'
    }
});
```

### Step 3: Verify Ownership for Specific Records
```javascript
const staff = await db.Staff.findByPk(staffId);
if (!staff || staff.tenantId !== req.tenantId) {
    throw new Error('Unauthorized');
}
```

## Testing Cross-Tenant Isolation

### Unit Test Template
```javascript
describe('Cross-Tenant Isolation', () => {
    it('should not return data from other tenants', async () => {
        // Create 2 tenants
        const tenant1 = await db.Tenant.create({ name: 'Tenant 1' });
        const tenant2 = await db.Tenant.create({ name: 'Tenant 2' });

        // Create service in tenant1
        const service1 = await db.Service.create({
            name: 'Service 1',
            tenantId: tenant1.id
        });

        // Try to fetch as tenant2
        const req = { tenantId: tenant2.id };
        const services = await serviceController.getServices(req);

        // Should be empty for tenant2
        expect(services).toHaveLength(0);
    });
});
```

## Priority Areas

### CRITICAL - Audit First
1. `tenantServiceController.js` - Line 118, 158, 306, 441, 519, 580, 647
2. `tenantEmployeeController.js` - All employee queries
3. `bookingController.js` - Appointment creation and fetching
4. `paymentController.js` - Payment method access

### HIGH - Audit Second
5. `tenantProductController.js`
6. `tenantOrderController.js`
7. `userController.js` - Booking history queries

### MEDIUM - Audit Third
8. `tenantSettingsController.js`
9. `tenantScheduleController.js`
10. Analytics/Dashboard controllers

## Checklist Items (from grep results)

```
✅ Apply byTenant() to all service queries
✅ Apply byTenant() to all staff queries
✅ Apply byUser() to all user booking queries
✅ Apply byAppointment() with user verification
✅ Apply verifyTenantOwnership middleware to protected routes
✅ Add tenantId filter to all update operations
✅ Add tenantId filter to all delete operations
✅ Test cross-tenant data access attempts
✅ Document all data scoping patterns
✅ Code review all controllers for missing filters
```

## Questions to Ask When Auditing

1. **Is this endpoint public or protected?**
   - Protected → Must filter by user/tenant
   - Public → Document what data is exposed

2. **Whose data is this?**
   - User's bookings → Filter by `platformUserId`
   - Tenant's services → Filter by `tenantId`
   - Both → Filter by both

3. **Can the user modify the data?**
   - Yes → Must verify ownership before update/delete
   - No → Read-only, filter on fetch

4. **Is this data cached?**
   - Yes → Must include user/tenant in cache key
   - No → Standard filtering applies

## References

- Sequelize Scopes: https://sequelize.org/docs/v6/other-topics/scopes/
- Data Isolation Patterns: See `/middleware/tenantIsolation.js`
- Rate Limiting: `/middleware/rateLimiter.js`
- Request Validation: `/middleware/validateInput.js`
