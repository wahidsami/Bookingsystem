# Kill process on a specific port
param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "🔍 Checking port $Port..." -ForegroundColor Cyan

$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        try {
            $process = Get-Process -Id $pid -ErrorAction Stop
            Write-Host "⚠️  Found process: $($process.ProcessName) (PID: $pid) using port $Port" -ForegroundColor Yellow
            Write-Host "🛑 Killing process..." -ForegroundColor Yellow
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "✅ Process $pid killed successfully" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not kill process $pid : $_" -ForegroundColor Yellow
        }
    }
    
    Start-Sleep -Seconds 2
    Write-Host "✅ Port $Port should now be free!" -ForegroundColor Green
} else {
    Write-Host "✅ No process found using port $Port" -ForegroundColor Green
}

# Usage: .\kill-port.ps1 -Port 3003