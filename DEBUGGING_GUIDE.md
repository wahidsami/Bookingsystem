# System Debugging Guide - Booking System

**Purpose:** Complete debugging reference for all system layers  
**Last Updated:** January 21, 2024  
**Audience:** Developers, DevOps, QA

---

## 🔍 DEBUGGING OVERVIEW

### Quick Start Debugging
```bash
# 1. Check database connection
cd server && node check-migrations.js

# 2. Check environment variables
cd server && node -e "console.log({JWT_SECRET: process.env.JWT_SECRET ? '✅' : '❌', NODE_ENV: process.env.NODE_ENV, PORT: process.env.PORT})"

# 3. Check logs in real-time
tail -f server/logs/error.log
tail -f server/logs/audit.log
tail -f server/logs/performance.log

# 4. Check API health
curl http://localhost:5000/

# 5. Check all frontends
curl http://localhost:3000/  # Client
curl http://localhost:3002/  # Admin
curl http://localhost:3003/  # Tenant
curl http://localhost:3004/  # Public
```

---

## 🗂️ LOG FILES REFERENCE

### All Available Logs
```
server/logs/
├── error.log              # Production errors (auto-created)
├── audit.log              # User actions, payments, appointments (JSON)
├── performance.log        # Request timing, slow queries (JSON)
└── (timestamps for rotated logs)
```

### Reading Logs

**Real-time Error Monitoring:**
```bash
tail -f server/logs/error.log
```

**Parse Audit Log (JSON format):**
```bash
# See all login events
grep "USER_LOGIN" server/logs/audit.log

# See payment attempts
grep "PAYMENT_ATTEMPT" server/logs/audit.log

# Pretty print
cat server/logs/audit.log | jq '.'
```

**Parse Performance Log:**
```bash
# See slow requests
grep "SLOW_REQUEST" server/logs/performance.log | jq '.responseTime'

# See all GET requests
grep '"method":"GET"' server/logs/performance.log
```

---

## 🗄️ DATABASE DEBUGGING

### 1. Verify Database Connection
```bash
cd server && node check-migrations.js
```

**Expected Output:**
```
✅ Database connection established successfully.
✅ Database synced successfully.
✅ Default Super Admin created: admin@rifah.sa
```

### 2. Check Database Credentials
```javascript
// server/check-db.js - Create this file to test connection
const db = require('./src/models');

async function checkDB() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ Database authenticated');
        
        // Count tables
        const result = await db.sequelize.query(
            "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'"
        );
        console.log('📊 Tables:', result[0][0].table_count);
        
        // List models
        console.log('📋 Models:', Object.keys(db).filter(k => db[k].tableName));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Database error:', error.message);
        process.exit(1);
    }
}

checkDB();
```

**Run it:**
```bash
cd server && node check-db.js
```

### 3. Check Specific Table Data
```javascript
// server/query-table.js - Query any table
const db = require('./src/models');

async function query() {
    try {
        // Example: Check users
        const users = await db.PlatformUser.findAll({
            limit: 5,
            attributes: ['id', 'email', 'isActive', 'isBanned']
        });
        console.log('Users:', JSON.stringify(users, null, 2));
        
        // Example: Check tenants
        const tenants = await db.Tenant.findAll({
            limit: 5,
            attributes: ['id', 'name', 'slug', 'status']
        });
        console.log('Tenants:', JSON.stringify(tenants, null, 2));
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

query();
```

### 4. Run Raw SQL Queries
```javascript
// server/run-sql.js
const db = require('./src/models');

async function runSQL() {
    try {
        const result = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM appointments WHERE status = 'confirmed'`
        );
        console.log('Confirmed appointments:', result[0][0].count);
        process.exit(0);
    } catch (error) {
        console.error('SQL Error:', error.message);
        process.exit(1);
    }
}

runSQL();
```

---

## 🔐 AUTHENTICATION DEBUGGING

### 1. Check JWT Configuration
```bash
# Verify JWT secrets are set
cd server && node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;
console.log('JWT_SECRET:', secret ? '✅ SET' : '❌ MISSING');
console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? '✅' : '❌');
console.log('JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN || '15m');
console.log('REFRESH_EXPIRES_IN:', process.env.JWT_REFRESH_EXPIRES_IN || '7d');
"
```

### 2. Test JWT Token Generation
```javascript
// server/test-jwt.js
const jwt = require('jsonwebtoken');

const testToken = (type) => {
    const secret = process.env[type === 'access' ? 'JWT_SECRET' : 'JWT_REFRESH_SECRET'];
    const expiresIn = type === 'access' ? '15m' : '7d';
    
    try {
        const token = jwt.sign(
            { userId: 'test-123', userType: 'end_user' },
            secret,
            { expiresIn }
        );
        
        console.log(`\n${type.toUpperCase()} Token Generated:`);
        console.log('Token:', token.substring(0, 50) + '...');
        
        const decoded = jwt.verify(token, secret);
        console.log('✅ Verified successfully');
        console.log('Decoded:', decoded);
        
        return true;
    } catch (error) {
        console.error(`❌ ${type} token error:`, error.message);
        return false;
    }
};

console.log('Testing JWT tokens...');
testToken('access');
testToken('refresh');
```

**Run it:**
```bash
cd server && JWT_SECRET=your-secret node test-jwt.js
```

### 3. Decode Existing Token
```javascript
// Decode a token from headers
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const jwt = require('jsonwebtoken');

try {
    const decoded = jwt.decode(token); // Without verification
    console.log('Token payload:', decoded);
} catch (error) {
    console.error('Invalid token:', error.message);
}
```

---

## 📡 API DEBUGGING

### 1. Health Check
```bash
# Basic health
curl http://localhost:5000/

# Expected: {"message":"Rifah API is running"}
```

### 2. Test Rate Limiting
```bash
# Should work first time
curl http://localhost:5000/api/v1/auth/user/login

# Should be rate limited after 5 attempts in 15 minutes
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/v1/auth/user/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo ""
done
```

**Expected after 5th attempt:**
```json
{"message":"Too many login attempts, please try again later","retryAfter":900}
```

### 3. Test CORS Configuration
```bash
# Check CORS headers
curl -i http://localhost:5000/api/v1/settings/global \
  -H "Origin: http://localhost:3000"

# Look for:
# Access-Control-Allow-Origin: http://localhost:3000
```

### 4. Test Input Validation
```bash
# Invalid email - should fail
curl -X POST http://localhost:5000/api/v1/auth/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"invalid-email",
    "phone":"123",
    "password":"short",
    "firstName":"John",
    "lastName":"Doe"
  }'

# Expected: 400 error with validation details
```

### 5. Complete API Test Flow
```bash
# 1. Register user
REGISTER=$(curl -X POST http://localhost:5000/api/v1/auth/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "phone":"966501234567",
    "password":"Test@1234",
    "firstName":"John",
    "lastName":"Doe"
  }')

echo "Register response: $REGISTER"

# 2. Login
LOGIN=$(curl -X POST http://localhost:5000/api/v1/auth/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"Test@1234"
  }')

echo "Login response: $LOGIN"

# Extract token (requires jq)
# TOKEN=$(echo $LOGIN | jq -r '.tokens.accessToken')
```

---

## 🔍 REQUEST-LEVEL DEBUGGING

### 1. Enable Request Logging (index.js)
```javascript
// Add this before routes in index.js
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});
```

### 2. Inspect Request Payload
```javascript
// In your controller
exports.yourEndpoint = async (req, res) => {
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Query:', req.query);
    console.log('Params:', req.params);
    console.log('User:', req.user);
    
    // ... rest of code
};
```

### 3. Monitor Response Time
```javascript
// Middleware to track slow endpoints
app.use((req, res, next) => {
    const start = performance.now();
    res.on('finish', () => {
        const duration = performance.now() - start;
        if (duration > 500) {
            console.warn(`🐢 SLOW: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`);
        }
    });
    next();
});
```

---

## 📊 PERFORMANCE DEBUGGING

### 1. View Performance Metrics
```javascript
// server/view-metrics.js
const perfMonitor = require('./src/services/performanceMonitor');

console.log('=== Overall Stats ===');
console.log(perfMonitor.getOverallStats());

console.log('\n=== Slowest Endpoints ===');
console.log(perfMonitor.getSlowestEndpoints(5));

console.log('\n=== Highest Error Rates ===');
console.log(perfMonitor.getHighestErrorRates(5));

console.log('\n=== Full Report ===');
console.log(JSON.stringify(perfMonitor.generateReport(), null, 2));
```

**Run it:**
```bash
cd server && node view-metrics.js
```

### 2. Database Query Performance
```javascript
// Enable Sequelize logging
const db = require('./src/models');

// Log every query
db.sequelize.options.logging = (sql, timing) => {
    if (timing > 300) {  // Log queries > 300ms
        console.log(`🐢 SLOW QUERY (${timing}ms):\n${sql}`);
    }
};
```

### 3. Memory Usage Monitoring
```javascript
// Monitor memory
setInterval(() => {
    const mem = process.memoryUsage();
    console.log('Memory:', {
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(mem.external / 1024 / 1024)}MB`
    });
}, 10000);
```

---

## 🔐 SECURITY DEBUGGING

### 1. Check Audit Logs
```bash
# View recent audit events
tail -20 server/logs/audit.log

# Parse to see user logins
grep "USER_LOGIN" server/logs/audit.log | jq '.email, .timestamp' | head -10

# See payment attempts
grep "PAYMENT_ATTEMPT" server/logs/audit.log | jq '.status' | sort | uniq -c
```

### 2. Monitor Failed Authentications
```bash
# Get all auth failures
grep "AUTH_FAILURE" server/logs/audit.log | jq '.email, .reason' | head -20
```

### 3. Check Rate Limit Triggers
```bash
# View all rate limit events
grep "RATE_LIMIT_EXCEEDED" server/logs/audit.log | jq '.ipAddress, .endpoint'
```

### 4. Review Suspicious Activity
```bash
# Alert on suspicious events
grep "SUSPICIOUS_ACTIVITY" server/logs/audit.log | jq '.'
```

---

## 🗄️ CACHE DEBUGGING

### 1. Check Redis Connection
```bash
# If Redis running on localhost:6379
redis-cli ping

# Expected: PONG

# Check memory
redis-cli info memory

# Check keys
redis-cli keys '*'
```

### 2. Monitor Cache Operations
```javascript
// In services before caching
const cacheService = require('../services/cacheService');

// Log cache hits/misses
const originalGet = cacheService.get;
cacheService.get = async function(key) {
    const result = await originalGet.call(this, key);
    console.log(`[CACHE] ${result ? 'HIT' : 'MISS'}: ${key}`);
    return result;
};
```

### 3. Clear Cache for Debugging
```javascript
// server/clear-cache.js
const cacheService = require('./src/services/cacheService');

(async () => {
    await cacheService.clearAll();
    console.log('✅ Cache cleared');
})();
```

---

## 🐛 COMMON ISSUES & FIXES

### Issue: "JWT_SECRET not set"
**Solution:**
```bash
# Check .env file exists and has JWT_SECRET
cat .env | grep JWT_SECRET

# Set it if missing
export JWT_SECRET="your-super-secret-key-min-32-chars-recommended"
```

### Issue: "Database connection refused"
**Solution:**
```bash
# Check PostgreSQL running
psql --version

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Issue: "CORS blocked"
**Solution:**
```bash
# Check Origin header matches
curl -H "Origin: http://localhost:3000" http://localhost:5000/

# Check CORS logs
grep -i cors server/logs/error.log
```

### Issue: "Rate limited too quickly"
**Solution:**
```bash
# Check rate limit config in index.js
# Look for: generalLimiter, authLimiter, etc.

# Temporarily disable for testing
app.use(generalLimiter); // Comment this out temporarily
```

### Issue: "Slow queries"
**Solution:**
```bash
# Enable query logging
db.sequelize.options.logging = console.log;

# Check audit log
grep "SLOW_REQUEST" server/logs/performance.log | jq '.endpoint, .responseTime' | sort -rn | head -20
```

---

## 📋 DEBUG CHECKLIST

When debugging a problem, follow this checklist:

- [ ] **Check Logs First**
  - Error log: `tail -f server/logs/error.log`
  - Audit log: `grep event server/logs/audit.log`
  - Performance log: `grep endpoint server/logs/performance.log`

- [ ] **Verify Environment**
  - `echo $JWT_SECRET`
  - `echo $NODE_ENV`
  - `echo $DATABASE_URL`

- [ ] **Test Database**
  - `node check-migrations.js`
  - Check table counts

- [ ] **Test API Health**
  - `curl http://localhost:5000/`
  - Check CORS headers

- [ ] **Check Authentication**
  - Verify tokens in logs
  - Check JWT secret

- [ ] **Monitor Performance**
  - Check response times in performance.log
  - Look for slow queries

- [ ] **Review Security**
  - Check audit log for suspicious activity
  - Monitor rate limits

---

## 🔧 DEBUGGING TOOLS

### Essential Commands
```bash
# Node debugging
node --inspect server/src/index.js  # Then open chrome://inspect

# Database inspection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM appointments"

# Redis inspection
redis-cli

# Port checking
lsof -i :5000  # What's running on port 5000
netstat -an | grep LISTEN

# Process monitoring
ps aux | grep node
top
```

### Debugging Libraries (Add to package.json)
```json
{
  "devDependencies": {
    "debug": "^4.3.4",
    "pino": "^8.11.0",
    "pino-pretty": "^10.0.1"
  }
}
```

---

## 📞 SUPPORT MATRIX

| Issue | Where to Look | How to Debug |
|-------|---------------|-------------|
| User can't login | `audit.log` + AUTH_FAILURE | Check credentials, rate limits |
| Payment fails | `audit.log` + PAYMENT_ATTEMPT | Check payment service errors |
| Slow API | `performance.log` | Check response times, queries |
| CORS error | Browser console + `error.log` | Verify origin, check config |
| DB connection | `node check-migrations.js` | Verify DATABASE_URL |
| Cache issues | `redis-cli` + code logging | Check Redis connection |
| Race conditions | `audit.log` booking events | Check concurrent bookings |

---

## 🚀 DEBUG MODE STARTUP

Create `server/start-debug.sh`:
```bash
#!/bin/bash

export DEBUG=*
export NODE_ENV=development
export LOG_LEVEL=debug

node --inspect=0.0.0.0:9229 src/index.js
```

**Run it:**
```bash
chmod +x start-debug.sh
./start-debug.sh
```

Then open: `chrome://inspect` in Chrome

---

**Debugging Guide Complete! Pick the section relevant to your issue and start debugging! 🔍**
