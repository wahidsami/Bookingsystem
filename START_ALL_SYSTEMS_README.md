# 🚀 Complete System Startup Guide

## Quick Start

Simply run from the project root:

```powershell
.\start-all-systems.ps1
```

This will:
1. ✅ Check prerequisites (Node.js, npm, Docker)
2. ✅ Start Docker containers (PostgreSQL, Redis)
3. ✅ Install dependencies (if missing)
4. ✅ Check port availability
5. ✅ Start all services in separate windows

## Services Started

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Backend API | 5000 | http://localhost:5000 | Node.js/Express backend |
| Client App | 3000 | http://localhost:3000 | Next.js client application |
| Admin Dashboard | 3002 | http://localhost:3002 | Admin management dashboard |
| Tenant Dashboard | 3003 | http://localhost:3003 | Tenant management dashboard |
| Public Page | 3004 | http://localhost:3004 | Public booking page |

## Command Line Options

### Skip Docker Check
If Docker is already running or not needed:
```powershell
.\start-all-systems.ps1 -SkipDocker
```

### Skip Dependency Installation
If dependencies are already installed:
```powershell
.\start-all-systems.ps1 -SkipDeps
```

### Run Health Check
Verify all services are responding:
```powershell
.\start-all-systems.ps1 -HealthCheck
```

### Combine Options
```powershell
.\start-all-systems.ps1 -SkipDeps -HealthCheck
```

## What Happens

1. **Prerequisites Check**
   - Verifies Node.js and npm are installed
   - Checks if Docker is running (unless `-SkipDocker` is used)

2. **Docker Containers**
   - Starts PostgreSQL (port 5434)
   - Starts Redis (port 6379)
   - Waits for containers to be ready

3. **Dependencies**
   - Checks each service directory for `node_modules`
   - Installs missing dependencies automatically
   - Skips if already installed (unless `-SkipDeps` is used)

4. **Port Check**
   - Verifies ports 5000, 3000, 3002, 3003, 3004 are available
   - Warns if ports are in use (services may already be running)

5. **Service Startup**
   - Each service starts in its own PowerShell window
   - Windows are titled with service name and port
   - Services run in development mode (`npm run dev`)

6. **Health Check** (optional)
   - Tests each service endpoint after startup
   - Verifies services are responding correctly

## Stopping Services

### Individual Services
- Close the PowerShell window for that service
- Or press `Ctrl+C` in the service window

### All Services
- Close all PowerShell windows
- Or use the stop script: `.\stop-all.ps1` (if available)

### Docker Containers
```powershell
docker-compose down
```

## Troubleshooting

### "Docker is not running"
- Start Docker Desktop
- Wait for it to fully start
- Run the script again

### "Port already in use"
- A service may already be running
- Check if you have duplicate services
- Kill the process using the port:
  ```powershell
  .\kill-port.ps1 5000  # Replace with actual port
  ```

### "Failed to install dependencies"
- Check your internet connection
- Verify npm is working: `npm --version`
- Try installing manually:
  ```powershell
  cd server
  npm install
  ```

### "Service directory not found"
- Verify you're running from the project root
- Check that all service directories exist:
  - `server/`
  - `client/`
  - `admin/`
  - `tenant/`
  - `PublicPage/`

### Services not responding
- Wait a few seconds for services to start
- Check the service window for errors
- Verify Docker containers are running:
  ```powershell
  docker ps
  ```

## Alternative: Using npm Scripts

You can also use the root `package.json` scripts:

```powershell
# Install all dependencies
npm run install:all

# Start all services (uses concurrently)
npm run dev

# Start Docker only
npm run dev:docker

# Start individual services
npm run dev:server
npm run dev:client
npm run dev:admin
npm run dev:tenant
npm run dev:public
```

## Notes

- Each service runs in a **separate window** for easy monitoring
- Services run in **development mode** (hot reload enabled)
- The script is **idempotent** - safe to run multiple times
- Dependencies are only installed if `node_modules` is missing
- Docker containers are only started if not already running

## Support

If you encounter issues:
1. Check the individual service windows for error messages
2. Verify all prerequisites are installed
3. Check Docker Desktop is running
4. Review the troubleshooting section above

---

**Happy Coding! 🎉**




