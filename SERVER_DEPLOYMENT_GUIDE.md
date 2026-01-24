# Server Deployment Guide - Booking System

**Purpose:** Complete guide for deploying the Booking System to production servers  
**Last Updated:** January 22, 2026  
**Project Stack:** Node.js + React (4 Apps) + PostgreSQL + Redis

---

## 📊 PROJECT SPECIFICATIONS

### Technology Stack
```
Backend:        Node.js 20 + Express.js
Frontend:       React + TypeScript + Vite (4 applications)
Database:       PostgreSQL 15
Cache:          Redis 7
Authentication: JWT + OAuth2
File Storage:   S3/Cloud Storage
```

### Applications to Deploy
```
1. Main Client App          (port 3000)
2. Admin Dashboard          (port 3002)
3. Tenant Management        (port 3003)
4. Public Booking Page      (port 3004)
5. Backend API              (port 5000)
```

---

## 🖥️ MINIMUM SERVER SPECIFICATIONS

### For Development/Testing
```
CPU:        1-2 vCPU
RAM:        2GB
Storage:    30GB SSD
Bandwidth:  1TB/month
```

### For Production
```
CPU:        2-4 vCPU (auto-scaling recommended)
RAM:        4-8GB (minimum 4GB)
Storage:    50GB SSD
Bandwidth:  Unlimited or 5TB+/month
Uptime:     99.9% SLA
```

### Storage Breakdown
```
Node.js Backend:        ~300MB
React Apps (4x):        ~600MB (built)
PostgreSQL Database:    ~1GB (initial)
Redis Cache:            ~500MB
Application Logs:       ~2GB
Reserve for growth:     ~20GB
─────────────────────────────────
TOTAL RECOMMENDED:      ~50GB SSD
```

---

## 🚀 RECOMMENDED SERVER PROVIDERS

### 1. **DigitalOcean App Platform** ⭐ BEST FOR YOUR STACK

**Pricing**
- Development: $12-25/month
- Production: $25-100/month
- Pay-as-you-go pricing

**Features**
- Auto-scaling for Node.js backend
- Managed PostgreSQL database
- Managed Redis cache
- Automatic SSL/HTTPS
- GitHub CI/CD integration
- Built-in monitoring & logs
- 99.99% uptime SLA
- Easy domain management

**Setup Time:** 30 minutes

**Specs Recommended**
- Backend: Basic ($12/month, 512MB RAM)
- PostgreSQL: $15/month (1GB RAM)
- Redis: $15/month (256MB)
- Total: ~$42/month

**Deployment Steps**
```bash
# 1. Create DigitalOcean account
# 2. Create App Platform project
# 3. Connect GitHub repo
# 4. Create App Spec (see below)
# 5. Deploy on git push
```

**App Spec Example (app.yaml)**
```yaml
name: rifah-booking-system
services:
- name: backend
  github:
    repo: yourusername/BookingSystem
    branch: main
  build_command: cd server && npm install && npm run build
  run_command: cd server && npm start
  http_port: 5000
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.connection_string}
  - key: REDIS_URL
    value: ${redis.connection_string}

- name: client
  github:
    repo: yourusername/BookingSystem
    branch: main
  build_command: cd client && npm install && npm run build
  source_dir: client
  http_port: 3000

- name: admin
  github:
    repo: yourusername/BookingSystem
    branch: main
  build_command: cd admin && npm install && npm run build
  source_dir: admin
  http_port: 3002

- name: tenant
  github:
    repo: yourusername/BookingSystem
    branch: main
  build_command: cd tenant && npm install && npm run build
  source_dir: tenant
  http_port: 3003

- name: public-page
  github:
    repo: yourusername/BookingSystem
    branch: main
  build_command: cd PublicPage && npm install && npm run build
  source_dir: PublicPage
  http_port: 3004

databases:
- name: db
  engine: PG
  version: "15"
  production: true

- name: redis
  engine: REDIS
  version: "7"
```

---

### 2. **Render.com** ⭐ EASIEST & AFFORDABLE

**Pricing**
- Starter: $12/month
- Standard: $26/month per service
- Free tier available (with limitations)

**Features**
- Auto-deploys from GitHub
- Managed PostgreSQL included
- Managed Redis included
- Automatic SSL certificates
- Zero downtime deployments
- Integrated monitoring
- 99.9% uptime

**Setup Time:** 20 minutes

**Best For:** Quick testing, small to medium projects

**Deployment Steps**
```bash
# 1. Push code to GitHub
# 2. Sign up at render.com
# 3. Create new Web Service
# 4. Connect GitHub repository
# 5. Configure build & start commands
# 6. Add environment variables
# 7. Deploy!
```

---

### 3. **Railway.app** ⭐ MODERN & DEVELOPER-FRIENDLY

**Pricing**
- $5 credit/month free tier
- Pay-as-you-go after
- Very transparent pricing

**Features**
- GitHub auto-deployment
- PostgreSQL + Redis bundled
- Environment management
- Real-time logs
- Automatic scaling
- Very developer-friendly UI

**Setup Time:** 15 minutes

**Best For:** Startups, rapid prototyping

---

### 4. **AWS EC2 + RDS** 💪 PRODUCTION POWERHOUSE

**Pricing**
- t3.medium: $35-50/month
- RDS PostgreSQL: $30-50/month
- ElastiCache Redis: $20-40/month
- Data transfer: ~$20/month
- **Total: $100-200+/month**

**Features**
- Maximum scalability
- Enterprise-grade reliability
- Advanced security options
- Global CDN (CloudFront)
- Multi-region deployment
- 99.99% uptime SLA

**Setup Time:** 2-4 hours (requires DevOps knowledge)

**Recommended Specs**
- Instance: t3.medium (2 vCPU, 4GB RAM)
- OS: Ubuntu 22.04 LTS
- Database: db.t3.micro → db.t3.small
- Redis: cache.t3.micro

**Architecture**
```
EC2 (Node.js + All React Apps)
↓
RDS PostgreSQL
↓
ElastiCache Redis
↓
S3 (File Storage)
↓
CloudFront (CDN)
```

---

### 5. **Linode** 💪 COST-EFFECTIVE ALTERNATIVE

**Pricing**
- Nanode (1GB): $6/month
- Linode 4GB: $24/month
- Linode 8GB: $48/month

**Features**
- Simple, predictable pricing
- Managed PostgreSQL available
- Good API
- 99.99% uptime SLA
- Good documentation

**Setup Time:** 1-2 hours

**Recommended Specs**
- Instance: Linode 4GB ($24/month)
- PostgreSQL: $30/month
- Total: ~$54/month

---

### 6. **Heroku** (Legacy but still viable)

**Pricing**
- Discontinued free tier
- Pro: $50+/month

**Status:** Not recommended for new projects (expensive)

---

## 🎯 QUICK COMPARISON TABLE

| Provider | Setup Time | Price/Month | Best For | DevOps Needed |
|----------|-----------|------------|----------|--------------|
| DigitalOcean | 30 min | $40-80 | Small-Medium Production | Minimal |
| Render.com | 20 min | $12-50 | Testing/MVP | None |
| Railway.app | 15 min | $10-40 | Prototyping | None |
| AWS EC2 | 2-4 hrs | $100-200 | Enterprise | High |
| Linode | 1-2 hrs | $30-60 | Full Control | Medium |
| Heroku | 15 min | $100+ | Legacy Apps | None |

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Environment Configuration
```
✅ DATABASE_URL configured
   Example: postgresql://user:pass@host:5432/db_name

✅ JWT_SECRET set (strong, 32+ chars)
   Example: openssl rand -base64 32

✅ JWT_REFRESH_SECRET configured

✅ NODE_ENV=production

✅ REDIS_URL if using Redis
   Example: redis://user:pass@host:6379

✅ S3 credentials (if using file upload)
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY
   - AWS_S3_BUCKET
   - AWS_REGION

✅ Email service credentials (SendGrid, Mailgun, etc.)
   - SENDGRID_API_KEY or similar

✅ Payment gateway credentials (if applicable)
   - STRIPE_SECRET_KEY or similar

✅ CORS origins configured
   - Frontend URLs
   - Public page URL
```

### Build & Tests
```
✅ npm run build (backend)
✅ npm run build (each frontend)
✅ npm test (run test suite)
✅ npm run lint (check for errors)
✅ Database migrations tested
✅ Seed script tested
```

### Security
```
✅ SSL/HTTPS enabled
✅ CORS properly configured
✅ Rate limiting enabled
✅ Input validation in place
✅ Authentication working
✅ Sensitive data not in logs
```

---

## 🔧 DEPLOYMENT CONFIGURATIONS

### DigitalOcean App Platform Configuration

**Environment Variables to Set**
```
NODE_ENV                    = production
PORT                        = 5000
DATABASE_URL                = ${db.connection_string}
REDIS_URL                   = ${redis.connection_string}
JWT_SECRET                  = [generate with: openssl rand -base64 32]
JWT_REFRESH_SECRET          = [generate with: openssl rand -base64 32]
LOG_LEVEL                   = info
ENVIRONMENT                 = production
REACT_APP_API_URL           = https://api.youromain.com
```

**Build Commands**
```bash
# Backend
cd server && npm install && npm run build

# Frontends
cd client && npm install && npm run build
cd admin && npm install && npm run build
cd tenant && npm install && npm run build
cd PublicPage && npm install && npm run build
```

**Start Commands**
```bash
# Backend
cd server && npm start

# Frontends (served as static files or node server)
# Usually: npx serve -s build -l 3000
```

---

### AWS EC2 Setup Script

**Initial Server Setup (Ubuntu 22.04)**
```bash
#!/bin/bash

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL client
sudo apt install -y postgresql-client

# Install Redis client
sudo apt install -y redis-tools

# Install Nginx (for reverse proxy)
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git

# Create application directory
sudo mkdir -p /var/www/booking-system
sudo chown $USER:$USER /var/www/booking-system

echo "✅ Server setup complete!"
```

**Clone & Deploy**
```bash
cd /var/www/booking-system
git clone https://github.com/yourusername/BookingSystem.git .

# Install dependencies
cd server && npm install
npm run build

# Setup PM2
pm2 start "npm start" --name "booking-backend"
pm2 save
pm2 startup
```

**Nginx Configuration**
```nginx
upstream backend {
    server localhost:5000;
}

server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # API Backend
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files
    location / {
        root /var/www/booking-system/client/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 🚀 STEP-BY-STEP DEPLOYMENT GUIDE

### Option A: Deploy to Render.com (Easiest)

**Step 1: Prepare Code**
```bash
# Ensure main branch is clean
git status
git add .
git commit -m "Deploy to production"
git push origin main
```

**Step 2: Create Render Account**
- Visit render.com
- Sign up with GitHub account
- Authorize repository access

**Step 3: Deploy Backend**
- Dashboard → New → Web Service
- Connect your repository
- Configure:
  - Name: `booking-backend`
  - Runtime: Node
  - Build Command: `cd server && npm install && npm run build`
  - Start Command: `cd server && npm start`
  - Plan: Standard ($26/month)

**Step 4: Add Environment Variables**
```
NODE_ENV          = production
DATABASE_URL      = (from PostgreSQL service)
REDIS_URL         = (from Redis service)
JWT_SECRET        = (generate: openssl rand -base64 32)
JWT_REFRESH_SECRET= (generate: openssl rand -base64 32)
```

**Step 5: Create PostgreSQL Database**
- Dashboard → New → PostgreSQL
- Name: `booking-db`
- Plan: Standard

**Step 6: Create Redis Cache**
- Dashboard → New → Redis
- Name: `booking-redis`
- Plan: Standard

**Step 7: Link Services**
- Update DATABASE_URL in backend service
- Update REDIS_URL in backend service
- Deploy!

**Step 8: Deploy Frontends**
- Repeat for each React app (client, admin, tenant, public)
- Set Build Command: `cd client && npm install && npm run build`
- Set Start Command: `npm run preview` or `npx serve -s dist`

---

### Option B: Deploy to DigitalOcean (Recommended for Production)

**Step 1: Create DigitalOcean Account**
- Sign up at digitalocean.com
- Add billing information

**Step 2: Create App Platform Project**
- Dashboards → App Platform
- Create → Select GitHub Repository
- Select your BookingSystem repo

**Step 3: Configure App Spec**
- Create `app.yaml` file in root:
```yaml
name: rifah-booking-system

services:
- name: backend
  github:
    repo: username/BookingSystem
    branch: main
  build_command: cd server && npm install && npm run build
  run_command: cd server && npm start
  http_port: 5000
  environment_slug: node-js
  source_dir: server

databases:
- name: db
  engine: PG
  version: "15"
  production: true

- name: redis
  engine: REDIS
  version: "7"
```

**Step 4: Deploy**
- Commit and push app.yaml
- DigitalOcean automatically detects and deploys

---

## 📊 MONITORING & MAINTENANCE

### Set Up Monitoring
```
✅ Application Logs
   - Check daily for errors
   - Alert on critical errors

✅ Database Backups
   - Automated daily backups
   - Test restore procedure weekly

✅ Performance Metrics
   - Monitor API response times
   - Alert if > 1000ms

✅ Uptime Monitoring
   - Use uptime robot or similar
   - Alert on downtime

✅ Security Monitoring
   - Review audit logs weekly
   - Monitor for suspicious activity
```

### Maintenance Schedule
```
Daily:
  - Check error logs
  - Monitor performance

Weekly:
  - Review security logs
  - Test database backup

Monthly:
  - Update dependencies (npm update)
  - Review performance metrics
  - Plan capacity upgrades

Quarterly:
  - Security audit
  - Disaster recovery drill
```

---

## 🔐 SECURITY CHECKLIST FOR PRODUCTION

```
✅ SSL/HTTPS Enabled
   - Auto-renewing certificates
   - HSTS headers set

✅ Environment Variables Secured
   - No sensitive data in code
   - Using secret management

✅ Database Security
   - Strong passwords
   - Encrypted connections
   - Regular backups

✅ API Security
   - Rate limiting enabled
   - Input validation
   - CORS properly configured

✅ Authentication
   - JWT tokens with short expiry
   - Refresh token rotation
   - Secure cookie flags

✅ Logging
   - No passwords/tokens in logs
   - Audit trail enabled
   - Log retention policy

✅ Infrastructure
   - Firewall configured
   - DDoS protection
   - Regular updates
```

---

## 💰 COST COMPARISON

### Estimated Monthly Costs

**Option 1: DigitalOcean App Platform**
```
Backend Service:    $12/month
PostgreSQL:         $15/month
Redis:              $15/month
─────────────────────────────
TOTAL:              $42/month
(+ React apps: $0 if static)
```

**Option 2: Render.com**
```
Backend Service:    $26/month
PostgreSQL:         Included ($7 estimate)
Redis:              Included ($7 estimate)
─────────────────────────────
TOTAL:              $40/month
```

**Option 3: Railway.app**
```
All services:       $15-30/month
(Usage-based pricing)
```

**Option 4: AWS EC2**
```
EC2 t3.medium:      $40/month
RDS PostgreSQL:     $35/month
ElastiCache Redis:  $25/month
Data transfer:      $10/month
────────────────────────────
TOTAL:              $110/month
```

**Option 5: Linode**
```
4GB Server:         $24/month
PostgreSQL:         $30/month
────────────────────────────
TOTAL:              $54/month
```

---

## 🆘 TROUBLESHOOTING COMMON ISSUES

### Issue: Build Fails
```
❌ Error: Command failed
✅ Solution:
   1. Check build command
   2. Verify all dependencies installed
   3. Check Node.js version compatibility
   4. Review build logs
```

### Issue: Database Connection Error
```
❌ Error: ECONNREFUSED 127.0.0.1:5432
✅ Solution:
   1. Verify DATABASE_URL is correct
   2. Check database service is running
   3. Verify credentials
   4. Check network security
```

### Issue: Out of Memory
```
❌ Error: JavaScript heap out of memory
✅ Solution:
   1. Increase server RAM
   2. Enable memory monitoring
   3. Check for memory leaks
   4. Optimize queries
```

### Issue: High CPU Usage
```
❌ Error: CPU consistently > 80%
✅ Solution:
   1. Enable auto-scaling
   2. Optimize slow endpoints
   3. Add caching
   4. Monitor query performance
```

---

## 📚 RECOMMENDED READING

- [Node.js Best Practices](https://nodejs.org/en/docs/guides/nodejs-performance-best-practices/)
- [PostgreSQL Production Setup](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis in Production](https://redis.io/topics/admin)
- [SSL/TLS Configuration](https://mozilla.github.io/server-side-tls/ssl-config-generator/)

---

## 🎯 FINAL RECOMMENDATION

**For Testing/MVP:** Railway.app or Render.com ($15-40/month)
- Easiest to set up
- No DevOps required
- Perfect for validating idea

**For Small Production:** DigitalOcean App Platform ($40-80/month)
- Great balance of price & features
- Managed everything
- Easy to scale

**For Large Production:** AWS or Linode ($50-200+/month)
- Maximum flexibility
- Enterprise-grade reliability
- Advanced configurations possible

---

**Deployment Guide Complete! Ready to go live? 🚀**
