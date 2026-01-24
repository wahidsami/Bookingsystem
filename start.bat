@echo off
REM Rifah Platform - Start Script (Windows Batch)
REM Starts all services: Docker, Backend, Frontend

echo 🚀 Starting Rifah Platform...
echo.

REM Check if Docker is running
echo 📦 Checking Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo ✅ Docker is running

REM Start Docker services
echo.
echo 🐳 Starting Docker services (PostgreSQL, Redis)...
docker-compose up -d

REM Wait for database to be ready
echo ⏳ Waiting for database to be ready...
timeout /t 5 /nobreak >nul

REM Check if node_modules exist, install if not
if not exist "server\node_modules" (
    echo.
    echo 📦 Installing server dependencies...
    cd server
    call npm install
    cd ..
)

if not exist "client\node_modules" (
    echo.
    echo 📦 Installing client dependencies...
    cd client
    call npm install
    cd ..
)

REM Start backend in new window
echo.
echo 🔧 Starting backend server...
start "Rifah Backend" cmd /k "cd server && npm run dev"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in new window
echo.
echo 🎨 Starting frontend server...
start "Rifah Frontend" cmd /k "cd client && npm run dev"

echo.
echo ✅ All services started!
echo.
echo 📍 Services:
echo    - Backend:  http://localhost:5000
echo    - Frontend: http://localhost:3000
echo    - Database: localhost:5434
echo.
echo 💡 Close the windows to stop the services
echo.
pause

