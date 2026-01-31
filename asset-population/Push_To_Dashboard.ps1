#Requires -RunAsAdministrator
<#
.SYNOPSIS
    API Integration Script for Security Dashboard
    
.DESCRIPTION
    Runs the Asset Scanner and automatically pushes results to the dashboard backend API.
    
.NOTES
    Run this on Node 1 (Server) after scanner is working.
    Configure $DashboardAPI with your actual endpoint.
#>

param(
    [string]$DashboardAPI = "http://localhost:3001/api/assets",
    [string]$ScannerPath = "C:\asset-population\Asset_Scanner.py",
    [string]$TempOutputFile = "$env:TEMP\scan_results.json",
    [string]$PythonPath = "python",
    [string]$ApiToken = "",  # Optional: Add Bearer token if API requires auth
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$LogFile = "C:\asset-population\logs\dashboard_push_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

# Create logs directory if it doesn't exist
$LogDir = Split-Path $LogFile -Parent
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage -ForegroundColor $(
        switch ($Level) {
            "ERROR" { "Red" }
            "WARN"  { "Yellow" }
            "SUCCESS" { "Green" }
            default { "White" }
        }
    )
    Add-Content -Path $LogFile -Value $logMessage
}

# ============================================
# PHASE 1: RUN ASSET SCANNER
# ============================================
function Invoke-AssetScan {
    Write-Log "=== PHASE 1: Running Asset Scanner ===" "INFO"
    
    try {
        # Check if Python is available
        try {
            $pythonVersion = & $PythonPath --version 2>&1
            Write-Log "Found Python: $pythonVersion" "SUCCESS"
        }
        catch {
            throw "Python not found. Please install Python 3.9+ and ensure it's in PATH"
        }
        
        # Check if scanner script exists
        if (-not (Test-Path $ScannerPath)) {
            throw "Asset Scanner not found at: $ScannerPath"
        }
        
        Write-Log "Running Asset Scanner: $ScannerPath" "INFO"
        
        # Run the scanner and save output to temp file
        $scannerArgs = @(
            $ScannerPath,
            "--output", $TempOutputFile
        )
        
        if ($Verbose) {
            $scannerArgs += "--verbose"
        }
        
        $scanProcess = Start-Process -FilePath $PythonPath `
            -ArgumentList $scannerArgs `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput "$env:TEMP\scanner_stdout.log" `
            -RedirectStandardError "$env:TEMP\scanner_stderr.log"
        
        if ($scanProcess.ExitCode -ne 0) {
            $stderr = Get-Content "$env:TEMP\scanner_stderr.log" -Raw
            throw "Scanner failed with exit code $($scanProcess.ExitCode): $stderr"
        }
        
        # Verify output file was created
        if (-not (Test-Path $TempOutputFile)) {
            throw "Scanner did not produce output file: $TempOutputFile"
        }
        
        Write-Log "Scanner completed successfully" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "Asset scan failed: $_" "ERROR"
        return $false
    }
}

# ============================================
# PHASE 2: PUSH TO DASHBOARD API
# ============================================
function Push-ToDashboard {
    Write-Log "=== PHASE 2: Pushing Results to Dashboard ===" "INFO"
    
    try {
        # Read scan results
        Write-Log "Reading scan results from: $TempOutputFile" "INFO"
        $scanResults = Get-Content $TempOutputFile -Raw | ConvertFrom-Json
        
        $assetCount = $scanResults.Count
        Write-Log "Found $assetCount assets in scan results" "INFO"
        
        # Prepare API request
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        # Add authentication token if provided
        if ($ApiToken) {
            $headers["Authorization"] = "Bearer $ApiToken"
        }
        
        # Convert to JSON
        $jsonBody = $scanResults | ConvertTo-Json -Depth 10 -Compress
        
        Write-Log "Sending POST request to: $DashboardAPI" "INFO"
        
        # Make API request
        try {
            $response = Invoke-RestMethod -Uri $DashboardAPI `
                -Method POST `
                -Headers $headers `
                -Body $jsonBody `
                -TimeoutSec 30
            
            Write-Log "API Response: $($response | ConvertTo-Json -Compress)" "SUCCESS"
            Write-Log "Successfully pushed $assetCount assets to dashboard" "SUCCESS"
            return $true
        }
        catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            $errorMessage = $_.Exception.Message
            
            Write-Log "API request failed with status $statusCode : $errorMessage" "ERROR"
            
            # Log response body if available
            if ($_.ErrorDetails.Message) {
                Write-Log "API Error Details: $($_.ErrorDetails.Message)" "ERROR"
            }
            
            return $false
        }
    }
    catch {
        Write-Log "Failed to push to dashboard: $_" "ERROR"
        return $false
    }
}

# ============================================
# PHASE 3: CLEANUP
# ============================================
function Invoke-Cleanup {
    param([bool]$KeepTempFile = $false)
    
    Write-Log "=== PHASE 3: Cleanup ===" "INFO"
    
    if (-not $KeepTempFile -and (Test-Path $TempOutputFile)) {
        try {
            Remove-Item $TempOutputFile -Force
            Write-Log "Removed temporary file: $TempOutputFile" "INFO"
        }
        catch {
            Write-Log "Could not remove temp file: $_" "WARN"
        }
    }
    
    # Clean up old scanner logs (keep last 7 days)
    $logRetentionDays = 7
    $cutoffDate = (Get-Date).AddDays(-$logRetentionDays)
    
    Get-ChildItem -Path $LogDir -Filter "dashboard_push_*.log" | Where-Object {
        $_.LastWriteTime -lt $cutoffDate
    } | ForEach-Object {
        Write-Log "Removing old log: $($_.Name)" "INFO"
        Remove-Item $_.FullName -Force
    }
}

# ============================================
# MAIN EXECUTION
# ============================================
function Main {
    Write-Log "========================================" "INFO"
    Write-Log "Dashboard Push Script Started" "INFO"
    Write-Log "========================================" "INFO"
    Write-Log "Dashboard API: $DashboardAPI" "INFO"
    Write-Log "Scanner Path: $ScannerPath" "INFO"
    Write-Log "Temp Output: $TempOutputFile" "INFO"
    Write-Log "" "INFO"
    
    # Step 1: Run Asset Scanner
    $scanSuccess = Invoke-AssetScan
    
    if (-not $scanSuccess) {
        Write-Log "FAILED: Asset scan did not complete successfully" "ERROR"
        Invoke-Cleanup -KeepTempFile $true
        exit 1
    }
    
    # Step 2: Push to Dashboard
    $pushSuccess = Push-ToDashboard
    
    if (-not $pushSuccess) {
        Write-Log "FAILED: Could not push results to dashboard" "ERROR"
        Invoke-Cleanup -KeepTempFile $true
        exit 2
    }
    
    # Step 3: Cleanup
    Invoke-Cleanup
    
    Write-Log "" "INFO"
    Write-Log "========================================" "INFO"
    Write-Log "Dashboard Push Completed Successfully!" "SUCCESS"
    Write-Log "========================================" "INFO"
    
    return 0
}

# Run main function
try {
    exit Main
}
catch {
    Write-Log "Unexpected error: $_" "ERROR"
    exit 99
}
