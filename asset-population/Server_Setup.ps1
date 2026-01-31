#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Server Setup Script for Security Dashboard Asset Population
    
.DESCRIPTION
    This script configures a Windows Server 2022 as an Active Directory Domain Controller
    for the meezan.local domain, sets up networking, and creates a service account for scanning.
    
.NOTES
    Run this script on Node 1 (Server) with Administrator privileges.
    Target IP: 192.168.1.50
    Domain: meezan.local
#>

param(
    [string]$StaticIP = "192.168.1.50",
    [string]$SubnetMask = "255.255.255.0",
    [int]$PrefixLength = 24,
    [string]$Gateway = "192.168.1.1",
    [string]$DomainName = "meezan.local",
    [string]$NetBIOSName = "MEEZAN",
    [string]$ServiceAccountName = "svc_scanner",
    [string]$ServiceAccountPassword = "CyberSec2025!"
)

# Script configuration
$ErrorActionPreference = "Stop"
$LogFile = "$env:TEMP\Server_Setup_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

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
# PHASE 1: NETWORK CONFIGURATION
# ============================================
function Set-StaticNetworkConfiguration {
    Write-Log "=== PHASE 1: Network Configuration ===" "INFO"
    
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
        
        # Remove existing IP configuration
        Write-Log "Removing existing IP configuration..." "INFO"
        Remove-NetIPAddress -InterfaceIndex $adapterIndex -Confirm:$false -ErrorAction SilentlyContinue
        Remove-NetRoute -InterfaceIndex $adapterIndex -Confirm:$false -ErrorAction SilentlyContinue
        
        # Set static IP
        Write-Log "Setting static IP: $StaticIP/$PrefixLength" "INFO"
        New-NetIPAddress -InterfaceIndex $adapterIndex `
            -IPAddress $StaticIP `
            -PrefixLength $PrefixLength `
            -DefaultGateway $Gateway
        
        # Set DNS to localhost (this server will be DNS after DC promotion)
        Write-Log "Setting DNS to 127.0.0.1 (localhost)" "INFO"
        Set-DnsClientServerAddress -InterfaceIndex $adapterIndex -ServerAddresses @("127.0.0.1", "8.8.8.8")
        
        # Verify configuration
        $newIP = Get-NetIPAddress -InterfaceIndex $adapterIndex -AddressFamily IPv4
        Write-Log "Network configuration complete. IP: $($newIP.IPAddress)" "SUCCESS"
        
        return $true
    }
    catch {
        Write-Log "Network configuration failed: $_" "ERROR"
        return $false
    }
}

# ============================================
# PHASE 2: INSTALL AD DS FEATURES
# ============================================
function Install-ADDSFeatures {
    Write-Log "=== PHASE 2: Installing AD DS Features ===" "INFO"
    
    try {
        # Check if features are already installed
        $addsFeature = Get-WindowsFeature -Name AD-Domain-Services
        $gpmcFeature = Get-WindowsFeature -Name GPMC
        
        if ($addsFeature.Installed -and $gpmcFeature.Installed) {
            Write-Log "AD DS and GPMC features already installed" "SUCCESS"
            return $true
        }
        
        # Install AD Domain Services
        Write-Log "Installing AD-Domain-Services feature..." "INFO"
        $addsResult = Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools -IncludeAllSubFeature
        
        if ($addsResult.Success) {
            Write-Log "AD-Domain-Services installed successfully" "SUCCESS"
        } else {
            throw "AD-Domain-Services installation failed"
        }
        
        # Install Group Policy Management Console
        Write-Log "Installing GPMC feature..." "INFO"
        $gpmcResult = Install-WindowsFeature -Name GPMC -IncludeManagementTools
        
        if ($gpmcResult.Success) {
            Write-Log "GPMC installed successfully" "SUCCESS"
        } else {
            throw "GPMC installation failed"
        }
        
        # Install DNS Server (required for AD DS)
        Write-Log "Installing DNS Server feature..." "INFO"
        $dnsResult = Install-WindowsFeature -Name DNS -IncludeManagementTools
        
        if ($dnsResult.Success) {
            Write-Log "DNS Server installed successfully" "SUCCESS"
        }
        
        return $true
    }
    catch {
        Write-Log "Feature installation failed: $_" "ERROR"
        return $false
    }
}

# ============================================
# PHASE 3: PROMOTE TO DOMAIN CONTROLLER
# ============================================
function Promote-ToDomainController {
    Write-Log "=== PHASE 3: Promoting to Domain Controller ===" "INFO"
    
    try {
        # Check if already a DC
        $dcInfo = Get-ADDomainController -ErrorAction SilentlyContinue
        if ($dcInfo) {
            Write-Log "This server is already a Domain Controller for $($dcInfo.Domain)" "SUCCESS"
            return $true
        }
    }
    catch {
        Write-Log "Server is not yet a Domain Controller, proceeding with promotion..." "INFO"
    }
    
    try {
        # Import AD DS Deployment module
        Import-Module ADDSDeployment
        
        # Generate Safe Mode Administrator Password
        $safeModePassword = ConvertTo-SecureString "SafeMode2025!" -AsPlainText -Force
        
        Write-Log "Promoting server to Domain Controller for forest: $DomainName" "INFO"
        Write-Log "NetBIOS Name: $NetBIOSName" "INFO"
        
        # Install AD DS Forest
        Install-ADDSForest `
            -DomainName $DomainName `
            -DomainNetbiosName $NetBIOSName `
            -DomainMode "WinThreshold" `
            -ForestMode "WinThreshold" `
            -DatabasePath "C:\Windows\NTDS" `
            -LogPath "C:\Windows\NTDS" `
            -SysvolPath "C:\Windows\SYSVOL" `
            -SafeModeAdministratorPassword $safeModePassword `
            -InstallDns:$true `
            -CreateDnsDelegation:$false `
            -NoRebootOnCompletion:$false `
            -Force:$true
        
        Write-Log "Domain Controller promotion initiated. Server will restart automatically." "SUCCESS"
        return $true
    }
    catch {
        Write-Log "DC promotion failed: $_" "ERROR"
        return $false
    }
}

# ============================================
# PHASE 4: CREATE SERVICE ACCOUNT
# ============================================
function New-ScannerServiceAccount {
    Write-Log "=== PHASE 4: Creating Service Account ===" "INFO"
    
    try {
        # Import AD module
        Import-Module ActiveDirectory
        
        # Check if user already exists
        $existingUser = Get-ADUser -Filter "SamAccountName -eq '$ServiceAccountName'" -ErrorAction SilentlyContinue
        if ($existingUser) {
            Write-Log "Service account '$ServiceAccountName' already exists" "SUCCESS"
            return $true
        }
        
        # Create secure password
        $securePassword = ConvertTo-SecureString $ServiceAccountPassword -AsPlainText -Force
        
        # Create service account
        Write-Log "Creating service account: $ServiceAccountName" "INFO"
        New-ADUser `
            -Name $ServiceAccountName `
            -SamAccountName $ServiceAccountName `
            -UserPrincipalName "$ServiceAccountName@$DomainName" `
            -AccountPassword $securePassword `
            -Enabled $true `
            -PasswordNeverExpires $true `
            -CannotChangePassword $true `
            -Description "Service account for Security Dashboard Asset Scanner"
        
        Write-Log "Service account created successfully" "SUCCESS"
        
        # Add to Remote Management Users group
        Write-Log "Adding $ServiceAccountName to 'Remote Management Users' group..." "INFO"
        Add-ADGroupMember -Identity "Remote Management Users" -Members $ServiceAccountName
        Write-Log "Added to 'Remote Management Users' group" "SUCCESS"
        
        # Also add to Domain Admins for full scan capabilities (optional, adjust as needed)
        Write-Log "Adding $ServiceAccountName to 'Domain Admins' group for full scan access..." "INFO"
        Add-ADGroupMember -Identity "Domain Admins" -Members $ServiceAccountName
        Write-Log "Added to 'Domain Admins' group" "SUCCESS"
        
        return $true
    }
    catch {
        Write-Log "Service account creation failed: $_" "ERROR"
        return $false
    }
}

# ============================================
# PHASE 5: CONFIGURE WINRM ON SERVER
# ============================================
function Enable-WinRMServer {
    Write-Log "=== PHASE 5: Configuring WinRM ===" "INFO"
    
    try {
        # Enable WinRM
        Write-Log "Enabling WinRM service..." "INFO"
        Enable-PSRemoting -Force -SkipNetworkProfileCheck
        
        # Start WinRM service
        Set-Service -Name WinRM -StartupType Automatic
        Start-Service -Name WinRM
        
        # Configure WinRM for remote management
        Write-Log "Configuring WinRM listener..." "INFO"
        winrm quickconfig -force
        
        # Set trusted hosts (allow all for lab environment)
        Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
        
        # Configure firewall rule
        Write-Log "Adding firewall rule for WinRM (Port 5985)..." "INFO"
        $existingRule = Get-NetFirewallRule -DisplayName "WinRM-HTTP-In-TCP" -ErrorAction SilentlyContinue
        if (-not $existingRule) {
            New-NetFirewallRule -DisplayName "WinRM-HTTP-In-TCP" `
                -Direction Inbound `
                -Protocol TCP `
                -LocalPort 5985 `
                -Action Allow `
                -Profile Any `
                -Description "Allow WinRM HTTP traffic for Security Scanner"
        }
        
        # Verify WinRM is running
        $winrmStatus = Get-Service -Name WinRM
        if ($winrmStatus.Status -eq "Running") {
            Write-Log "WinRM configured and running successfully" "SUCCESS"
            return $true
        }
        else {
            throw "WinRM service is not running"
        }
    }
    catch {
        Write-Log "WinRM configuration failed: $_" "ERROR"
        return $false
    }
}

# ============================================
# MAIN EXECUTION
# ============================================
function Main {
    Write-Log "========================================" "INFO"
    Write-Log "  Security Dashboard - Server Setup    " "INFO"
    Write-Log "========================================" "INFO"
    Write-Log "Log file: $LogFile" "INFO"
    
    # Verify administrator privileges
    if (-not (Test-Administrator)) {
        Write-Log "This script must be run as Administrator!" "ERROR"
        exit 1
    }
    
    # Check if this is a post-reboot run (DC already configured)
    $isDC = $false
    try {
        Import-Module ActiveDirectory -ErrorAction SilentlyContinue
        $dcInfo = Get-ADDomainController -ErrorAction SilentlyContinue
        $isDC = $true
        Write-Log "Detected running as Domain Controller for: $($dcInfo.Domain)" "SUCCESS"
    }
    catch {
        $isDC = $false
    }
    
    if ($isDC) {
        # Post-reboot: Create service account and configure WinRM
        Write-Log "Running post-reboot configuration..." "INFO"
        
        $step4 = New-ScannerServiceAccount
        $step5 = Enable-WinRMServer
        
        if ($step4 -and $step5) {
            Write-Log "========================================" "SUCCESS"
            Write-Log "  SERVER SETUP COMPLETE!               " "SUCCESS"
            Write-Log "========================================" "SUCCESS"
            Write-Log "Domain: $DomainName" "INFO"
            Write-Log "Service Account: $ServiceAccountName" "INFO"
            Write-Log "Next: Run Client_Join.ps1 on client machines" "INFO"
        }
    }
    else {
        # Pre-reboot: Network, install features, promote DC
        $step1 = Set-StaticNetworkConfiguration
        if (-not $step1) {
            Write-Log "Network configuration failed. Aborting." "ERROR"
            exit 1
        }
        
        $step2 = Install-ADDSFeatures
        if (-not $step2) {
            Write-Log "Feature installation failed. Aborting." "ERROR"
            exit 1
        }
        
        # Create scheduled task to run this script again after reboot
        Write-Log "Creating scheduled task for post-reboot configuration..." "INFO"
        $scriptPath = $MyInvocation.MyCommand.Path
        if ($scriptPath) {
            $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
            $trigger = New-ScheduledTaskTrigger -AtLogOn
            $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
            Register-ScheduledTask -TaskName "SecurityDashboard_PostSetup" -Action $action -Trigger $trigger -Principal $principal -Force
            Write-Log "Scheduled task created for post-reboot setup" "SUCCESS"
        }
        
        Write-Log "Promoting to Domain Controller (server will restart)..." "WARN"
        $step3 = Promote-ToDomainController
        
        # If we reach here without restart, something went wrong
        if (-not $step3) {
            Write-Log "DC promotion failed. Check logs." "ERROR"
            exit 1
        }
    }
}

# Run main function
Main
