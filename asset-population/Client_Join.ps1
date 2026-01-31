#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Client Join Script for Security Dashboard Asset Population
    
.DESCRIPTION
    This script joins a Windows 10/11 client to the meezan.local domain,
    configures DNS to point to the domain controller, and enables WinRM for scanning.
    
.NOTES
    Run this script on Node 2 (Client) with Administrator privileges.
    Domain Controller IP: 192.168.1.50
    Domain: meezan.local
#>

param(
    [string]$DomainControllerIP = "192.168.1.50",
    [string]$DomainName = "meezan.local",
    [string]$DomainAdmin = "Administrator",
    [string]$DomainAdminPassword = ""  # Will prompt if empty
)

# Script configuration
$ErrorActionPreference = "Stop"
$LogFile = "$env:TEMP\Client_Join_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

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

function Test-Administrator {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ============================================
# PHASE 1: CONFIGURE DNS
# ============================================
function Set-DomainDNS {
    Write-Log "=== PHASE 1: Configuring DNS ===" "INFO"
    
    try {
        # Detect active Wi-Fi adapter
        Write-Log "Detecting active Wi-Fi adapter..." "INFO"
        $wifiAdapter = Get-NetAdapter | Where-Object {
            $_.Status -eq "Up" -and 
            ($_.InterfaceDescription -like "*Wi-Fi*" -or 
             $_.InterfaceDescription -like "*Wireless*" -or
             $_.Name -like "*Wi-Fi*" -or
             $_.Name -like "*Wireless*")
        } | Select-Object -First 1
        
        if (-not $wifiAdapter) {
            # Fallback: Get any active adapter
            Write-Log "No Wi-Fi adapter found, using first active adapter..." "WARN"
            $wifiAdapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
        }
        
        if (-not $wifiAdapter) {
            throw "No active network adapter found!"
        }
        
        Write-Log "Found adapter: $($wifiAdapter.Name) - $($wifiAdapter.InterfaceDescription)" "SUCCESS"
        $adapterIndex = $wifiAdapter.ifIndex
        
        # Set DNS to Domain Controller
        Write-Log "Setting DNS to Domain Controller: $DomainControllerIP" "INFO"
        Set-DnsClientServerAddress -InterfaceIndex $adapterIndex -ServerAddresses @($DomainControllerIP, "8.8.8.8")
        
        # Verify DNS setting
        $dnsServers = Get-DnsClientServerAddress -InterfaceIndex $adapterIndex -AddressFamily IPv4
        Write-Log "DNS configured: $($dnsServers.ServerAddresses -join ', ')" "SUCCESS"
        
        # Test DNS resolution for domain
        Write-Log "Testing DNS resolution for $DomainName..." "INFO"
        Start-Sleep -Seconds 2  # Give DNS time to update
        
        try {
            $dnsTest = Resolve-DnsName -Name $DomainName -Type A -ErrorAction Stop
            Write-Log "DNS resolution successful: $($dnsTest.IPAddress)" "SUCCESS"
        }
        catch {
            Write-Log "DNS resolution test failed (DC may not be ready yet): $_" "WARN"
            Write-Log "Continuing with domain join attempt..." "WARN"
        }
        
        return $true
    }
    catch {
        Write-Log "DNS configuration failed: $_" "ERROR"
        return $false
    }
}

# ============================================
# PHASE 2: JOIN DOMAIN
# ============================================
function Join-DomainNetwork {
    Write-Log "=== PHASE 2: Joining Domain ===" "INFO"
    
    try {
        # Check if already joined to domain
        $computerSystem = Get-WmiObject Win32_ComputerSystem
        if ($computerSystem.PartOfDomain) {
            if ($computerSystem.Domain -eq $DomainName) {
                Write-Log "Computer is already joined to $DomainName" "SUCCESS"
                return $true
            }
            else {
                Write-Log "Computer is joined to different domain: $($computerSystem.Domain)" "WARN"
                Write-Log "Please unjoin from current domain first" "ERROR"
                return $false
            }
        }
        
        Write-Log "Current workgroup: $($computerSystem.Workgroup)" "INFO"
        Write-Log "Joining domain: $DomainName" "INFO"
        
        # Get credentials
        if ([string]::IsNullOrEmpty($DomainAdminPassword)) {
            Write-Log "Please enter domain administrator credentials..." "INFO"
            $credential = Get-Credential -UserName "$DomainName\$DomainAdmin" -Message "Enter Domain Administrator password for $DomainName"
        }
        else {
            $securePassword = ConvertTo-SecureString $DomainAdminPassword -AsPlainText -Force
            $credential = New-Object System.Management.Automation.PSCredential("$DomainName\$DomainAdmin", $securePassword)
        }
        
        # Join domain
        Write-Log "Attempting to join domain $DomainName..." "INFO"
        Add-Computer -DomainName $DomainName -Credential $credential -Force -ErrorAction Stop
        
        Write-Log "Successfully joined domain: $DomainName" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "Domain join failed: $_" "ERROR"
        Write-Log "Ensure the Domain Controller is running and DNS is correct" "WARN"
        return $false
    }
}

# ============================================
# PHASE 3: ENABLE WINRM
# ============================================
function Enable-WinRMClient {
    Write-Log "=== PHASE 3: Enabling WinRM ===" "INFO"
    
    try {
        # Enable WinRM
        Write-Log "Enabling WinRM service..." "INFO"
        Enable-PSRemoting -Force -SkipNetworkProfileCheck
        
        # Start WinRM service and set to automatic
        Set-Service -Name WinRM -StartupType Automatic
        Start-Service -Name WinRM
        
        # Configure WinRM
        Write-Log "Configuring WinRM..." "INFO"
        winrm quickconfig -force
        
        # Set authentication options
        Set-Item WSMan:\localhost\Service\Auth\Basic -Value $true
        Set-Item WSMan:\localhost\Service\Auth\CredSSP -Value $true
        Set-Item WSMan:\localhost\Service\AllowUnencrypted -Value $true
        
        # Configure firewall rule for WinRM
        Write-Log "Adding firewall rule for WinRM (Port 5985)..." "INFO"
        
        # Check and create firewall rule
        $existingRule = Get-NetFirewallRule -DisplayName "WinRM-HTTP-In-TCP-Scanner" -ErrorAction SilentlyContinue
        if (-not $existingRule) {
            New-NetFirewallRule -DisplayName "WinRM-HTTP-In-TCP-Scanner" `
                -Direction Inbound `
                -Protocol TCP `
                -LocalPort 5985 `
                -Action Allow `
                -Profile Any `
                -Description "Allow WinRM HTTP traffic for Security Scanner"
            Write-Log "Firewall rule created for port 5985" "SUCCESS"
        }
        else {
            Write-Log "Firewall rule already exists" "INFO"
        }
        
        # Enable existing Windows Remote Management rules
        Enable-NetFirewallRule -DisplayGroup "Windows Remote Management" -ErrorAction SilentlyContinue
        
        # Verify WinRM is running
        $winrmStatus = Get-Service -Name WinRM
        if ($winrmStatus.Status -eq "Running") {
            Write-Log "WinRM configured and running successfully" "SUCCESS"
        }
        else {
            throw "WinRM service is not running"
        }
        
        # Test WinRM listener
        $listeners = Get-WSManInstance -ResourceURI winrm/config/listener -Enumerate
        Write-Log "WinRM listeners configured: $($listeners.Count)" "INFO"
        
        return $true
    }
    catch {
        Write-Log "WinRM configuration failed: $_" "ERROR"
        return $false
    }
}

# ============================================
# PHASE 4: CONFIGURE LOCAL FIREWALL FOR SCANNING
# ============================================
function Set-ScannerFirewallRules {
    Write-Log "=== PHASE 4: Configuring Additional Firewall Rules ===" "INFO"
    
    try {
        # Allow ICMP (ping) for network discovery
        Write-Log "Enabling ICMP (ping) responses..." "INFO"
        $icmpRule = Get-NetFirewallRule -DisplayName "Scanner-ICMP-Allow" -ErrorAction SilentlyContinue
        if (-not $icmpRule) {
            New-NetFirewallRule -DisplayName "Scanner-ICMP-Allow" `
                -Direction Inbound `
                -Protocol ICMPv4 `
                -Action Allow `
                -Profile Any `
                -Description "Allow ICMP for Security Scanner discovery"
        }
        
        # Allow PowerShell remoting
        Write-Log "Enabling PowerShell remoting firewall rules..." "INFO"
        Enable-NetFirewallRule -DisplayGroup "Remote Service Management" -ErrorAction SilentlyContinue
        
        Write-Log "Firewall rules configured successfully" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "Firewall configuration warning: $_" "WARN"
        return $true  # Non-critical, continue anyway
    }
}

# ============================================
# MAIN EXECUTION
# ============================================
function Main {
    Write-Log "========================================" "INFO"
    Write-Log "  Security Dashboard - Client Join     " "INFO"
    Write-Log "========================================" "INFO"
    Write-Log "Log file: $LogFile" "INFO"
    
    # Verify administrator privileges
    if (-not (Test-Administrator)) {
        Write-Log "This script must be run as Administrator!" "ERROR"
        exit 1
    }
    
    # Phase 1: Configure DNS
    $step1 = Set-DomainDNS
    if (-not $step1) {
        Write-Log "DNS configuration failed. Aborting." "ERROR"
        exit 1
    }
    
    # Phase 2: Enable WinRM first (needed before domain join in some cases)
    $step2 = Enable-WinRMClient
    if (-not $step2) {
        Write-Log "WinRM configuration failed, but continuing..." "WARN"
    }
    
    # Phase 3: Configure firewall
    $step3 = Set-ScannerFirewallRules
    
    # Phase 4: Join domain
    $step4 = Join-DomainNetwork
    if (-not $step4) {
        Write-Log "Domain join failed. Please check:" "ERROR"
        Write-Log "  1. Domain Controller is running (192.168.1.50)" "INFO"
        Write-Log "  2. DNS is pointing to DC" "INFO"
        Write-Log "  3. Correct credentials" "INFO"
        exit 1
    }
    
    Write-Log "========================================" "SUCCESS"
    Write-Log "  CLIENT SETUP COMPLETE!               " "SUCCESS"
    Write-Log "========================================" "SUCCESS"
    Write-Log "Domain: $DomainName" "INFO"
    Write-Log "The computer will restart in 30 seconds..." "WARN"
    Write-Log "After restart, log in with domain credentials" "INFO"
    
    # Countdown and restart
    Write-Log "Press Ctrl+C to cancel restart..." "WARN"
    Start-Sleep -Seconds 10
    
    Write-Log "Restarting computer..." "WARN"
    Restart-Computer -Force
}

# Run main function
Main
