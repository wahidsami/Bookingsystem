# Phase 2 Testing Guide

## Prerequisites

1. **Database Running**: Ensure PostgreSQL is running via Docker
   ```bash
   docker-compose up -d
   ```

2. **Server Running**: Start the backend server
   ```bash
   cd server
   npm start
   ```

## Step 1: Seed the Database

Populate the database with sample data:

```bash
cd server
node seed.js
```

**Expected Output**:
```
🌱 Starting database seeding...

📋 Creating services...
✅ Created 6 services

👥 Creating staff members...
✅ Created 5 staff members

📅 Creating staff schedules...
✅ Created 30 schedule entries

🔗 Linking staff to services...
✅ Staff-Service relationships created

👤 Creating sample customers...
✅ Created 3 customers

📆 Creating sample appointments...
✅ Created 2 appointments

🎉 Database seeding completed successfully!
```

## Step 2: Run E2E Tests

Test the complete booking flow:

```bash
cd server
node test_booking_flow.js
```

**Expected Output**:
```
🧪 RIFAH BOOKING SYSTEM - E2E TESTS
══════════════════════════════════════════════════

📋 Test 1: Get Services
✅ Found 6 services

👥 Test 2: Get Staff Recommendations
✅ Found 5 staff members
   AI Score: 85.5

📅 Test 3: Search Available Time Slots
✅ Found 32 available slots

✨ Test 4: Create Booking
✅ Booking created successfully!

🔍 Test 5: Get Booking Details
✅ Retrieved booking details

📋 Test 6: List All Bookings
✅ Found 1 bookings for customer

❌ Test 7: Cancel Booking
✅ Booking cancelled successfully

🚫 Test 8: Conflict Detection
✅ Conflict detection working correctly

══════════════════════════════════════════════════
📊 TEST RESULTS
✅ Passed: 8/8
❌ Failed: 0/8
📈 Success Rate: 100.0%

🎉 All tests passed! Phase 2 is complete!
```

## Step 3: Test Frontend

1. **Start Frontend**:
   ```bash
   cd client
   npm run dev
   ```

2. **Open Browser**: Navigate to `http://localhost:3000`

3. **Test Booking Flow**:
   - Click "Book Now" button
   - Select a service (e.g., "Haircut & Styling")
   - Choose a staff member (note the "Recommended" badge)
   - Pick a date and time
   - Fill in customer details
   - Confirm booking

4. **Verify**:
   - Check that the booking appears in the database
   - Verify no double-booking is possible
   - Test the AI recommendations (recommended staff should have higher scores)

## Step 4: Manual API Testing

Use these curl commands to test individual endpoints:

### Get Services
```bash
curl http://localhost:5000/api/v1/services
```

### Get Staff
```bash
curl http://localhost:5000/api/v1/staff
```

### Get AI Recommendations
```bash
curl "http://localhost:5000/api/v1/bookings/recommendations?serviceId=<SERVICE_ID>"
```

### Search Availability
```bash
curl -X POST http://localhost:5000/api/v1/bookings/search \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "<SERVICE_ID>",
    "staffId": "<STAFF_ID>",
    "date": "2024-11-26"
  }'
```

### Create Booking
```bash
curl -X POST http://localhost:5000/api/v1/bookings/create \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "<SERVICE_ID>",
    "staffId": "<STAFF_ID>",
    "startTime": "2024-11-26T15:00:00Z",
    "customerName": "John Doe",
    "customerPhone": "+966501234567"
  }'
```

### Cancel Booking
```bash
curl -X PATCH http://localhost:5000/api/v1/bookings/<APPOINTMENT_ID>/cancel
```

## Troubleshooting

### Database Connection Error
```
Error: role "rifah_user" does not exist
```
**Solution**: The database is using the default `postgres` user. This is expected based on our setup.

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution**: Stop the existing server process or change the port in `.env`

### No Available Slots
```
Found 0 available slots
```
**Solution**: 
1. Check that staff schedules are created
2. Verify the date is not in the past
3. Ensure the day is not Sunday (staff work Mon-Sat)

## Success Criteria

Phase 2 is complete when:

- ✅ All 8 E2E tests pass
- ✅ Frontend booking flow works end-to-end
- ✅ AI recommendations show correct scores
- ✅ Conflict detection prevents double-booking
- ✅ Time slots are calculated correctly
- ✅ Customer data is saved properly
- ✅ Bookings can be cancelled

## Next Steps

Once Phase 2 is verified:

1. Review the IMPLEMENTATION_ROADMAP.md
2. Begin Phase 3: Payment Integration
3. Set up Stripe test account
4. Implement dynamic pricing engine

---

**Need Help?**
- Check server logs for errors
- Verify database connection
- Ensure all dependencies are installed
- Review the IMPLEMENTATION_ROADMAP.md for detailed specs
