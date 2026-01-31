#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Verification Script for Asset Population Setup
    
.DESCRIPTION
    Diagnoses and verifies the entire asset population environment.
    Run this to troubleshoot issues with server, clients, or scanner.
    
.NOTES
    Run on Node 1 (Server) to check overall health.
    Run on Node 2+ (Clients) to verify client configuration.
#>

param(
    [switch]$IsClient,  # Set this flag when running on a client machine
    [switch]$FixIssues,  # Attempt to automatically fix common issues
    [switch]$Detailed    # Show detailed diagnostic information
)

$ErrorActionPreference = "Continue"

function Write-Check {
    param(
        [string]$Message,
        [bool]$Pass,
        [string]$Detail = ""
    )
    
    $icon = if ($Pass) { "✓" } else { "✗" }
    $color = if ($Pass) { "Green" } else { "Red" }
    
    Write-Host "[$icon] " -ForegroundColor $color -NoNewline
    Write-Host $Message
    
    if ($Detail -and $Detailed) {
        Write-Host "    $Detail" -ForegroundColor Gray
    }
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Test-Administrator {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ============================================
# BASIC CHECKS (All Machines)
# ============================================
function Test-BasicConfiguration {
    Write-Section "Basic Configuration"
    
    # Check admin rights
    $isAdmin = Test-Administrator
    Write-Check "Running as Administrator" $isAdmin "Required for most checks"
    
    # Check PowerShell version
    $psVersion = $PSVersionTable.PSVersion
    $psOk = $psVersion.Major -ge 5
    Write-Check "PowerShell Version: $psVersion" $psOk "Require PS 5.0+"
    
    # Check OS version
    $os = Get-CimInstance Win32_OperatingSystem
    Write-Check "Operating System: $($os.Caption)" $true "$($os.Version)"
    
    # Check hostname
    $hostname = $env:COMPUTERNAME
    Write-Check "Hostname: $hostname" $true
    
    # Check network connectivity
    $adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" }
    $hasNetwork = $adapters.Count -gt 0
    Write-Check "Active Network Adapters: $($adapters.Count)" $hasNetwork
    
    if ($Detailed) {
        foreach ($adapter in $adapters) {
            $ip = (Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
            Write-Host "    - $($adapter.Name): $ip" -ForegroundColor Gray
        }
    }
    
    return $isAdmin -and $psOk -and $hasNetwork
}

# ============================================
# SERVER CHECKS (Domain Controller)
# ============================================
function Test-ServerConfiguration {
    Write-Section "Server Configuration (Domain Controller)"
    
    # Check if AD DS is installed
    try {
        $addsFeature = Get-WindowsFeature -Name AD-Domain-Services -ErrorAction Stop
        $addsInstalled = $addsFeature.Installed
        Write-Check "AD Domain Services Installed" $addsInstalled
    }
    catch {
        Write-Check "AD Domain Services Check Failed" $false "Not a Windows Server?"
        return $false
    }
    
    # Check if promoted to DC
    try {
        $dcInfo = Get-ADDomainController -ErrorAction Stop
        Write-Check "Promoted to Domain Controller" $true "$($dcInfo.Domain)"
        
        if ($Detailed) {
            Write-Host "    Domain: $($dcInfo.Domain)" -ForegroundColor Gray
            Write-Host "    Site: $($dcInfo.Site)" -ForegroundColor Gray
            Write-Host "    IP: $($dcInfo.IPv4Address)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Check "Not a Domain Controller" $false
        return $false
    }
    
    # Check DNS service
    $dnsService = Get-Service -Name DNS -ErrorAction SilentlyContinue
    $dnsRunning = $dnsService -and $dnsService.Status -eq "Running"
    Write-Check "DNS Service Running" $dnsRunning
    
    # Check service account exists
    try {
        $svcAccount = Get-ADUser -Identity "svc_scanner" -ErrorAction Stop
        Write-Check "Service Account 'svc_scanner' Exists" $true
        
        if ($Detailed) {
            Write-Host "    Enabled: $($svcAccount.Enabled)" -ForegroundColor Gray
            Write-Host "    Password Never Expires: $(($svcAccount.PasswordNeverExpires))" -ForegroundColor Gray
        }
    }
    catch {
        Write-Check "Service Account 'svc_scanner' Missing" $false
        
        if ($FixIssues) {
            Write-Host "    Attempting to create service account..." -ForegroundColor Yellow
            try {
                $securePassword = ConvertTo-SecureString "CyberSec2025!" -AsPlainText -Force
                New-ADUser -Name "svc_scanner" `
                    -SamAccountName "svc_scanner" `
                    -UserPrincipalName "svc_scanner@meezan.local" `
                    -AccountPassword $securePassword `
                    -Enabled $true `
                    -PasswordNeverExpires $true `
                    -Description "Service account for asset scanning"
                Write-Check "Service Account Created" $true
            }
            catch {
                Write-Check "Failed to create service account" $false "$_"
            }
        }
    }
    
    # Check domain computers
    try {
        $computers = Get-ADComputer -Filter * | Where-Object { $_.Name -ne $env:COMPUTERNAME }
        $computerCount = $computers.Count
        Write-Check "Domain Computers (excluding DC): $computerCount" ($computerCount -gt 0)
        
        if ($Detailed -and $computerCount -gt 0) {
            foreach ($comp in $computers) {
                Write-Host "    - $($comp.Name)" -ForegroundColor Gray
            }
        }
    }
    catch {
        Write-Check "Could not query AD computers" $false
    }
    
    # Check WinRM service
    $winrmService = Get-Service -Name WinRM
    $winrmRunning = $winrmService.Status -eq "Running"
    Write-Check "WinRM Service Running" $winrmRunning
    
    if (-not $winrmRunning -and $FixIssues) {
        Write-Host "    Starting WinRM service..." -ForegroundColor Yellow
        Start-Service WinRM
        Set-Service WinRM -StartupType Automatic
    }
    
    # Check Python installation
    try {
        $pythonPath = (Get-Command python -ErrorAction Stop).Source
        $pythonVersion = python --version 2>&1
        Write-Check "Python Installed" $true "$pythonVersion"
        
        if ($Detailed) {
            Write-Host "    Path: $pythonPath" -ForegroundColor Gray
        }
    }
    catch {
        Write-Check "Python Not Found" $false "Install from python.org"
    }
    
    # Check scanner script exists
    $scannerPath = "C:\asset-population\Asset_Scanner.py"
    $scannerExists = Test-Path $scannerPath
    Write-Check "Asset Scanner Script Found" $scannerExists $scannerPath
    
    # Check Python dependencies
    if ($pythonPath) {
        $requiredModules = @("ldap3", "pywinrm", "requests")
        $allInstalled = $true
        
        foreach ($module in $requiredModules) {
            try {
                $result = python -c "import $module" 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Check "Python module '$module' installed" $true
                }
                else {
                    Write-Check "Python module '$module' missing" $false
                    $allInstalled = $false
                    
                    if ($FixIssues) {
                        Write-Host "    Installing $module..." -ForegroundColor Yellow
                        pip install $module
                    }
                }
            }
            catch {
                Write-Check "Could not check module '$module'" $false
                $allInstalled = $false
            }
        }
    }
    
    return $true
}

# ============================================
# CLIENT CHECKS
# ============================================
function Test-ClientConfiguration {
    Write-Section "Client Configuration"
    
    # Check domain membership
    $computerSystem = Get-WmiObject Win32_ComputerSystem
    $domain = $computerSystem.Domain
    $isDomainJoined = $domain -ne "WORKGROUP"
    Write-Check "Domain Joined" $isDomainJoined "Domain: $domain"
    
    if (-not $isDomainJoined) {
        Write-Host "    This client is not joined to a domain!" -ForegroundColor Red
        Write-Host "    Run Client_Join.ps1 to join the domain" -ForegroundColor Yellow
        return $false
    }
    
    # Check DNS configuration
    $activeAdapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
    if ($activeAdapter) {
        $dnsServers = (Get-DnsClientServerAddress -InterfaceIndex $activeAdapter.ifIndex -AddressFamily IPv4).ServerAddresses
        $hasDC = $dnsServers -contains "192.168.1.50"
        Write-Check "DNS Points to DC (192.168.1.50)" $hasDC "DNS: $($dnsServers -join ', ')"
        
        if (-not $hasDC -and $FixIssues) {
            Write-Host "    Setting DNS to 192.168.1.50..." -ForegroundColor Yellow
            Set-DnsClientServerAddress -InterfaceIndex $activeAdapter.ifIndex -ServerAddresses "192.168.1.50", "8.8.8.8"
        }
    }
    
    # Test connectivity to DC
    $dcReachable = Test-Connection -ComputerName "192.168.1.50" -Count 2 -Quiet
    Write-Check "Can Ping DC (192.168.1.50)" $dcReachable
    
    # Check WinRM service
    $winrmService = Get-Service -Name WinRM
    $winrmRunning = $winrmService.Status -eq "Running"
    Write-Check "WinRM Service Running" $winrmRunning
    
    if (-not $winrmRunning -and $FixIssues) {
        Write-Host "    Starting WinRM service..." -ForegroundColor Yellow
        Enable-PSRemoting -Force
        Start-Service WinRM
        Set-Service WinRM -StartupType Automatic
    }
    
    # Check WinRM listener
    $listeners = Get-WSManInstance -ResourceURI winrm/config/listener -Enumerate
    $hasHttpListener = $listeners | Where-Object { $_.Transport -eq "HTTP" }
    Write-Check "WinRM HTTP Listener Configured" ($hasHttpListener -ne $null)
    
    # Check firewall rule
    $firewallRule = Get-NetFirewallRule -DisplayName "WinRM*" -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq $true }
    Write-Check "WinRM Firewall Rule Enabled" ($firewallRule -ne $null)
    
    # Check Windows Defender status
    try {
        $defenderStatus = Get-MpComputerStatus -ErrorAction Stop
        $avEnabled = $defenderStatus.AntivirusEnabled
        $rtpEnabled = $defenderStatus.RealTimeProtectionEnabled
        
        Write-Check "Windows Defender Enabled" $avEnabled
        Write-Check "Real-Time Protection Enabled" $rtpEnabled
        
        if ($Detailed) {
            Write-Host "    Last Quick Scan: $($defenderStatus.QuickScanStartTime)" -ForegroundColor Gray
            Write-Host "    Last Full Scan: $($defenderStatus.FullScanStartTime)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Check "Could not check Windows Defender status" $false
    }
    
    return $isDomainJoined
}

# ============================================
# NETWORK CONNECTIVITY TESTS
# ============================================
function Test-NetworkConnectivity {
    Write-Section "Network Connectivity"
    
    # Test internet connectivity
    $internetOk = Test-Connection -ComputerName "8.8.8.8" -Count 2 -Quiet
    Write-Check "Internet Connectivity" $internetOk "Ping 8.8.8.8"
    
    # Test DNS resolution
    try {
        $dnsMeezan = Resolve-DnsName -Name "meezan.local" -ErrorAction Stop
        Write-Check "Resolve 'meezan.local'" $true "$($dnsMeezan.IPAddress)"
    }
    catch {
        Write-Check "Resolve 'meezan.local'" $false "Domain may not be ready"
    }
    
    # Test DC connectivity
    if (-not $IsClient) {
        # From server: test client connectivity
        try {
            $computers = Get-ADComputer -Filter * | Where-Object { $_.Name -ne $env:COMPUTERNAME }
            
            Write-Host ""
            Write-Host "Testing connectivity to domain computers:" -ForegroundColor Cyan
            
            foreach ($comp in $computers) {
                $hostname = $comp.Name
                $fqdn = "$hostname.meezan.local"
                
                # Test ping
                $pingOk = Test-Connection -ComputerName $hostname -Count 1 -Quiet -ErrorAction SilentlyContinue
                
                # Test WinRM
                $winrmOk = $false
                try {
                    Test-WSMan -ComputerName $fqdn -ErrorAction Stop | Out-Null
                    $winrmOk = $true
                }
                catch { }
                
                $status = if ($pingOk -and $winrmOk) { "✓ Online + WinRM" }
                         elseif ($pingOk) { "⚠ Online (WinRM failed)" }
                         else { "✗ Offline" }
                
                $color = if ($pingOk -and $winrmOk) { "Green" }
                        elseif ($pingOk) { "Yellow" }
                        else { "Red" }
                
                Write-Host "  $hostname : " -NoNewline
                Write-Host $status -ForegroundColor $color
            }
        }
        catch {
            Write-Host "Could not test domain computers: $_" -ForegroundColor Red
        }
    }
}

# ============================================
# SCANNER TEST
# ============================================
function Test-Scanner {
    Write-Section "Asset Scanner Test"
    
    if ($IsClient) {
        Write-Host "Scanner test only runs on the server." -ForegroundColor Yellow
        return
    }
    
    $scannerPath = "C:\asset-population\Asset_Scanner.py"
    
    if (-not (Test-Path $scannerPath)) {
        Write-Check "Scanner script not found" $false $scannerPath
        return
    }
    
    Write-Host "Running scanner in test mode..." -ForegroundColor Yellow
    
    try {
        $output = python $scannerPath --demo 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Check "Scanner executed successfully" $true
            
            if ($Detailed) {
                Write-Host ""
                Write-Host "Sample output:" -ForegroundColor Cyan
                Write-Host $output
            }
        }
        else {
            Write-Check "Scanner failed" $false "Exit code: $LASTEXITCODE"
            Write-Host $output -ForegroundColor Red
        }
    }
    catch {
        Write-Check "Scanner execution error" $false "$_"
    }
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Asset Population Verification Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "  Computer: $env:COMPUTERNAME" -ForegroundColor Gray
Write-Host "  Mode: $(if ($IsClient) { 'Client' } else { 'Server' })" -ForegroundColor Gray
if ($FixIssues) {
    Write-Host "  Fix Issues: Enabled" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan

# Run appropriate checks
$basicOk = Test-BasicConfiguration

if ($IsClient) {
    $clientOk = Test-ClientConfiguration
    Test-NetworkConnectivity
}
else {
    $serverOk = Test-ServerConfiguration
    Test-NetworkConnectivity
    Test-Scanner
}

# Summary
Write-Section "Verification Summary"

if ($IsClient) {
    if ($basicOk -and $clientOk) {
        Write-Host "✓ Client is properly configured and ready for scanning!" -ForegroundColor Green
    }
    else {
        Write-Host "✗ Client has configuration issues. Review errors above." -ForegroundColor Red
        Write-Host "  Try running with -FixIssues flag to auto-fix common problems" -ForegroundColor Yellow
    }
}
else {
    if ($basicOk -and $serverOk) {
        Write-Host "✓ Server is properly configured and ready to scan assets!" -ForegroundColor Green
    }
    else {
        Write-Host "✗ Server has configuration issues. Review errors above." -ForegroundColor Red
        Write-Host "  Try running with -FixIssues flag to auto-fix common problems" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "For detailed output, run with -Detailed flag" -ForegroundColor Gray
Write-Host "To attempt automatic fixes, run with -FixIssues flag" -ForegroundColor Gray
Write-Host ""
