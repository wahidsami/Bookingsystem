# ⚡ Quick Debugging Cheat Sheet

**Use this for fast problem-solving!**

---

## 🚀 ONE-LINER DIAGNOSTICS

```bash
# Full system health check
cd server && node debug-toolkit.js report

# Check specific systems
cd server && node debug-toolkit.js status     # Environment & process
cd server && node debug-toolkit.js db         # Database connection
cd server && node debug-toolkit.js redis      # Redis connection
cd server && node debug-toolkit.js audit      # Recent audit logs
cd server && node debug-toolkit.js errors     # Recent errors
cd server && node debug-toolkit.js perf       # Performance stats

# Diagnose specific issue
cd server && node debug-toolkit.js diagnose jwt
cd server && node debug-toolkit.js diagnose database
cd server && node debug-toolkit.js diagnose redis
cd server && node debug-toolkit.js diagnose cors
```

---

## 📋 PROBLEM → SOLUTION MATRIX

### 🔴 "Server won't start"
```bash
# 1. Check environment
node -e "console.log(require('dotenv').config())"

# 2. Check JWT secret
echo $JWT_SECRET

# 3. Check database
cd server && node check-migrations.js

# 4. Check port not in use
lsof -i :5000
```

**Quick Fix:**
```bash
export JWT_SECRET="your-secret-key-here"
cd server && npm start
```

---

### 🔴 "Can't connect to database"
```bash
# Check connection string
echo $DATABASE_URL

# Test PostgreSQL
psql $DATABASE_URL -c "SELECT 1"

# Run migration check
cd server && node check-migrations.js
```

**Quick Fix:**
```bash
# Update .env
DATABASE_URL="postgresql://user:password@localhost:5432/booking_db"

# Verify
cd server && node check-migrations.js
```

---

### 🔴 "Authentication failing"
```bash
# Check JWT config
cd server && node debug-toolkit.js diagnose jwt

# Check audit log for failures
cd server && node debug-toolkit.js audit
# Look for: AUTH_FAILURE

# Test token generation
cd server && node test-jwt.js
```

**Quick Fix:**
```bash
# Ensure JWT secrets match in .env
JWT_SECRET="your-32-char-minimum-secret"
JWT_REFRESH_SECRET="same-or-different-secret"
```

---

### 🔴 "API too slow"
```bash
# Check performance metrics
cd server && node debug-toolkit.js perf

# View slow queries in performance log
grep "SLOW_REQUEST" server/logs/performance.log | jq '.responseTime' | sort -rn | head -10

# Check memory
cd server && node debug-toolkit.js status
```

**Quick Fix:**
- Enable caching: `cacheService.getOrSet()`
- Check for N+1 queries in controllers
- Look at slowest endpoints first

---

### 🔴 "CORS errors in browser"
```bash
# Check CORS configuration
curl -i http://localhost:5000/api/v1/settings/global \
  -H "Origin: http://localhost:3000"

# Check configured origins
grep "getCorsOrigins" server/src/index.js

# Test another origin
curl -i http://localhost:5000/ \
  -H "Origin: http://localhost:3002"
```

**Quick Fix:**
```bash
# .env file
CORS_ORIGINS="http://localhost:3000,http://localhost:3002,http://localhost:3003"

# Or update index.js getCorsOrigins() function
```

---

### 🔴 "Rate limiting blocks legitimate requests"
```bash
# Check rate limits
grep "rateLimit" server/src/index.js

# View rate limit hits in audit
grep "RATE_LIMIT_EXCEEDED" server/logs/audit.log | wc -l

# Check specific IP
grep "RATE_LIMIT_EXCEEDED" server/logs/audit.log | grep "192.168.1.100"
```

**Quick Fix:**
```javascript
// In index.js, temporarily adjust limits
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500  // Increase from 100 for testing
});
```

---

### 🔴 "Payment processing failing"
```bash
# Check payment errors in audit
grep "PAYMENT_ATTEMPT" server/logs/audit.log | grep "failed" | jq '.description' | head -5

# Check payment service logs
grep "payment" server/logs/error.log | tail -20
```

**Quick Fix:**
- Check `utils/paymentErrorHandler.js` for error types
- Verify payment test cards in database
- Check payment service mock implementation

---

### 🔴 "Data isolation / tenant data leaking"
```bash
# Check query in tenant isolation middleware
grep "byTenant\|byUser" server/src/middleware/tenantIsolation.js

# Verify controllers use isolation
grep -r "tenantIsolation" server/src/controllers/ | head -5

# Test isolation with different tenant IDs
# Check if queries include tenant_id filter
```

**Quick Fix:**
- Ensure all queries use `byTenant()` or `byUser()`
- Review each controller's data access patterns
- See: PHASE2_AUDIT_FRAMEWORK.md

---

### 🔴 "Audit logging not working"
```bash
# Check if logs directory exists
ls -la server/logs/

# Check audit log file
head server/logs/audit.log

# Check service is imported
grep "auditLogger" server/src/controllers/*.js | wc -l
```

**Quick Fix:**
```bash
# Create logs directory if missing
mkdir -p server/logs

# Add audit logging to controller
const auditLogger = require('../utils/auditLogger');
auditLogger.logUserLogin(userId, email, 'end_user', {ipAddress, userAgent});
```

---

### 🔴 "Redis not working"
```bash
# Check if Redis running
redis-cli ping

# Check connection
cd server && node debug-toolkit.js diagnose redis

# Check REDIS_URL
echo $REDIS_URL

# Manually connect
redis-cli
> ping
> keys *
```

**Quick Fix:**
```bash
# Start Redis
redis-server

# Or check connection string
REDIS_URL="redis://localhost:6379"
```

---

## 🔍 LOG FILE QUICK REFERENCE

```bash
# Real-time error monitoring
tail -f server/logs/error.log

# Recent errors (last 20 lines)
tail -20 server/logs/error.log

# Search for specific error
grep "timeout" server/logs/error.log

# Count error types
grep -o '\[ERROR\]' server/logs/error.log | wc -l

# View audit trail
cat server/logs/audit.log | jq '.'

# Parse specific event
grep "USER_LOGIN" server/logs/audit.log | jq '.email'

# Performance analysis
cat server/logs/performance.log | jq '.responseTime' | sort -n | tail -10

# Pretty print JSON logs
jq '.' server/logs/audit.log | less
```

---

## 📊 USEFUL QUERIES

### Count Users by Status
```bash
grep "USER_LOGIN\|USER_LOGOUT\|AUTH_FAILURE" server/logs/audit.log | jq '.eventType' | sort | uniq -c
```

### Find Slow Endpoints
```bash
grep "SLOW_REQUEST" server/logs/performance.log | jq '.endpoint, .responseTime' | sort -k3 -rn | head -10
```

### Payment Success Rate
```bash
grep "PAYMENT_ATTEMPT" server/logs/audit.log | jq '.status' | sort | uniq -c
```

### Suspicious Activity Timeline
```bash
grep "SUSPICIOUS_ACTIVITY" server/logs/audit.log | jq '.timestamp, .eventType'
```

---

## 🛠️ CUSTOM DEBUG SCRIPTS

### Quick Test Script (server/test-api.sh)
```bash
#!/bin/bash

echo "🔍 Testing API..."

# Health check
echo "1. Health check:"
curl -s http://localhost:5000/ | jq '.'

# Check settings
echo -e "\n2. Global settings:"
curl -s http://localhost:5000/api/v1/settings/global | jq '.data' | head -5

# Check tenants
echo -e "\n3. Tenants:"
curl -s http://localhost:5000/api/v1/tenants | jq '.[0:3]'

echo -e "\n✅ API tests complete"
```

**Run it:**
```bash
chmod +x server/test-api.sh
./server/test-api.sh
```

---

## 🎯 DEBUGGING WORKFLOW

```
1. GET QUICK STATUS
   node debug-toolkit.js report

2. IDENTIFY AREA
   - Is it database? → node debug-toolkit.js diagnose database
   - Is it auth? → node debug-toolkit.js diagnose jwt
   - Is it slow? → node debug-toolkit.js perf
   - Is it error? → tail -f server/logs/error.log

3. READ LOGS
   - Error log: server/logs/error.log
   - Audit log: server/logs/audit.log (JSON, use jq)
   - Performance: server/logs/performance.log

4. SEARCH LOGS
   grep "keyword" server/logs/*.log

5. PARSE JSON LOGS
   jq '.' server/logs/audit.log

6. APPLY FIX
   Update code or configuration

7. VERIFY FIX
   Test endpoint or re-run debug script

8. DOCUMENT ISSUE
   Add to troubleshooting guide
```

---

## 💡 PRO TIPS

**Tip 1: Monitor logs in real-time**
```bash
# In one terminal
tail -f server/logs/error.log

# In another, run your test
# Errors appear in real-time in first terminal
```

**Tip 2: Use jq for JSON analysis**
```bash
# Extract specific fields
cat server/logs/audit.log | jq '.email, .timestamp' | head -20

# Count events
cat server/logs/audit.log | jq '.eventType' | sort | uniq -c

# Filter events
cat server/logs/audit.log | jq 'select(.status == "failed")'
```

**Tip 3: Create aliases**
```bash
alias debug-report="cd server && node debug-toolkit.js report"
alias debug-audit="cd server && node debug-toolkit.js audit"
alias debug-errors="cd server && node debug-toolkit.js errors"
alias debug-perf="cd server && node debug-toolkit.js perf"
```

**Tip 4: Use grep + jq combination**
```bash
# Find all failed payments with details
grep "PAYMENT_ATTEMPT" server/logs/audit.log | jq 'select(.status == "failed")'
```

---

## 📞 STILL STUCK?

1. **Check DEBUGGING_GUIDE.md** - Comprehensive guide
2. **Check PROJECT_STATUS_PHASE3_COMPLETE.md** - System status
3. **Check PHASE3_IMPLEMENTATION_COMPLETE.md** - Integration details
4. **Run full debug toolkit:** `node debug-toolkit.js report`

---

**Remember: Check logs first, then verify environment variables, then test components! 🔍**
