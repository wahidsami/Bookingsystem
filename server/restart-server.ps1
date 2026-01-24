# PowerShell script to restart the server
Write-Host "Stopping Node.js processes on port 5000..."

# Find and kill processes on port 5000
$processes = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pid in $processes) {
    Write-Host "Killing process $pid"
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2

Write-Host "Starting server..."
Set-Location $PSScriptRoot
npm start

