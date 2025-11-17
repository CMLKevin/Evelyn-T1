# Evelyn Chat - Start Script for Windows
# PowerShell version with colorful logging

# Enable ANSI colors in PowerShell
$PSStyle.OutputRendering = [System.Management.Automation.OutputRendering]::Ansi

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Global variables for process management
$global:BackendJob = $null
$global:FrontendJob = $null

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║      Evelyn Chat - Starting...       ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Cleanup function
function Cleanup {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "║    Shutting down servers...          ║" -ForegroundColor Yellow
    Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Yellow
    
    if ($global:BackendJob) {
        Stop-Job $global:BackendJob -ErrorAction SilentlyContinue
        Remove-Job $global:BackendJob -ErrorAction SilentlyContinue
    }
    
    if ($global:FrontendJob) {
        Stop-Job $global:FrontendJob -ErrorAction SilentlyContinue
        Remove-Job $global:FrontendJob -ErrorAction SilentlyContinue
    }
    
    # Kill any remaining node processes from this project
    Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*tsx*" -or $_.CommandLine -like "*vite*"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Write-Host "✓ All servers stopped" -ForegroundColor Green
    Write-Host ""
}

# Register cleanup on exit
$null = Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

# Function to colorize and display logs
function Write-ColorizedLog {
    param(
        [string]$Line,
        [string]$ServerType
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $prefix = "[$timestamp]"
    
    # Skip empty lines
    if ([string]::IsNullOrWhiteSpace($Line)) { return }
    
    if ($ServerType -eq "BACKEND") {
        # Error logs
        if ($Line -match "error|failed|fail|exception") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [BACKEND] " -ForegroundColor Red -NoNewline
            Write-Host $Line -ForegroundColor DarkRed
        }
        # Warning logs
        elseif ($Line -match "warn|warning") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [BACKEND] " -ForegroundColor Yellow -NoNewline
            Write-Host $Line -ForegroundColor Yellow
        }
        # Success/completion logs
        elseif ($Line -match "✓|success|complete|ready|listening|started") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [BACKEND] " -ForegroundColor Green -NoNewline
            Write-Host $Line -ForegroundColor Green
        }
        # InnerThought system logs
        elseif ($Line -match "\[InnerThought\]") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [BACKEND] " -ForegroundColor Magenta -NoNewline
            Write-Host $Line -ForegroundColor Magenta
        }
        # Memory/Database logs
        elseif ($Line -match "\[Memory\]|\[Database\]|\[Prisma\]") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [BACKEND] " -ForegroundColor Cyan -NoNewline
            Write-Host $Line -ForegroundColor Cyan
        }
        # Personality/Agent logs
        elseif ($Line -match "\[Personality\]|\[Agent\]|\[Orchestrator\]") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [BACKEND] " -ForegroundColor Blue -NoNewline
            Write-Host $Line -ForegroundColor Blue
        }
        # WebSocket logs
        elseif ($Line -match "WebSocket|ws:|connection") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [BACKEND] " -ForegroundColor Cyan -NoNewline
            Write-Host $Line -ForegroundColor Cyan
        }
        # API/Route logs
        elseif ($Line -match "GET|POST|PUT|DELETE|API") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [BACKEND] " -ForegroundColor Blue -NoNewline
            Write-Host $Line
        }
        # Default logs
        else {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [BACKEND] " -ForegroundColor White -NoNewline
            Write-Host $Line
        }
    }
    elseif ($ServerType -eq "FRONTEND") {
        # Vite-specific formatting
        if ($Line -match "VITE") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [FRONTEND] " -ForegroundColor Cyan -NoNewline
            Write-Host $Line -ForegroundColor Cyan
        }
        elseif ($Line -match "Local:") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [FRONTEND] " -ForegroundColor Green -NoNewline
            Write-Host $Line -ForegroundColor Green
        }
        elseif ($Line -match "Network:") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [FRONTEND] " -ForegroundColor Blue -NoNewline
            Write-Host $Line -ForegroundColor Blue
        }
        elseif ($Line -match "error|Error") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [FRONTEND] " -ForegroundColor Red -NoNewline
            Write-Host $Line -ForegroundColor DarkRed
        }
        elseif ($Line -match "ready|✓") {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [FRONTEND] " -ForegroundColor Green -NoNewline
            Write-Host $Line -ForegroundColor Green
        }
        else {
            Write-Host $prefix -ForegroundColor DarkGray -NoNewline
            Write-Host " [FRONTEND] " -ForegroundColor Cyan -NoNewline
            Write-Host $Line
        }
    }
}

# Check if node_modules exist
if (-not (Test-Path "server\node_modules") -or -not (Test-Path "web\node_modules")) {
    Write-Host "⚠ Dependencies not found. Installing..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║    Starting Backend Server...        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Start backend in background job
$global:BackendJob = Start-Job -ScriptBlock {
    Set-Location $using:ScriptDir\server
    npm run dev 2>&1
}

# Wait for backend to initialize
Start-Sleep -Seconds 3

# Check if backend job is running
if ($global:BackendJob.State -ne "Running") {
    Write-Host "✗ Backend failed to start" -ForegroundColor Red
    Cleanup
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║    Starting Frontend Server...       ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Start frontend in background job
$global:FrontendJob = Start-Job -ScriptBlock {
    Set-Location $using:ScriptDir\web
    npm run dev 2>&1
}

Write-Host "Press Ctrl+C to stop the servers" -ForegroundColor Cyan
Write-Host ""

# Main loop - display logs from both jobs
try {
    while ($true) {
        # Get backend output
        if ($global:BackendJob -and $global:BackendJob.State -eq "Running") {
            $backendOutput = Receive-Job $global:BackendJob -ErrorAction SilentlyContinue
            if ($backendOutput) {
                foreach ($line in $backendOutput) {
                    Write-ColorizedLog -Line $line.ToString() -ServerType "BACKEND"
                }
            }
        }
        
        # Get frontend output
        if ($global:FrontendJob -and $global:FrontendJob.State -eq "Running") {
            $frontendOutput = Receive-Job $global:FrontendJob -ErrorAction SilentlyContinue
            if ($frontendOutput) {
                foreach ($line in $frontendOutput) {
                    Write-ColorizedLog -Line $line.ToString() -ServerType "FRONTEND"
                }
            }
        }
        
        # Check if either job has failed
        if ($global:BackendJob.State -eq "Failed") {
            Write-Host "Backend job failed!" -ForegroundColor Red
            break
        }
        if ($global:FrontendJob.State -eq "Failed") {
            Write-Host "Frontend job failed!" -ForegroundColor Red
            break
        }
        
        # Small delay to prevent CPU spinning
        Start-Sleep -Milliseconds 100
    }
}
catch {
    # Catch Ctrl+C or other interrupts
    Write-Host "Interrupted" -ForegroundColor Yellow
}
finally {
    Cleanup
}

