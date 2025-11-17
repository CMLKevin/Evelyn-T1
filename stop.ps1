# Evelyn Chat - Stop Script for Windows
# Stops all running Evelyn servers

Write-Host "Stopping Evelyn servers..." -ForegroundColor Yellow

# Kill all node processes running tsx or vite
$processes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $cmdLine = $_.CommandLine
    $cmdLine -like "*tsx watch*" -or $cmdLine -like "*vite*"
}

if ($processes) {
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "✓ All servers stopped" -ForegroundColor Green
} else {
    Write-Host "No running servers found" -ForegroundColor Yellow
}

