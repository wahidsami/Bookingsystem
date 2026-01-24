# ============================================================================
# Rifah Platform - Complete System Startup Script
# Starts ALL systems: Docker, Backend, and ALL Frontend Applications
# ============================================================================

param(
    [switch]$SkipDocker,
    [switch]$SkipDeps,
    [switch]$HealthCheck
)

$ErrorActionPreference = "Stop"

# Colors
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=" * 70 -ForegroundColor Cyan
    Write-ColorOutput "  $Title" "Cyan"
    Write-Host "=" * 70 -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success { param([string]$Msg) Write-ColorOutput "✅ $Msg" "Green" }
function Write-Error { param([string]$Msg) Write-ColorOutput "❌ $Msg" "Red" }
function Write-Warning { param([string]$Msg) Write-ColorOutput "⚠️  $Msg" "Yellow" }
function Write-Info { param([string]$Msg) Write-ColorOutput "ℹ️  $Msg" "Cyan" }

# Banner
Clear-Host
Write-Host ""
Write-ColorOutput "╔══════════════════════════════════════════════════════════════════╗" "Cyan"
Write-ColorOutput "║                                                                  ║" "Cyan"
Write-ColorOutput "║          🚀 RIFAH PLATFORM - COMPLETE SYSTEM STARTUP 🚀         ║" "Cyan"
Write-ColorOutput "║                                                                  ║" "Cyan"
Write-ColorOutput "╚══════════════════════════════════════════════════════════════════╝" "Cyan"
Write-Host ""

# ============================================================================
# STEP 1: Check Prerequisites
# ============================================================================
Write-Section "STEP 1: Checking Prerequisites"

# Check Node.js
Write-Info "Checking Node.js..."
try {
    $nodeVersion = node --version
    Write-Success "Node.js found: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed or not in PATH"
    Write-Info "Please install Node.js from https://nodejs.org/"
    exit 1
}

# Check npm
Write-Info "Checking npm..."
try {
    $npmVersion = npm --version
    Write-Success "npm found: $npmVersion"
} catch {
    Write-Error "npm is not installed or not in PATH"
    exit 1
}

# Check Docker (if not skipped)
if (-not $SkipDocker) {
    Write-Info "Checking Docker..."
    try {
        docker ps | Out-Null
        Write-Success "Docker is running"
    } catch {
        Write-Error "Docker is not running"
        Write-Warning "Please start Docker Desktop and run this script again"
        Write-Info "Or use -SkipDocker flag if Docker is not needed"
        exit 1
    }
} else {
    Write-Warning "Skipping Docker check (using -SkipDocker flag)"
}

# ============================================================================
# STEP 2: Start Docker Containers
# ============================================================================
if (-not $SkipDocker) {
    Write-Section "STEP 2: Starting Docker Containers"
    
    $postgresRunning = docker ps --filter "name=rifah_postgres" --format "{{.Names}}" | Select-String "rifah_postgres"
    $redisRunning = docker ps --filter "name=rifah_redis" --format "{{.Names}}" | Select-String "rifah_redis"
    
    if ($postgresRunning -and $redisRunning) {
        Write-Success "Docker containers are already running"
    } else {
        Write-Info "Starting Docker containers..."
        docker-compose up -d
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start Docker containers"
            exit 1
        }
        
        Write-Info "Waiting for containers to be ready..."
        Start-Sleep -Seconds 5
        
        # Verify containers are running
        $postgresRunning = docker ps --filter "name=rifah_postgres" --format "{{.Names}}" | Select-String "rifah_postgres"
        $redisRunning = docker ps --filter "name=rifah_redis" --format "{{.Names}}" | Select-String "rifah_redis"
        
        if ($postgresRunning -and $redisRunning) {
            Write-Success "Docker containers started successfully"
        } else {
            Write-Error "Docker containers failed to start"
            exit 1
        }
    }
} else {
    Write-Section "STEP 2: Skipping Docker (using -SkipDocker flag)"
}

# ============================================================================
# STEP 3: Install Dependencies
# ============================================================================
if (-not $SkipDeps) {
    Write-Section "STEP 3: Checking Dependencies"
    
    function Install-Dependencies {
        param(
            [string]$Path,
            [string]$Name
        )
        
        if (-not (Test-Path $Path)) {
            Write-Warning "$Name directory not found: $Path"
            return $false
        }
        
        if (-not (Test-Path "$Path/node_modules")) {
            Write-Info "Installing $Name dependencies..."
            Push-Location $Path
            try {
                npm install
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Failed to install $Name dependencies"
                    return $false
                }
                Write-Success "$Name dependencies installed"
            } catch {
                Write-Error "Error installing $Name dependencies: $_"
                return $false
            } finally {
                Pop-Location
            }
        } else {
            Write-Success "$Name dependencies already installed"
        }
        return $true
    }
    
    $services = @(
        @{ Path = "server"; Name = "Backend API" },
        @{ Path = "client"; Name = "Client App" },
        @{ Path = "admin"; Name = "Admin Dashboard" },
        @{ Path = "tenant"; Name = "Tenant Dashboard" },
        @{ Path = "PublicPage"; Name = "Public Page" }
    )
    
    $allDepsOk = $true
    foreach ($service in $services) {
        $result = Install-Dependencies -Path $service.Path -Name $service.Name
        $allDepsOk = $allDepsOk -and $result
    }
    
    if (-not $allDepsOk) {
        Write-Error "Some dependencies failed to install"
        Write-Info "You can skip dependency check with -SkipDeps flag"
        exit 1
    }
    
    Write-Success "All dependencies are ready"
} else {
    Write-Section "STEP 3: Skipping Dependency Check (using -SkipDeps flag)"
}

# ============================================================================
# STEP 4: Check Port Availability
# ============================================================================
Write-Section "STEP 4: Checking Port Availability"

function Test-Port {
    param([int]$Port, [string]$Service)
    
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($connection) {
        Write-Warning "Port $Port is already in use (may be $Service already running)"
        return $false
    } else {
        Write-Success "Port $Port is available"
        return $true
    }
}

$ports = @(
    @{ Port = 5000; Service = "Backend API" },
    @{ Port = 3000; Service = "Client App" },
    @{ Port = 3002; Service = "Admin Dashboard" },
    @{ Port = 3003; Service = "Tenant Dashboard" },
    @{ Port = 3004; Service = "Public Page" }
)

$allPortsOk = $true
foreach ($portInfo in $ports) {
    $result = Test-Port -Port $portInfo.Port -Service $portInfo.Service
    $allPortsOk = $allPortsOk -and $result
}

if (-not $allPortsOk) {
    Write-Warning "Some ports are in use. Services may already be running."
    Write-Info "Continuing anyway..."
}

# ============================================================================
# STEP 5: Start All Services
# ============================================================================
Write-Section "STEP 5: Starting All Services"

function Start-Service {
    param(
        [string]$Path,
        [string]$Name,
        [int]$Port,
        [string]$Color = "Cyan"
    )
    
    if (-not (Test-Path $Path)) {
        Write-Warning "$Name directory not found: $Path - Skipping"
        return $false
    }
    
    Write-Info "Starting $Name on port $Port..."
    
    $fullPath = (Resolve-Path $Path).Path
    $title = "🚀 $Name (Port $Port)"
    $command = @"
`$Host.UI.RawUI.WindowTitle = '$title'
Write-Host ''
Write-Host '═══════════════════════════════════════════════════════════════════' -ForegroundColor $Color
Write-Host '  $title' -ForegroundColor $Color
Write-Host '═══════════════════════════════════════════════════════════════════' -ForegroundColor $Color
Write-Host ''
cd '$fullPath'
npm run dev
"@
    
    try {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $command -WindowStyle Normal
        Start-Sleep -Seconds 2
        Write-Success "$Name started in new window"
        return $true
    } catch {
        Write-Error "Failed to start $Name : $_"
        return $false
    }
}

# Define all services
$services = @(
    @{ Path = "server"; Name = "Backend API"; Port = 5000; Color = "Green" },
    @{ Path = "client"; Name = "Client App"; Port = 3000; Color = "Blue" },
    @{ Path = "admin"; Name = "Admin Dashboard"; Port = 3002; Color = "Magenta" },
    @{ Path = "tenant"; Name = "Tenant Dashboard"; Port = 3003; Color = "Yellow" },
    @{ Path = "PublicPage"; Name = "Public Page"; Port = 3004; Color = "Cyan" }
)

$startedServices = @()
foreach ($service in $services) {
    $result = Start-Service -Path $service.Path -Name $service.Name -Port $service.Port -Color $service.Color
    if ($result) {
        $startedServices += $service
    }
}

# ============================================================================
# STEP 6: Health Check (Optional)
# ============================================================================
if ($HealthCheck) {
    Write-Section "STEP 6: Health Check"
    
    Write-Info "Waiting for services to start..."
    Start-Sleep -Seconds 10
    
    function Test-ServiceHealth {
        param([string]$Url, [string]$Name)
        
        try {
            $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Success "$Name is responding"
                return $true
            }
        } catch {
            Write-Warning "$Name is not responding yet (may need more time)"
            return $false
        }
    }
    
    $healthChecks = @(
        @{ Url = "http://localhost:5000/api/v1/health"; Name = "Backend API" },
        @{ Url = "http://localhost:3000"; Name = "Client App" },
        @{ Url = "http://localhost:3002"; Name = "Admin Dashboard" },
        @{ Url = "http://localhost:3003"; Name = "Tenant Dashboard" },
        @{ Url = "http://localhost:3004"; Name = "Public Page" }
    )
    
    foreach ($check in $healthChecks) {
        Test-ServiceHealth -Url $check.Url -Name $check.Name
    }
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Section "🎉 STARTUP COMPLETE"

Write-ColorOutput "Successfully started $($startedServices.Count) service(s):" "Green"
Write-Host ""

foreach ($service in $startedServices) {
    Write-ColorOutput "   ✅ $($service.Name) - http://localhost:$($service.Port)" "White"
}

Write-Host ""
Write-ColorOutput "📍 Service URLs:" "Cyan"
Write-ColorOutput "   🔧 Backend API:      http://localhost:5000" "White"
Write-ColorOutput "   👤 Client App:       http://localhost:3000" "White"
Write-ColorOutput "   🎛️  Admin Dashboard:  http://localhost:3002" "White"
Write-ColorOutput "   🏢 Tenant Dashboard: http://localhost:3003" "White"
Write-ColorOutput "   🌐 Public Page:      http://localhost:3004" "White"

Write-Host ""
Write-ColorOutput "🗄️  Database Services:" "Cyan"
Write-ColorOutput "   📊 PostgreSQL:      localhost:5434" "White"
Write-ColorOutput "   🔴 Redis:            localhost:6379" "White"

Write-Host ""
Write-ColorOutput "💡 Tips:" "Yellow"
Write-ColorOutput "   • Each service runs in a separate PowerShell window" "Gray"
Write-ColorOutput "   • Close the window to stop that service" "Gray"
Write-ColorOutput "   • Or press Ctrl+C in each window to stop" "Gray"
Write-ColorOutput "   • Use 'docker-compose down' to stop Docker containers" "Gray"
Write-ColorOutput "   • Use -HealthCheck flag to verify services are responding" "Gray"

Write-Host ""
Write-ColorOutput "🎉 All systems are starting! Check the individual windows for status." "Green"
Write-Host ""

# Wait a moment before exiting
Start-Sleep -Seconds 2




