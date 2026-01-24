# 🚀 Booking System Rebuild - Implementation Plan

**Mission:** Transform Rifah booking system into a SERVICE-FIRST, salon-grade booking engine  
**Philosophy:** Service-First Model (like Fresha, Mindbody, Treatwell)  
**Status:** Ready for Battle ⚔️

---

## 📋 Core Philosophy: Service-First Booking

### What This Means

1. **Customer journey starts with SERVICE, not staff**
   - Customer selects service first (Haircut, Massage, etc.)
   - Service defines: duration, buffers, pricing, availability rules
   - Staff selection is **secondary and optional**

2. **After service selection:**
   - System shows eligible staff who can perform this service
   - System may recommend staff automatically (rating, workload, history)
   - Customer can choose specific staff OR "Any available staff"

3. **Availability is calculated per SERVICE, not per staff calendar alone**
   - Same staff offering different services = different slot grids
   - Slot generation respects: service duration, buffers, staff schedule, business hours, breaks, time-off, existing appointments

4. **Slot selection is final step before confirmation**
   - Time slots are **dynamically generated** (never hardcoded or stored)
   - Slot availability **re-validated at booking time** to prevent conflicts

5. **"Any Staff" behavior:**
   - System searches availability across all eligible staff
   - Auto-assigns best available staff based on: availability, workload balance, rating, customer history
   - Assignment locks specific staff member at booking creation

6. **Same booking engine everywhere:**
   - Public booking
   - Authenticated user booking
   - Tenant-created booking from dashboard
   - All use same availability engine, conflict rules, booking pipeline

---

## ✅ Phase 1 — Unify Booking Engine (Critical Fix)

### Problem Statement

**Current State:**
- Two separate booking systems exist:
  - `/api/v1/bookings/create` (uses PlatformUser, has conflict checks)
  - `/api/v1/public/tenant/:tenantId/bookings` (uses Customer model, no conflict checks)
- This creates: duplicate people, conflicting appointments, inconsistent data

**Required Solution:**
- All bookings go through ONE service layer
- One validation pipeline + one conflict checker + one appointment creator

### Tasks

#### ✅ Phase 1.1: Create Unified BookingService Module
**File:** `server/src/services/bookingService.js` (enhance existing)

**Responsibilities:**
- [ ] Validation (service exists, staff exists, user exists, dates valid)
- [ ] Availability computation (call availability engine)
- [ ] Conflict detection (check overlaps with existing appointments)
- [ ] Appointment creation (with proper status, pricing breakdown)
- [ ] Pricing breakdown (rawPrice, tax, commission, employee commission)
- [ ] CustomerInsight update
- [ ] Subscription usage tracking

**Methods to implement:**
```javascript
class BookingService {
  // Core booking creation
  async createBooking(data) {
    // 1. Validate inputs
    // 2. Check availability (call availability engine)
    // 3. Check conflicts (transaction-safe)
    // 4. Create appointment
    // 5. Update related records
    // 6. Return appointment
  }
  
  // Availability check (delegates to AvailabilityService)
  async checkAvailability(tenantId, serviceId, staffId, date, time) {
    // Call availability engine
  }
  
  // Conflict detection
  async hasConflict(staffId, startTime, endTime, excludeAppointmentId = null) {
    // Check for overlapping appointments
  }
  
  // Pricing calculation
  calculatePricing(service, staff) {
    // Return: rawPrice, taxAmount, platformFee, tenantRevenue, employeeCommission
  }
}
```

#### ✅ Phase 1.2: Refactor Authenticated Booking Endpoint
**File:** `server/src/controllers/bookingController.js`

**Changes:**
- [ ] Remove inline booking logic
- [ ] Call `bookingService.createBooking()` instead
- [ ] Keep authentication middleware
- [ ] Keep response formatting

**Before:**
```javascript
const createBooking = async (req, res) => {
  // 50+ lines of inline logic
}
```

**After:**
```javascript
const createBooking = async (req, res) => {
  try {
    const appointment = await bookingService.createBooking({
      serviceId: req.body.serviceId,
      staffId: req.body.staffId,
      platformUserId: req.userId,
      tenantId: req.body.tenantId,
      startTime: req.body.startTime
    });
    
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      appointment
    });
  } catch (error) {
    // Error handling
  }
};
```

#### ✅ Phase 1.3: Refactor Public Booking Endpoint
**File:** `server/src/controllers/publicTenantController.js`

**Changes:**
- [ ] Remove inline booking logic
- [ ] Call `bookingService.createBooking()` instead
- [ ] Map customer info to PlatformUser (see Phase 4)
- [ ] Remove legacy Customer model usage

**Key change:**
```javascript
// OLD: Creates Customer record
const customer = await db.Customer.create({...});

// NEW: Find or create PlatformUser
const platformUser = await findOrCreatePlatformUser({
  email: customerEmail,
  phone: customerPhone,
  firstName: customerName.split(' ')[0],
  lastName: customerName.split(' ').slice(1).join(' ')
});

// Then use unified booking service
const appointment = await bookingService.createBooking({
  serviceId,
  staffId,
  platformUserId: platformUser.id,
  tenantId,
  startTime: new Date(`${date}T${time}`)
});
```

#### ✅ Phase 1.4: Deprecate Legacy Customer Model
**Files:** Multiple

**Tasks:**
- [ ] Remove `customerId` from Appointment creation in public endpoint
- [ ] Keep `customerId` field in Appointment model for backward compatibility (nullable)
- [ ] Add migration note: "customerId is legacy, use platformUserId"
- [ ] Update all queries to prefer `platformUserId` over `customerId`

---

## ✅ Phase 2 — Build Real Availability Engine

### Problem Statement

**Current State:**
- 15-min interval hardcoded
- No buffers
- Doesn't validate tenant hours
- Doesn't support breaks/lunch
- No date overrides
- Schedule table too weak

**Required Solution:**
- Service-driven slot generation
- Configurable step size
- Respects all constraints (business hours, schedules, breaks, time-off, appointments)

### Tasks

#### ✅ Phase 2.1: Replace Hardcoded Slot Generation
**File:** `server/src/services/availabilityService.js` (NEW)

**Create new service:**
```javascript
class AvailabilityService {
  async getAvailableSlots(tenantId, serviceId, staffId, date) {
    // 1. Get service (duration, buffers)
    // 2. Get tenant business hours
    // 3. Get staff schedule for date
    // 4. Get breaks for date
    // 5. Get time-off for date
    // 6. Get existing appointments
    // 7. Calculate availability window
    // 8. Generate slots based on service duration + buffers
    // 9. Filter out conflicts
    // 10. Return slots
  }
  
  _calculateAvailabilityWindow(tenantHours, staffSchedule, breaks, timeOff) {
    // Intersect all constraints
  }
  
  _generateSlots(startTime, endTime, serviceDuration, bufferBefore, bufferAfter, stepSize) {
    // Generate slots with proper spacing
  }
  
  _filterConflicts(slots, existingAppointments, serviceDuration, buffers) {
    // Remove conflicting slots
  }
}
```

**Slot calculation:**
```javascript
// Slot length = service duration + buffers
const slotLength = service.duration + (service.bufferBefore || 0) + (service.bufferAfter || 0);

// Step size from tenant settings (default: 15 min)
const stepSize = tenantSettings.booking?.slotInterval || 15;

// Generate slots
let current = startOfDay;
while (current + slotLength <= endOfDay) {
  const slotStart = current;
  const slotEnd = current + slotLength;
  
  // Check if slot conflicts with existing appointments
  if (!hasConflict(slotStart, slotEnd, existingAppointments)) {
    slots.push({ startTime: slotStart, endTime: slotEnd, available: true });
  }
  
  current += stepSize * 60000; // Move by step size
}
```

#### ✅ Phase 2.2: Add Configurable Step Size
**File:** `server/src/models/TenantSettings.js` or extend Tenant model

**Add to tenant settings:**
```javascript
bookingSettings: {
  slotInterval: 15, // 5, 10, or 15 minutes
  defaultBufferBefore: 5, // minutes
  defaultBufferAfter: 5, // minutes
  allowAnyStaff: true,
  maxBookingsPerCustomerPerDay: null, // null = unlimited
  // Future: cancellationWindow, noShowPolicy
}
```

**Update availability service to read:**
```javascript
const tenantSettings = await getTenantSettings(tenantId);
const stepSize = tenantSettings.booking?.slotInterval || 15;
```

#### ✅ Phase 2.3: Implement Availability Window Calculation
**File:** `server/src/services/availabilityService.js`

**Logic:**
```javascript
_calculateAvailabilityWindow(tenantId, staffId, date) {
  // Layer A: Tenant business hours
  const tenantHours = await getTenantBusinessHours(tenantId, date);
  
  // Layer B: Staff weekly schedule
  const staffSchedule = await getStaffSchedule(staffId, date);
  
  // Layer C: Breaks
  const breaks = await getStaffBreaks(staffId, date);
  
  // Layer D: Time-off and overrides
  const timeOff = await getStaffTimeOff(staffId, date);
  const overrides = await getStaffOverrides(staffId, date);
  
  // Intersect: Tenant hours ∩ Staff schedule
  let availableWindow = intersect(tenantHours, staffSchedule);
  
  // Subtract: breaks, time-off
  availableWindow = subtract(availableWindow, breaks);
  availableWindow = subtract(availableWindow, timeOff);
  
  // Apply overrides (can expand or restrict)
  availableWindow = applyOverrides(availableWindow, overrides);
  
  return availableWindow;
}
```

#### ✅ Phase 2.4: Enhance Conflict Check
**File:** `server/src/services/availabilityService.js`

**Current conflict check is basic. Enhance to:**
```javascript
_hasConflict(slotStart, slotEnd, existingAppointments, serviceDuration, buffers) {
  return existingAppointments.some(appt => {
    // Consider buffers
    const apptStartWithBuffer = appt.startTime - (buffers.before || 0) * 60000;
    const apptEndWithBuffer = appt.endTime + (buffers.after || 0) * 60000;
    
    // Check all overlap cases
    return (
      // Slot starts during appointment
      (slotStart >= apptStartWithBuffer && slotStart < apptEndWithBuffer) ||
      // Slot ends during appointment
      (slotEnd > apptStartWithBuffer && slotEnd <= apptEndWithBuffer) ||
      // Slot completely contains appointment
      (slotStart <= apptStartWithBuffer && slotEnd >= apptEndWithBuffer) ||
      // Appointment completely contains slot
      (apptStartWithBuffer <= slotStart && apptEndWithBuffer >= slotEnd)
    );
  });
}
```

#### ✅ Phase 2.5: Update Availability Response Format
**File:** `server/src/controllers/bookingController.js` (searchAvailability)

**Enhanced response:**
```javascript
{
  "success": true,
  "slots": [
    {
      "startTime": "2025-01-27T09:00:00Z",
      "endTime": "2025-01-27T09:45:00Z",
      "available": true,
      "staffId": "uuid", // If "Any staff" was selected
      "staffName": "Sarah Ahmed"
    }
  ],
  "metadata": {
    "date": "2025-01-27",
    "serviceId": "uuid",
    "serviceDuration": 30,
    "bufferBefore": 5,
    "bufferAfter": 10,
    "totalSlotLength": 45,
    "timezone": "Asia/Riyadh",
    "totalSlots": 24,
    "availableSlots": 18,
    "staffCount": 3 // If "Any staff"
  }
}
```

---

## ✅ Phase 3 — Fix Scheduling Model

### Problem Statement

**Current State:**
- StaffSchedule supports only one block per day
- No breaks
- No overrides
- No time off
- No multi-shift days

**Required Solution:**
- 4-layer scheduling system:
  - Layer A: Tenant business hours (global constraint)
  - Layer B: Staff weekly shifts (recurring, multiple per day)
  - Layer C: Breaks (recurring or date-specific)
  - Layer D: Overrides/time-off (date-specific)

### Tasks

#### ✅ Phase 3.1: Extend StaffSchedule Model
**File:** `server/src/models/StaffSchedule.js`

**Current:** One block per day  
**New:** Multiple blocks per day

**Option A: Keep existing, add new fields:**
```javascript
StaffSchedule.init({
  // ... existing fields
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true // null = recurring forever
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true // null = recurring forever
  }
});
```

**Option B: Create new model StaffShift (recommended):**
```javascript
// server/src/models/StaffShift.js
StaffShift.init({
  id: { type: DataTypes.UUID, primaryKey: true },
  staffId: { type: DataTypes.UUID, allowNull: false },
  dayOfWeek: { type: DataTypes.INTEGER }, // 0-6, null = date-specific
  specificDate: { type: DataTypes.DATEONLY, allowNull: true }, // If date-specific
  startTime: { type: DataTypes.TIME, allowNull: false },
  endTime: { type: DataTypes.TIME, allowNull: false },
  isRecurring: { type: DataTypes.BOOLEAN, defaultValue: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});
```

**Recommendation:** Create `StaffShift` model, keep `StaffSchedule` for backward compatibility during migration.

#### ✅ Phase 3.2: Create Break Model
**File:** `server/src/models/StaffBreak.js` (NEW)

```javascript
StaffBreak.init({
  id: { type: DataTypes.UUID, primaryKey: true },
  staffId: { type: DataTypes.UUID, allowNull: false },
  dayOfWeek: { type: DataTypes.INTEGER, allowNull: true }, // null = date-specific
  specificDate: { type: DataTypes.DATEONLY, allowNull: true },
  startTime: { type: DataTypes.TIME, allowNull: false },
  endTime: { type: DataTypes.TIME, allowNull: false },
  type: { type: DataTypes.ENUM('lunch', 'prayer', 'cleaning', 'other'), defaultValue: 'lunch' },
  label: { type: DataTypes.STRING }, // "Lunch Break", "Prayer Time"
  isRecurring: { type: DataTypes.BOOLEAN, defaultValue: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});
```

#### ✅ Phase 3.3: Create TimeOff Model
**File:** `server/src/models/StaffTimeOff.js` (NEW)

```javascript
StaffTimeOff.init({
  id: { type: DataTypes.UUID, primaryKey: true },
  staffId: { type: DataTypes.UUID, allowNull: false },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  type: { type: DataTypes.ENUM('vacation', 'sick', 'personal', 'training', 'other'), defaultValue: 'vacation' },
  reason: { type: DataTypes.TEXT },
  isApproved: { type: DataTypes.BOOLEAN, defaultValue: true }, // For future approval workflow
  createdAt: { type: DataTypes.DATE },
  updatedAt: { type: DataTypes.DATE }
});
```

#### ✅ Phase 3.4: Create ScheduleOverride Model
**File:** `server/src/models/StaffScheduleOverride.js` (NEW)

```javascript
StaffScheduleOverride.init({
  id: { type: DataTypes.UUID, primaryKey: true },
  staffId: { type: DataTypes.UUID, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  type: { type: DataTypes.ENUM('override', 'exception'), defaultValue: 'override' },
  // Override: Replace normal schedule for this date
  // Exception: Add special hours (e.g., Ramadan extended hours)
  startTime: { type: DataTypes.TIME, allowNull: true }, // null = no override
  endTime: { type: DataTypes.TIME, allowNull: true },
  isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true }, // false = day off
  reason: { type: DataTypes.TEXT },
  createdAt: { type: DataTypes.DATE },
  updatedAt: { type: DataTypes.DATE }
});
```

#### ✅ Phase 3.5-3.8: Add CRUD Endpoints
**File:** `server/src/routes/tenantRoutes.js`  
**File:** `server/src/controllers/tenantScheduleController.js` (NEW)

**Endpoints:**
```javascript
// Staff Shifts
GET    /api/v1/tenant/employees/:id/shifts
POST   /api/v1/tenant/employees/:id/shifts
PUT    /api/v1/tenant/employees/:id/shifts/:shiftId
DELETE /api/v1/tenant/employees/:id/shifts/:shiftId

// Breaks
GET    /api/v1/tenant/employees/:id/breaks
POST   /api/v1/tenant/employees/:id/breaks
PUT    /api/v1/tenant/employees/:id/breaks/:breakId
DELETE /api/v1/tenant/employees/:id/breaks/:breakId

// Time Off
GET    /api/v1/tenant/employees/:id/time-off
POST   /api/v1/tenant/employees/:id/time-off
PUT    /api/v1/tenant/employees/:id/time-off/:timeOffId
DELETE /api/v1/tenant/employees/:id/time-off/:timeOffId

// Schedule Overrides
GET    /api/v1/tenant/employees/:id/overrides
POST   /api/v1/tenant/employees/:id/overrides
PUT    /api/v1/tenant/employees/:id/overrides/:overrideId
DELETE /api/v1/tenant/employees/:id/overrides/:overrideId
```

#### ✅ Phase 3.9: Remove/Migrate Staff.workingHours
**File:** `tenant/src/app/[locale]/dashboard/employees/new/page.tsx`  
**File:** `tenant/src/app/[locale]/dashboard/employees/[id]/page.tsx`

**Options:**
1. **Remove completely** (recommended)
   - [ ] Remove `workingHours` field from form
   - [ ] Remove from API submission
   - [ ] Add note: "Use Schedules section to manage working hours"

2. **Migrate to StaffSchedule**
   - [ ] On employee creation, if `workingHours` provided, convert to `StaffSchedule` records
   - [ ] Then remove from form

**Recommendation:** Remove completely, direct users to new Schedules section.

---

## ✅ Phase 4 — Public Booking Flow Must Use Real Engine

### Problem Statement

**Current State:**
- Uses mock staff/services
- Hardcoded time slots
- Submission not integrated
- Public booking endpoint bypasses conflict logic

**Required Solution:**
- Real API calls for services, staff, availability
- Real booking submission
- PlatformUser integration

### Tasks

#### ✅ Phase 4.1: Replace Mock Data in PublicPage
**File:** `PublicPage/src/components/LandingPage.tsx`  
**File:** `PublicPage/src/components/BookingModal.tsx`

**Changes:**
- [ ] Remove `services` and `staff` from `mockData.ts`
- [ ] Call `publicAPI.getServices(tenantId)` for services
- [ ] Call `publicAPI.getStaff(tenantId)` for staff
- [ ] Handle loading states
- [ ] Handle errors

**Before:**
```typescript
import { services, staff } from '../data/mockData';
```

**After:**
```typescript
const { tenantId } = useTenant();
const [services, setServices] = useState<Service[]>([]);
const [staff, setStaff] = useState<Staff[]>([]);

useEffect(() => {
  const loadData = async () => {
    try {
      const [servicesRes, staffRes] = await Promise.all([
        publicAPI.getServices(tenantId, {}),
        publicAPI.getStaff(tenantId)
      ]);
      setServices(servicesRes.services || []);
      setStaff(staffRes.staff || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };
  if (tenantId) loadData();
}, [tenantId]);
```

#### ✅ Phase 4.2: Update BookingModal to Use Real Availability
**File:** `PublicPage/src/components/BookingModal.tsx`

**Changes:**
- [ ] Remove `generateTimeSlots()` hardcoded function
- [ ] Call `/api/v1/bookings/search` when date/staff/service selected
- [ ] Display real slots from API response
- [ ] Handle loading states
- [ ] Handle no availability case

**Implementation:**
```typescript
const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
const [loadingSlots, setLoadingSlots] = useState(false);

const fetchAvailability = async (serviceId: string, staffId: string | null, date: string) => {
  setLoadingSlots(true);
  try {
    const response = await publicAPI.searchAvailability({
      tenantId,
      serviceId,
      staffId: staffId || undefined,
      date
    });
    setAvailableSlots(response.slots || []);
  } catch (error) {
    console.error('Failed to fetch availability:', error);
    setAvailableSlots([]);
  } finally {
    setLoadingSlots(false);
  }
};

// Call when date/service/staff changes
useEffect(() => {
  if (bookingData.serviceId && bookingData.date) {
    fetchAvailability(
      bookingData.serviceId,
      bookingData.staffId || null,
      bookingData.date
    );
  }
}, [bookingData.serviceId, bookingData.staffId, bookingData.date]);
```

#### ✅ Phase 4.3: Update Booking Submission
**File:** `PublicPage/src/components/BookingModal.tsx`

**Changes:**
- [ ] Remove mock submission
- [ ] Call `publicAPI.createBooking()` with real data
- [ ] Handle success/error responses
- [ ] Show booking reference number

**Implementation:**
```typescript
const handleConfirm = async () => {
  try {
    setSubmitting(true);
    const response = await publicAPI.createBooking(tenantId, {
      serviceId: bookingData.serviceId!,
      staffId: bookingData.staffId || undefined,
      date: bookingData.date!,
      time: bookingData.time!,
      serviceType: bookingData.serviceType || 'in-center',
      customerName: bookingData.customerName!,
      customerEmail: bookingData.customerEmail!,
      customerPhone: bookingData.customerPhone!,
      specialRequests: bookingData.specialRequests,
      paymentMethod: bookingData.paymentMethod || 'at-center',
      location: bookingData.location
    });
    
    setBookingReference(response.data.bookingReference);
    setCurrentStep('success');
  } catch (error) {
    console.error('Booking failed:', error);
    setError(error.message || 'Failed to create booking');
  } finally {
    setSubmitting(false);
  }
};
```

#### ✅ Phase 4.4: Implement PlatformUser Lookup/Creation
**File:** `server/src/services/userService.js` (NEW or enhance)

**Create helper:**
```javascript
async findOrCreatePlatformUser({ email, phone, firstName, lastName }) {
  // Try to find by email or phone
  let user = await db.PlatformUser.findOne({
    where: {
      [Op.or]: [
        { email: email?.toLowerCase() },
        { phone: phone }
      ]
    }
  });
  
  if (!user) {
    // Create soft account (no password, can claim later)
    user = await db.PlatformUser.create({
      email: email?.toLowerCase() || null,
      phone: phone,
      firstName: firstName || 'Guest',
      lastName: lastName || 'User',
      emailVerified: false,
      phoneVerified: false,
      isActive: true,
      // No password set - user can claim account later
    });
  } else {
    // Update info if provided
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email && !user.email) user.email = email.toLowerCase();
    if (phone && !user.phone) user.phone = phone;
    await user.save();
  }
  
  return user;
}
```

**Update public booking endpoint:**
```javascript
// In publicTenantController.createPublicBooking
const platformUser = await userService.findOrCreatePlatformUser({
  email: customerEmail,
  phone: customerPhone,
  firstName: customerName.split(' ')[0],
  lastName: customerName.split(' ').slice(1).join(' ')
});

// Then use in booking
const appointment = await bookingService.createBooking({
  serviceId,
  staffId,
  platformUserId: platformUser.id, // Use PlatformUser, not Customer
  tenantId,
  startTime: new Date(`${date}T${time}`)
});
```

#### ✅ Phase 4.5: Add Soft Account Claim Feature
**File:** `server/src/controllers/userAuthController.js`  
**File:** `client/src/app/claim-account/page.tsx` (NEW)

**Flow:**
1. User books without account
2. System creates PlatformUser (no password)
3. System sends email/SMS with claim link
4. User clicks link, sets password
5. Account is fully activated

**Implementation:**
```javascript
// Generate claim token
const claimToken = jwt.sign(
  { userId: user.id, type: 'claim' },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// Send email with claim link
await sendEmail(user.email, {
  subject: 'Claim Your Rifah Account',
  html: `Click here to set your password: ${process.env.CLIENT_URL}/claim-account?token=${claimToken}`
});

// Claim endpoint
POST /api/v1/auth/user/claim-account
{
  "token": "jwt_token",
  "password": "new_password"
}
```

---

## ✅ Phase 5 — Tenant Settings for Booking Behavior

### Problem Statement

Salon/spa businesses vary. Tenant needs control over booking behavior.

### Tasks

#### ✅ Phase 5.1: Extend Tenant Settings API
**File:** `server/src/models/TenantSettings.js` or extend Tenant model

**Add booking settings:**
```javascript
bookingSettings: {
  slotInterval: 15, // 5, 10, or 15 minutes
  defaultBufferBefore: 5, // minutes (can be overridden per service)
  defaultBufferAfter: 5, // minutes
  allowAnyStaff: true, // Allow "Any available staff" option
  maxBookingsPerCustomerPerDay: null, // null = unlimited, or number
  requirePhoneVerification: false, // Future
  allowWalkInBooking: true, // Tenant can create booking from dashboard
  cancellationWindow: 24, // hours before appointment (future)
  noShowPolicy: 'warn', // 'warn', 'penalty', 'ban' (future)
}
```

**Update settings endpoint:**
```javascript
PUT /api/v1/tenant/settings/booking
{
  "slotInterval": 15,
  "defaultBufferBefore": 5,
  "defaultBufferAfter": 10,
  "allowAnyStaff": true,
  "maxBookingsPerCustomerPerDay": 3
}
```

#### ✅ Phase 5.2: Update Availability Search to Read Settings
**File:** `server/src/services/availabilityService.js`

**Read tenant settings:**
```javascript
async getAvailableSlots(tenantId, serviceId, staffId, date) {
  // Get tenant settings
  const tenantSettings = await getTenantSettings(tenantId);
  const bookingSettings = tenantSettings.bookingSettings || {};
  
  // Use settings
  const stepSize = bookingSettings.slotInterval || 15;
  const defaultBufferBefore = bookingSettings.defaultBufferBefore || 0;
  const defaultBufferAfter = bookingSettings.defaultBufferAfter || 0;
  
  // Get service (may have service-specific buffers)
  const service = await db.Service.findByPk(serviceId);
  const bufferBefore = service.bufferBefore || defaultBufferBefore;
  const bufferAfter = service.bufferAfter || defaultBufferAfter;
  
  // ... rest of availability logic
}
```

#### ✅ Phase 5.3: Enforce Booking Policies
**File:** `server/src/services/bookingService.js`

**Add policy checks:**
```javascript
async createBooking(data) {
  // ... validation ...
  
  // Get tenant settings
  const tenantSettings = await getTenantSettings(tenantId);
  const bookingSettings = tenantSettings.bookingSettings || {};
  
  // Check max bookings per day
  if (bookingSettings.maxBookingsPerCustomerPerDay) {
    const todayBookings = await db.Appointment.count({
      where: {
        platformUserId: data.platformUserId,
        tenantId: data.tenantId,
        startTime: {
          [Op.gte]: startOfDay(new Date()),
          [Op.lt]: endOfDay(new Date())
        },
        status: { [Op.notIn]: ['cancelled', 'no_show'] }
      }
    });
    
    if (todayBookings >= bookingSettings.maxBookingsPerCustomerPerDay) {
      throw new Error(`Maximum ${bookingSettings.maxBookingsPerCustomerPerDay} bookings per day allowed`);
    }
  }
  
  // Check "Any staff" policy
  if (!data.staffId && !bookingSettings.allowAnyStaff) {
    throw new Error('Staff selection is required');
  }
  
  // ... rest of booking creation ...
}
```

---

## ✅ Phase 6 — Quality & Safety (Race Conditions)

### Problem Statement

Two users can book the same slot simultaneously without protection.

### Tasks

#### ✅ Phase 6.1: Add Transaction-Level Protection
**File:** `server/src/services/bookingService.js`

**Use database transactions:**
```javascript
async createBooking(data) {
  const transaction = await db.sequelize.transaction();
  
  try {
    // 1. Lock the staff row (pessimistic lock)
    const staff = await db.Staff.findByPk(data.staffId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    
    // 2. Re-check conflicts WITHIN transaction
    const conflicts = await db.Appointment.findAll({
      where: {
        staffId: data.staffId,
        status: { [Op.notIn]: ['cancelled', 'no_show'] },
        [Op.or]: [
          { startTime: { [Op.between]: [startTime, endTime] } },
          { endTime: { [Op.between]: [startTime, endTime] } },
          {
            [Op.and]: [
              { startTime: { [Op.lte]: startTime } },
              { endTime: { [Op.gte]: endTime } }
            ]
          }
        ]
      },
      transaction
    });
    
    if (conflicts.length > 0) {
      await transaction.rollback();
      throw new Error('Time slot no longer available');
    }
    
    // 3. Create appointment
    const appointment = await db.Appointment.create({
      // ... appointment data ...
    }, { transaction });
    
    // 4. Commit
    await transaction.commit();
    return appointment;
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

#### ✅ Phase 6.2: Implement Redis Short Lock
**File:** `server/src/services/bookingService.js`  
**File:** `server/src/middleware/bookingLock.js` (NEW)

**Redis lock implementation:**
```javascript
const redis = require('redis');
const client = redis.createClient();

async function acquireSlotLock(staffId, startTime, duration = 300) {
  const lockKey = `booking:lock:${staffId}:${startTime.getTime()}`;
  const lockValue = Date.now().toString();
  
  // Try to acquire lock (SET NX EX)
  const acquired = await client.set(lockKey, lockValue, {
    NX: true, // Only set if not exists
    EX: duration // Expire in seconds (5 minutes)
  });
  
  return acquired === 'OK';
}

async function releaseSlotLock(staffId, startTime) {
  const lockKey = `booking:lock:${staffId}:${startTime.getTime()}`;
  await client.del(lockKey);
}

// Usage in booking service
async createBooking(data) {
  // Try to acquire lock
  const lockAcquired = await acquireSlotLock(data.staffId, data.startTime);
  if (!lockAcquired) {
    throw new Error('Slot is being booked by another user. Please try again.');
  }
  
  try {
    // Create booking
    const appointment = await this._createAppointment(data);
    return appointment;
  } finally {
    // Release lock
    await releaseSlotLock(data.staffId, data.startTime);
  }
}
```

#### ✅ Phase 6.3: Ensure Database Indexes
**File:** `server/src/models/Appointment.js`

**Verify indexes exist:**
```javascript
indexes: [
  {
    fields: ['staffId', 'startTime', 'endTime'],
    name: 'idx_staff_time'
  },
  {
    fields: ['platformUserId', 'startTime'],
    name: 'idx_platform_user_time'
  },
  {
    fields: ['tenantId', 'startTime'],
    name: 'idx_tenant_time'
  },
  {
    fields: ['status', 'startTime'],
    name: 'idx_status_time'
  }
]
```

**Add composite index for conflict queries:**
```sql
CREATE INDEX idx_staff_status_time ON appointments(staffId, status, startTime, endTime)
WHERE status NOT IN ('cancelled', 'no_show');
```

#### ✅ Phase 6.4: Implement Timezone Handling
**File:** `server/src/services/availabilityService.js`

**Timezone utilities:**
```javascript
const { format, parse, toZonedTime, fromZonedTime } = require('date-fns-tz');

async getAvailableSlots(tenantId, serviceId, staffId, date) {
  // Get tenant timezone (default: Asia/Riyadh)
  const tenant = await db.Tenant.findByPk(tenantId);
  const timezone = tenant.timezone || 'Asia/Riyadh';
  
  // Parse date in tenant timezone
  const dateInTimezone = parse(`${date} 00:00:00`, 'yyyy-MM-dd HH:mm:ss', new Date());
  const zonedDate = toZonedTime(dateInTimezone, timezone);
  
  // Generate slots in tenant timezone
  // ... slot generation ...
  
  // Convert to UTC for storage
  const slotsInUTC = slots.map(slot => ({
    startTime: fromZonedTime(slot.startTime, timezone),
    endTime: fromZonedTime(slot.endTime, timezone),
    available: slot.available
  }));
  
  return slotsInUTC;
}
```

**Add timezone to Tenant model:**
```javascript
timezone: {
  type: DataTypes.STRING,
  defaultValue: 'Asia/Riyadh',
  allowNull: false
}
```

---

## ✅ Phase 7 — Connect Everything

### Tasks

#### ✅ Phase 7.1-7.7: Wire Backend Modules

**File:** `server/src/services/bookingService.js`

Ensure all modules are connected:

- [ ] **Tenants:** Read business hours, check status
  ```javascript
  const tenant = await db.Tenant.findByPk(tenantId);
  if (tenant.status !== 'approved') throw new Error('Tenant not active');
  const businessHours = tenant.workingHours;
  ```

- [ ] **Staff:** Check active status, service assignments
  ```javascript
  const staff = await db.Staff.findByPk(staffId);
  if (!staff.isActive) throw new Error('Staff not active');
  
  // Check if staff can perform service
  const canPerform = await db.ServiceEmployee.findOne({
    where: { serviceId, staffId }
  });
  if (!canPerform) throw new Error('Staff cannot perform this service');
  ```

- [ ] **Services:** Get duration, pricing, buffers
  ```javascript
  const service = await db.Service.findByPk(serviceId);
  const duration = service.duration;
  const buffers = {
    before: service.bufferBefore || tenantSettings.defaultBufferBefore,
    after: service.bufferAfter || tenantSettings.defaultBufferAfter
  };
  ```

- [ ] **Staff Schedules:** Get weekly shifts, breaks, time-off, overrides
  ```javascript
  const shifts = await getStaffShifts(staffId, date);
  const breaks = await getStaffBreaks(staffId, date);
  const timeOff = await getStaffTimeOff(staffId, date);
  const overrides = await getStaffOverrides(staffId, date);
  ```

- [ ] **Appointments:** Conflict checks, status validation
  ```javascript
  const conflicts = await db.Appointment.findAll({
    where: { /* conflict query */ }
  });
  ```

- [ ] **CustomerInsight:** Update after booking
  ```javascript
  await this._updateCustomerInsight(platformUserId, tenantId, serviceId, staffId, amount, startTime);
  ```

- [ ] **Subscription:** Track usage
  ```javascript
  await updateUsage(tenantId, 'booking', true);
  ```

#### ✅ Phase 7.8-7.11: Build Tenant Dashboard UI

**Files:**
- `tenant/src/app/[locale]/dashboard/schedules/page.tsx` (NEW)
- `tenant/src/app/[locale]/dashboard/schedules/[employeeId]/page.tsx` (NEW)

**Features:**
- [ ] **Schedule Management UI:**
  - Weekly calendar view
  - Add/edit/delete shifts
  - Support multiple shifts per day
  - Recurring vs date-specific

- [ ] **Breaks Management UI:**
  - List breaks
  - Add/edit/delete breaks
  - Recurring vs date-specific
  - Break types (lunch, prayer, etc.)

- [ ] **Time Off Management UI:**
  - Calendar view with time-off highlighted
  - Add time-off request
  - Approve/reject (future)
  - View time-off history

- [ ] **Schedule Overrides UI:**
  - Date-specific overrides
  - Special hours (Ramadan, holidays)
  - Day-off marking

#### ✅ Phase 7.12: Verify Client App Integration

**File:** `client/src/app/bookings/page.tsx`

**Verify:**
- [ ] All bookings use `platformUserId` (not `customerId`)
- [ ] Cross-tenant bookings display correctly
- [ ] Booking details show correct information
- [ ] Cancellation works with unified engine

---

## 📦 Deliverables Checklist

### Backend

- [ ] ✅ Unified `BookingService` module
- [ ] ✅ `AvailabilityService` with service-driven slot generation
- [ ] ✅ Enhanced scheduling models (StaffShift, StaffBreak, StaffTimeOff, StaffScheduleOverride)
- [ ] ✅ CRUD endpoints for schedule management
- [ ] ✅ Tenant booking settings API
- [ ] ✅ Transaction-safe booking creation
- [ ] ✅ Redis lock implementation
- [ ] ✅ Timezone handling
- [ ] ✅ PlatformUser lookup/creation for public bookings

### Frontend

- [ ] ✅ PublicPage uses real API (no mocks)
- [ ] ✅ BookingModal uses real availability endpoint
- [ ] ✅ Tenant Dashboard schedule management UI
- [ ] ✅ Tenant Dashboard breaks management UI
- [ ] ✅ Tenant Dashboard time-off management UI
- [ ] ✅ Tenant Dashboard schedule overrides UI
- [ ] ✅ Client App verified for PlatformUser-based bookings

### Testing

- [ ] ✅ Unit tests for BookingService
- [ ] ✅ Unit tests for AvailabilityService
- [ ] ✅ Integration tests for booking flow
- [ ] ✅ Race condition tests
- [ ] ✅ E2E tests for public booking
- [ ] ✅ E2E tests for authenticated booking

### Documentation

- [ ] ✅ API documentation updated
- [ ] ✅ Migration guide for Staff.workingHours
- [ ] ✅ Tenant guide for schedule management
- [ ] ✅ Developer guide for booking engine

---

## 🎯 Success Criteria

1. ✅ **Single booking engine** used by all booking flows
2. ✅ **Service-first availability** calculation
3. ✅ **4-layer scheduling** system (business hours, shifts, breaks, overrides)
4. ✅ **No mock data** in public booking
5. ✅ **Transaction-safe** booking creation
6. ✅ **Configurable** booking behavior per tenant
7. ✅ **PlatformUser-based** bookings (no legacy Customer)
8. ✅ **Real-time availability** with proper conflict detection

---

**Status:** Ready to begin implementation  
**Next Step:** Start with Phase 1.1 - Create Unified BookingService Module

Let's go, Captain! ⚔️🚀

