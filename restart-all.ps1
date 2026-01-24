# ============================================================================
# Restart All Services Script
# Kills all processes on service ports and optionally restarts everything
# ============================================================================

param(
    [switch]$Restart,
    [switch]$SkipDocker
)

$ErrorActionPreference = "Continue"

# Colors
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
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
Write-ColorOutput "║          🔄 RESTART ALL SERVICES - PORT CLEANUP 🔄              ║" "Cyan"
Write-ColorOutput "║                                                                  ║" "Cyan"
Write-ColorOutput "╚══════════════════════════════════════════════════════════════════╝" "Cyan"
Write-Host ""

# Define all service ports
$ports = @(
    @{ Port = 5000; Service = "Backend API" },
    @{ Port = 3000; Service = "Client App" },
    @{ Port = 3002; Service = "Admin Dashboard" },
    @{ Port = 3003; Service = "Tenant Dashboard" },
    @{ Port = 3004; Service = "Public Page" }
)

# ============================================================================
# STEP 1: Kill All Processes on Service Ports
# ============================================================================
Write-Section "STEP 1: Killing Processes on Service Ports"

$killedCount = 0
foreach ($portInfo in $ports) {
    $port = $portInfo.Port
    $service = $portInfo.Service
    
    Write-Info "Checking port $port ($service)..."
    
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    
    if ($connections) {
        $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($processId in $processIds) {
            try {
                $process = Get-Process -Id $processId -ErrorAction Stop
                Write-Warning "  Found: $($process.ProcessName) (PID: $processId)"
                Write-Info "  Killing process..."
                Stop-Process -Id $processId -Force -ErrorAction Stop
                Write-Success "  ✅ Process $processId killed"
                $killedCount++
            } catch {
                Write-Warning "  ⚠️  Could not kill process $processId : $_"
            }
        }
    } else {
        Write-Success "  Port $port is free"
    }
}

Write-Host ""
if ($killedCount -gt 0) {
    Write-Success "Killed $killedCount process(es)"
    Write-Info "Waiting 3 seconds for ports to be released..."
    Start-Sleep -Seconds 3
} else {
    Write-Success "All ports are already free!"
}

# ============================================================================
# STEP 2: Verify Ports are Free
# ============================================================================
Write-Section "STEP 2: Verifying Ports are Free"

$allFree = $true
foreach ($portInfo in $ports) {
    $port = $portInfo.Port
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    
    if ($connections) {
        Write-Warning "⚠️  Port $port is still in use (may be TIME_WAIT - will clear)"
        $allFree = $false
    } else {
        Write-Success "✅ Port $port is free"
    }
}

# ============================================================================
# STEP 3: Restart Services (if requested)
# ============================================================================
if ($Restart) {
    Write-Section "STEP 3: Restarting All Services"
    
    Write-Info "Starting all services..."
    Write-Host ""
    
    # Check if start-all-systems.ps1 exists
    if (Test-Path "start-all-systems.ps1") {
        Write-Info "Using start-all-systems.ps1 script..."
        $args = @()
        if ($SkipDocker) {
            $args += "-SkipDocker"
        }
        & ".\start-all-systems.ps1" @args
    } else {
        Write-Warning "start-all-systems.ps1 not found. Starting services manually..."
        
        $services = @(
            @{ Path = "server"; Name = "Backend API"; Port = 5000; Color = "Green" },
            @{ Path = "client"; Name = "Client App"; Port = 3000; Color = "Blue" },
            @{ Path = "admin"; Name = "Admin Dashboard"; Port = 3002; Color = "Magenta" },
            @{ Path = "tenant"; Name = "Tenant Dashboard"; Port = 3003; Color = "Yellow" },
            @{ Path = "PublicPage"; Name = "Public Page"; Port = 3004; Color = "Cyan" }
        )
        
        foreach ($service in $services) {
            if (Test-Path $service.Path) {
                Write-Info "Starting $($service.Name)..."
                $fullPath = (Resolve-Path $service.Path).Path
                $title = "🚀 $($service.Name) (Port $($service.Port))"
                $command = "cd '$fullPath'; Write-Host '$title' -ForegroundColor $($service.Color); npm run dev"
                Start-Process powershell -ArgumentList "-NoExit", "-Command", $command -WindowStyle Normal
                Start-Sleep -Seconds 2
            }
        }
    }
} else {
    Write-Section "STEP 3: Skipping Restart"
    Write-Info "Use -Restart flag to automatically restart all services"
    Write-Host ""
    Write-ColorOutput "💡 To restart services, run:" "Yellow"
    Write-ColorOutput "   .\restart-all.ps1 -Restart" "White"
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Section "✅ CLEANUP COMPLETE"

Write-ColorOutput "Summary:" "Cyan"
Write-Host "  • Processes killed: $killedCount" -ForegroundColor White
Write-Host "  • Ports checked: $($ports.Count)" -ForegroundColor White
Write-Host "  • All ports free: $(if ($allFree) { 'Yes' } else { 'May have TIME_WAIT (normal)' })" -ForegroundColor White

Write-Host ""
Write-ColorOutput "📍 Service Ports:" "Cyan"
foreach ($portInfo in $ports) {
    Write-Host "   • Port $($portInfo.Port) - $($portInfo.Service)" -ForegroundColor White
}

if (-not $Restart) {
    Write-Host ""
    Write-ColorOutput "💡 Next Steps:" "Yellow"
    Write-Host "   1. Start services manually, or" -ForegroundColor White
    Write-Host "   2. Run: .\restart-all.ps1 -Restart" -ForegroundColor White
    Write-Host "   3. Or use: .\start-all-systems.ps1" -ForegroundColor White
}

Write-Host ""

