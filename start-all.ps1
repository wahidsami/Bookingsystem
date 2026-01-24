# Rifah Platform - Start All Services Script (PowerShell)
# Starts all services: Backend, Client, Admin, Tenant, PublicPage
# Assumes Docker is already running

Write-Host ""
Write-Host "🚀 Starting Rifah Platform - All Services" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "📦 Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    Write-Host "   Then run this script again." -ForegroundColor Yellow
    exit 1
}

# Check Docker containers are up
Write-Host ""
Write-Host "🐳 Checking Docker containers..." -ForegroundColor Yellow
$postgresRunning = docker ps --filter "name=rifah_postgres" --format "{{.Names}}" | Select-String "rifah_postgres"
$redisRunning = docker ps --filter "name=rifah_redis" --format "{{.Names}}" | Select-String "rifah_redis"

if (-not $postgresRunning -or -not $redisRunning) {
    Write-Host "⚠️  Docker containers not running. Starting them..." -ForegroundColor Yellow
    docker-compose up -d
    Write-Host "⏳ Waiting for containers to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
} else {
    Write-Host "✅ Docker containers are running" -ForegroundColor Green
}

# Function to check and install dependencies
function Install-Dependencies {
    param(
        [string]$Path,
        [string]$Name
    )
    
    if (-not (Test-Path "$Path/node_modules")) {
        Write-Host ""
        Write-Host "📦 Installing $Name dependencies..." -ForegroundColor Yellow
        Set-Location $Path
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to install $Name dependencies" -ForegroundColor Red
            Set-Location ..
            return $false
        }
        Set-Location ..
        Write-Host "✅ $Name dependencies installed" -ForegroundColor Green
    }
    return $true
}

# Check and install dependencies
Write-Host ""
Write-Host "📦 Checking dependencies..." -ForegroundColor Yellow

$depsOk = $true
$depsOk = $depsOk -and (Install-Dependencies -Path "server" -Name "Backend")
$depsOk = $depsOk -and (Install-Dependencies -Path "client" -Name "Client")
$depsOk = $depsOk -and (Install-Dependencies -Path "admin" -Name "Admin")
$depsOk = $depsOk -and (Install-Dependencies -Path "tenant" -Name "Tenant")
$depsOk = $depsOk -and (Install-Dependencies -Path "PublicPage" -Name "PublicPage")

if (-not $depsOk) {
    Write-Host ""
    Write-Host "❌ Failed to install some dependencies. Please check the errors above." -ForegroundColor Red
    exit 1
}

Write-Host "✅ All dependencies are ready" -ForegroundColor Green

# Function to start a service in a new window
function Start-Service {
    param(
        [string]$Path,
        [string]$Name,
        [string]$Port,
        [string]$Color = "Cyan"
    )
    
    Write-Host ""
    Write-Host "🚀 Starting $Name..." -ForegroundColor $Color
    $fullPath = (Resolve-Path $Path).Path
    # Build command with proper escaping - escape quotes for PowerShell
    $title = "🚀 $Name Server (Port $Port)"
    $command = "cd '$fullPath'; Write-Host '$title' -ForegroundColor $Color; Write-Host '================================' -ForegroundColor $Color; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $command -WindowStyle Normal
    Start-Sleep -Seconds 2
}

# Start all services
Write-Host ""
Write-Host "🎯 Starting all services..." -ForegroundColor Cyan
Write-Host ""

# Start Backend
Start-Service -Path "server" -Name "Backend API" -Port "5000" -Color "Green"

# Start Client App
Start-Service -Path "client" -Name "Client App" -Port "3000" -Color "Blue"

# Start Admin Dashboard
Start-Service -Path "admin" -Name "Admin Dashboard" -Port "3002" -Color "Magenta"

# Start Tenant Dashboard
Start-Service -Path "tenant" -Name "Tenant Dashboard" -Port "3003" -Color "Yellow"

# Start PublicPage
Start-Service -Path "PublicPage" -Name "PublicPage" -Port "3004" -Color "Cyan"

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ All services started successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Service URLs:" -ForegroundColor Cyan
Write-Host "   🔧 Backend API:      http://localhost:5000" -ForegroundColor White
Write-Host "   👤 Client App:       http://localhost:3000" -ForegroundColor White
Write-Host "   🎛️  Admin Dashboard:  http://localhost:3002" -ForegroundColor White
Write-Host "   🏢 Tenant Dashboard: http://localhost:3003" -ForegroundColor White
Write-Host "   🌐 PublicPage:       http://localhost:3004" -ForegroundColor White
Write-Host ""
Write-Host "🗄️  Database:" -ForegroundColor Cyan
Write-Host "   PostgreSQL:         localhost:5434" -ForegroundColor White
Write-Host "   Redis:              localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "   - Each service runs in a separate PowerShell window" -ForegroundColor Gray
Write-Host "   - Close the window to stop that service" -ForegroundColor Gray
Write-Host "   - Or press Ctrl+C in each window to stop" -ForegroundColor Gray
Write-Host "   - Use 'docker-compose down' to stop Docker containers" -ForegroundColor Gray
Write-Host ""
Write-Host "🎉 Happy coding!" -ForegroundColor Green
Write-Host ""

