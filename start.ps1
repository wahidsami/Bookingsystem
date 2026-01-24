# Rifah Platform - Start Script (PowerShell)
# Starts all services: Docker, Backend, Frontend

Write-Host "🚀 Starting Rifah Platform..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "📦 Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Start Docker services
Write-Host ""
Write-Host "🐳 Starting Docker services (PostgreSQL, Redis)..." -ForegroundColor Yellow
docker-compose up -d

# Wait for database to be ready
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if node_modules exist, install if not
if (-not (Test-Path "server/node_modules")) {
    Write-Host ""
    Write-Host "📦 Installing server dependencies..." -ForegroundColor Yellow
    Set-Location server
    npm install
    Set-Location ..
}

if (-not (Test-Path "client/node_modules")) {
    Write-Host ""
    Write-Host "📦 Installing client dependencies..." -ForegroundColor Yellow
    Set-Location client
    npm install
    Set-Location ..
}

# Start backend
Write-Host ""
Write-Host "🔧 Starting backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; npm run dev" -WindowStyle Normal

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host ""
Write-Host "🎨 Starting frontend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Services:" -ForegroundColor Cyan
Write-Host "   - Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "   - Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "   - Database: localhost:5434" -ForegroundColor White
Write-Host ""
Write-Host "💡 Press Ctrl+C in each window to stop the services" -ForegroundColor Yellow
Write-Host ""

