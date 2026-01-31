#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Schedule Asset Scanner to run automatically
    
.DESCRIPTION
    Creates a Windows Scheduled Task to run the Asset Scanner every hour
    and optionally push results to the dashboard API.
    
.NOTES
    Run this once on Node 1 (Server) to set up automated scanning.
#>

param(
    [string]$TaskName = "SecurityDashboard-AssetScanner",
    [string]$ScannerPath = "C:\asset-population\Asset_Scanner.py",
    [string]$PushScriptPath = "C:\asset-population\Push_To_Dashboard.ps1",
    [string]$OutputPath = "C:\scans\assets.json",
    [int]$IntervalHours = 1,
    [switch]$PushToDashboard,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# ============================================
# UNINSTALL SCHEDULED TASK
# ============================================
if ($Uninstall) {
    Write-ColorOutput "Uninstalling scheduled task: $TaskName" "Yellow"
    
    try {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        
        if ($task) {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
            Write-ColorOutput "✓ Successfully removed task: $TaskName" "Green"
        }
        else {
            Write-ColorOutput "Task not found: $TaskName" "Yellow"
        }
    }
    catch {
        Write-ColorOutput "Failed to uninstall task: $_" "Red"
        exit 1
    }
    
    exit 0
}

# ============================================
# INSTALL SCHEDULED TASK
# ============================================

Write-ColorOutput "========================================" "Cyan"
Write-ColorOutput "  Asset Scanner Task Scheduler Setup" "Cyan"
Write-ColorOutput "========================================" "Cyan"
Write-Host ""

# Verify prerequisites
Write-ColorOutput "Checking prerequisites..." "Yellow"

# Check if Python is installed
try {
    $pythonPath = (Get-Command python).Source
    $pythonVersion = python --version
    Write-ColorOutput "✓ Python found: $pythonVersion at $pythonPath" "Green"
}
catch {
    Write-ColorOutput "✗ Python not found. Please install Python 3.9+" "Red"
    exit 1
}

# Check if scanner script exists
if (-not (Test-Path $ScannerPath)) {
    Write-ColorOutput "✗ Scanner not found: $ScannerPath" "Red"
    exit 1
}
Write-ColorOutput "✓ Scanner found: $ScannerPath" "Green"

# Check if push script exists (if using API integration)
if ($PushToDashboard -and -not (Test-Path $PushScriptPath)) {
    Write-ColorOutput "✗ Push script not found: $PushScriptPath" "Red"
    Write-ColorOutput "  Run without -PushToDashboard or create Push_To_Dashboard.ps1" "Yellow"
    exit 1
}
if ($PushToDashboard) {
    Write-ColorOutput "✓ Push script found: $PushScriptPath" "Green"
}

# Create output directory
$OutputDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $OutputDir)) {
    Write-ColorOutput "Creating output directory: $OutputDir" "Yellow"
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}
Write-ColorOutput "✓ Output directory ready: $OutputDir" "Green"

Write-Host ""
Write-ColorOutput "Configuration:" "Cyan"
Write-ColorOutput "  Task Name: $TaskName" "White"
Write-ColorOutput "  Run Interval: Every $IntervalHours hour(s)" "White"
Write-ColorOutput "  Scanner: $ScannerPath" "White"
Write-ColorOutput "  Output: $OutputPath" "White"
if ($PushToDashboard) {
    Write-ColorOutput "  Dashboard Push: Enabled" "White"
}
else {
    Write-ColorOutput "  Dashboard Push: Disabled" "White"
}
Write-Host ""

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-ColorOutput "Removing existing task..." "Yellow"
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# ============================================
# CREATE SCHEDULED TASK
# ============================================

Write-ColorOutput "Creating scheduled task..." "Yellow"

try {
    # Determine what command to run
    if ($PushToDashboard) {
        # Use the push script which runs scanner and pushes to API
        $action = New-ScheduledTaskAction `
            -Execute "powershell.exe" `
            -Argument "-ExecutionPolicy Bypass -File `"$PushScriptPath`""
    }
    else {
        # Just run the scanner and save to file
        $action = New-ScheduledTaskAction `
            -Execute "python.exe" `
            -Argument "`"$ScannerPath`" --output `"$OutputPath`""
    }
    
    # Create trigger (run once, then repeat every X hours)
    $trigger = New-ScheduledTaskTrigger `
        -Once `
        -At (Get-Date).AddMinutes(2) `
        -RepetitionInterval (New-TimeSpan -Hours $IntervalHours)
    
    # Create settings
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 5)
    
    # Run as SYSTEM with highest privileges
    $principal = New-ScheduledTaskPrincipal `
        -UserId "SYSTEM" `
        -RunLevel Highest
    
    # Register the task
    $task = Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Automated asset scanning for Security Dashboard. Runs every $IntervalHours hour(s)."
    
    Write-ColorOutput "✓ Scheduled task created successfully!" "Green"
    Write-Host ""
    
    # Display task information
    Write-ColorOutput "Task Details:" "Cyan"
    Write-ColorOutput "  Name: $($task.TaskName)" "White"
    Write-ColorOutput "  State: $($task.State)" "White"
    Write-ColorOutput "  Next Run: $((Get-ScheduledTask -TaskName $TaskName).Triggers.StartBoundary)" "White"
    Write-ColorOutput "  User: SYSTEM" "White"
    Write-Host ""
    
    Write-ColorOutput "The scanner will run automatically:" "Green"
    Write-ColorOutput "  • First run in 2 minutes" "White"
    Write-ColorOutput "  • Then every $IntervalHours hour(s) thereafter" "White"
    Write-Host ""
    
    # Test run option
    Write-ColorOutput "Want to test now? Run:" "Yellow"
    Write-ColorOutput "  Start-ScheduledTask -TaskName '$TaskName'" "Cyan"
    Write-Host ""
    
    Write-ColorOutput "To view task history:" "Yellow"
    Write-ColorOutput "  Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo" "Cyan"
    Write-Host ""
    
    Write-ColorOutput "To uninstall:" "Yellow"
    Write-ColorOutput "  .\Schedule_Scanner.ps1 -Uninstall" "Cyan"
    Write-Host ""
    
}
catch {
    Write-ColorOutput "Failed to create scheduled task: $_" "Red"
    exit 1
}

Write-ColorOutput "========================================" "Cyan"
Write-ColorOutput "  Setup Complete!" "Green"
Write-ColorOutput "========================================" "Cyan"

# ============================================
# OPTIONAL: RUN FIRST SCAN IMMEDIATELY
# ============================================

$runNow = Read-Host "Run first scan now? (y/n)"
if ($runNow -eq 'y' -or $runNow -eq 'Y') {
    Write-ColorOutput "Starting first scan..." "Yellow"
    try {
        Start-ScheduledTask -TaskName $TaskName
        Write-ColorOutput "✓ Task started! Check output at: $OutputPath" "Green"
    }
    catch {
        Write-ColorOutput "Failed to start task: $_" "Red"
    }
}

Write-Host ""
Write-ColorOutput "Monitoring tip: To watch logs in real-time, run:" "Cyan"
if ($PushToDashboard) {
    Write-ColorOutput "  Get-Content C:\asset-population\logs\dashboard_push_*.log -Wait -Tail 20" "White"
}
else {
    Write-ColorOutput "  Get-Content C:\asset-population\asset_scanner.log -Wait -Tail 20" "White"
}
