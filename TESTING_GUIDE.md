# Testing Guide - Rifah Platform

**Date**: 2025-01-27  
**Status**: Ready for Testing  
**System**: 100% Backend + 100% Frontend Complete

---

## 🎯 Testing Checklist

### Prerequisites

#### 🚀 Quick Start (Recommended)

**One command to start everything:**
```bash
# Install dependencies (first time only)
npm run install:all

# Start everything (Docker + Backend + Frontend)
npm run dev
```

**Or use scripts:**
- **Windows**: `.\start.ps1` or `start.bat`
- **Mac/Linux**: `./start.sh`

See `QUICK_START.md` for details!

---

#### Manual Start (Alternative)

1. **Start Backend Server**:
   ```bash
   cd server
   npm install
   npm start
   ```
   Server should run on `http://localhost:5000`

2. **Start Frontend**:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   Frontend should run on `http://localhost:3000`

3. **Database**:
   ```bash
   docker-compose up -d
   ```
   PostgreSQL should be running

---

## ✅ Test Scenarios

### 1. User Registration

**Steps**:
1. Navigate to `http://localhost:3000/register`
2. Fill in registration form:
   - First Name: Ahmed
   - Last Name: Al-Saud
   - Email: ahmed@example.com
   - Phone: +966501234567
   - Password: Test1234! (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
   - Confirm Password: Test1234!
3. Click "Create Account"

**Expected**:
- ✅ Form validates all fields
- ✅ User is created
- ✅ JWT tokens are stored
- ✅ Redirects to `/dashboard`
- ✅ User data displayed in dashboard

**Test Validation**:
- [ ] Email format validation works
- [ ] Phone format validation works (Saudi format)
- [ ] Password strength validation works
- [ ] Error messages display correctly
- [ ] Success redirect works

---

### 2. User Login

**Steps**:
1. Navigate to `http://localhost:3000/login`
2. Enter credentials:
   - Email: ahmed@example.com
   - Password: Test1234!
3. Click "Sign In"

**Expected**:
- ✅ Login successful
- ✅ JWT tokens stored
- ✅ Redirects to `/dashboard`
- ✅ User data loaded

**Test Validation**:
- [ ] Invalid credentials show error
- [ ] Valid credentials login successfully
- [ ] Token refresh works
- [ ] Auto-redirect if already logged in

---

### 3. Browse Tenants (Salons)

**Steps**:
1. Navigate to `http://localhost:3000/tenants`
2. Browse the list of salons
3. Try searching for a salon
4. Click "Book Now" on a salon

**Expected**:
- ✅ List of active tenants displayed
- ✅ Search functionality works
- ✅ Tenant cards show details
- ✅ "Book Now" redirects to booking page with tenantId

**Test Validation**:
- [ ] All active tenants displayed
- [ ] Search filters correctly
- [ ] Tenant details correct
- [ ] Booking link works

---

### 4. Create Booking (Complete Flow)

**Steps**:
1. Navigate to `/tenants` and click "Book Now" on a salon
2. **If not logged in**: Should redirect to `/login`
3. **After login**: Should redirect to booking page
4. **Step 1**: Select a service
5. **Step 2**: Select a staff member (AI recommendations shown)
6. **Step 3**: Select date and time
7. **Step 4**: Confirm booking (user details auto-filled)

**Expected**:
- ✅ Authentication required
- ✅ All steps work smoothly
- ✅ AI recommendations displayed
- ✅ Time slots loaded correctly
- ✅ Booking created successfully
- ✅ Redirects to dashboard with success message
- ✅ Booking appears in dashboard

**Test Validation**:
- [ ] Authentication check works
- [ ] Services load for selected tenant
- [ ] Staff recommendations load
- [ ] Time slots generate correctly
- [ ] Booking creation succeeds
- [ ] CustomerInsight created
- [ ] Platform user stats updated

---

### 5. View Dashboard

**Steps**:
1. Navigate to `http://localhost:3000/dashboard`
2. View stats cards
3. View booking history
4. Try canceling a booking

**Expected**:
- ✅ Stats display correctly (total bookings, upcoming, total spent)
- ✅ All bookings across all salons displayed
- ✅ Booking cancellation works
- ✅ Data updates after cancellation

**Test Validation**:
- [ ] Stats calculate correctly
- [ ] Cross-tenant bookings shown
- [ ] Booking details correct
- [ ] Cancellation works
- [ ] Stats update after cancellation

---

### 6. Cross-Tenant Booking

**Steps**:
1. Book at Salon A (complete booking)
2. Book at Salon B (complete booking)
3. View dashboard

**Expected**:
- ✅ Both bookings created successfully
- ✅ Both bookings appear in dashboard
- ✅ CustomerInsight created for each tenant
- ✅ Platform user stats updated correctly
- ✅ No duplicate user records

**Test Validation**:
- [ ] Bookings at different salons work
- [ ] All bookings in one dashboard
- [ ] CustomerInsight per tenant
- [ ] Platform stats correct
- [ ] No data duplication

---

### 7. Security Tests

#### Token Management
- [ ] Tokens stored in sessionStorage
- [ ] Token refresh works automatically
- [ ] Logout clears tokens
- [ ] Expired tokens redirect to login

#### Protected Routes
- [ ] Dashboard requires authentication
- [ ] Booking requires authentication
- [ ] Unauthenticated users redirected to login

#### Input Validation
- [ ] Email validation works
- [ ] Phone validation works (Saudi format)
- [ ] Password strength enforced
- [ ] XSS protection (try injecting scripts)

---

### 8. API Endpoints Test

#### Public Endpoints (No Auth)
```bash
# Get all tenants
curl http://localhost:5000/api/v1/tenants

# Get tenant details
curl http://localhost:5000/api/v1/tenants/{tenantId}

# Get tenant services
curl http://localhost:5000/api/v1/tenants/{tenantId}/services

# Get tenant staff
curl http://localhost:5000/api/v1/tenants/{tenantId}/staff
```

#### Protected Endpoints (Require Auth)
```bash
# Get user profile
curl -H "Authorization: Bearer {token}" http://localhost:5000/api/v1/users/profile

# Get bookings
curl -H "Authorization: Bearer {token}" http://localhost:5000/api/v1/bookings

# Create booking
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "uuid",
    "serviceId": "uuid",
    "staffId": "uuid",
    "startTime": "2025-01-27T15:00:00Z"
  }' \
  http://localhost:5000/api/v1/bookings/create
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "No token provided"
**Solution**: Make sure you're logged in. Check sessionStorage for tokens.

### Issue 2: "Tenant not found"
**Solution**: Make sure tenantId is valid. Check database for active tenants.

### Issue 3: "Service not found"
**Solution**: Make sure services are seeded. Run `node seed.js` in server directory.

### Issue 4: "Time slot not available"
**Solution**: Try a different date or time. Check staff schedule.

### Issue 5: CORS errors
**Solution**: Make sure backend CORS is configured. Check `server/src/index.js`.

---

## 📊 Test Results Template

```
Test Date: ___________
Tester: ___________

Registration: [ ] Pass [ ] Fail
Login: [ ] Pass [ ] Fail
Browse Tenants: [ ] Pass [ ] Fail
Create Booking: [ ] Pass [ ] Fail
Dashboard: [ ] Pass [ ] Fail
Cross-Tenant: [ ] Pass [ ] Fail
Security: [ ] Pass [ ] Fail

Issues Found:
1. ________________
2. ________________
3. ________________

Notes:
________________
________________
```

---

## 🎯 Success Criteria

### Functional
- ✅ User can register
- ✅ User can login
- ✅ User can browse tenants
- ✅ User can book at any salon
- ✅ User sees all bookings in dashboard
- ✅ Cross-tenant bookings work

### Security
- ✅ Authentication required for booking
- ✅ Tokens managed securely
- ✅ Input validation works
- ✅ Protected routes work

### Performance
- ✅ Pages load quickly
- ✅ API responses fast
- ✅ No memory leaks
- ✅ Smooth user experience

---

## 🚀 Next Steps After Testing

1. **Fix any bugs found**
2. **Add missing features** (if any)
3. **Performance optimization**
4. **Security hardening**
5. **Production deployment**

---

**Status**: Ready for Testing ✅  
**Confidence**: 🔥🔥🔥🔥🔥 (Very High)

