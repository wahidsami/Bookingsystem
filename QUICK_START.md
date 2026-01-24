# Quick Start Guide - Rifah Platform

**One-Command Start**: Start everything with a single command!

---

## 🚀 Quick Start (Recommended)

### Option 1: Using npm (Cross-Platform)

**First time setup:**
```bash
# Install all dependencies
npm run install:all
```

**Start everything:**
```bash
# Start Docker, Backend, and Frontend
npm run dev
```

**Stop everything:**
```bash
# Stop Docker services
npm run stop
```

---

### Option 2: Using Scripts

#### Windows (PowerShell)
```powershell
.\start.ps1
```

#### Windows (Command Prompt)
```cmd
start.bat
```

#### Mac/Linux
```bash
chmod +x start.sh
./start.sh
```

**To stop (Mac/Linux):**
```bash
./stop.sh
```

---

## 📋 What Gets Started

1. **Docker Services** (PostgreSQL + Redis)
   - PostgreSQL on port `5434`
   - Redis on port `6379`

2. **Backend Server**
   - Node.js/Express API
   - Runs on `http://localhost:5000`

3. **Frontend Server**
   - Next.js application
   - Runs on `http://localhost:3000`

---

## 🎯 After Starting

1. **Open your browser**: `http://localhost:3000`
2. **Browse salons**: Click "Browse Salons" or go to `/tenants`
3. **Register/Login**: Create an account or sign in
4. **Book an appointment**: Select a salon and book!

---

## 🐛 Troubleshooting

### Docker not running
- **Windows**: Start Docker Desktop
- **Mac**: Start Docker Desktop
- **Linux**: Start Docker service: `sudo systemctl start docker`

### Port already in use
- Backend (5000): Change port in `server/src/index.js`
- Frontend (3000): Change port in `client/package.json` or use `PORT=3001 npm run dev`
- Database (5434): Change in `docker-compose.yml`

### Database connection error
- Wait a few seconds for database to initialize
- Check Docker containers: `docker ps`
- Check logs: `docker-compose logs postgres`

### Dependencies not installed
```bash
# Install all dependencies
npm run install:all

# Or manually
cd server && npm install
cd ../client && npm install
```

---

## 📊 Service Status

### Check if services are running:

**Docker:**
```bash
docker ps
```

**Backend:**
```bash
curl http://localhost:5000
# Should return: {"message":"Rifah API is running"}
```

**Frontend:**
- Open `http://localhost:3000` in browser

---

## 🔧 Manual Start (If scripts don't work)

### 1. Start Docker
```bash
docker-compose up -d
```

### 2. Start Backend (Terminal 1)
```bash
cd server
npm install  # First time only
npm run dev
```

### 3. Start Frontend (Terminal 2)
```bash
cd client
npm install  # First time only
npm run dev
```

---

## 📝 Seed Database (Optional)

After starting, you can seed the database with sample data:

```bash
cd server
node seed.js
```

This creates:
- Sample services
- Sample staff members
- Sample schedules
- Sample customers (legacy)

---

## 🎉 You're Ready!

Once all services are running:
- ✅ Backend API: `http://localhost:5000`
- ✅ Frontend App: `http://localhost:3000`
- ✅ Database: `localhost:5434`

**Start testing!** See `TESTING_GUIDE.md` for complete testing instructions.

---

## 🛑 Stopping Services

### Using npm:
```bash
npm run stop  # Stops Docker
# Then Ctrl+C in backend/frontend terminals
```

### Using scripts:
- **Windows**: Close the PowerShell/CMD windows
- **Mac/Linux**: Run `./stop.sh`

### Manual:
```bash
# Stop Docker
docker-compose down

# Stop backend/frontend
# Press Ctrl+C in their terminals
```

---

**Happy Testing! 🚀**

