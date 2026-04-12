#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Active Directory Domain Controller Quick Setup
    
.DESCRIPTION
    Run this script INSIDE the Windows Server VM to set up Active Directory.
    This will install AD DS, configure networking, and promote to Domain Controller.
    
.NOTES
    COPY THIS FILE INTO THE VM AND RUN AS ADMINISTRATOR
#>

$ErrorActionPreference = "Stop"

Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                              ║" -ForegroundColor Cyan
Write-Host "║    ACTIVE DIRECTORY DOMAIN CONTROLLER SETUP - AUTOMATED      ║" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Step 1: Install AD Domain Services
Write-Host "Step 1: Installing Active Directory Domain Services..." -ForegroundColor Yellow
try {
    Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools
    Write-Host "✓ AD DS installed successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to install AD DS: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Configure Static IP
Write-Host "`nStep 2: Configuring Static IP Address (192.168.1.50)..." -ForegroundColor Yellow
try {
    $adapter = Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1
    
    # Remove existing IP configuration
    Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue
    
    # Set new static IP
    New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress "192.168.1.50" -PrefixLength 24 -DefaultGateway "192.168.1.1" -ErrorAction SilentlyContinue
    
    # Set DNS to localhost
    Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses "127.0.0.1"
    
    Write-Host "✓ Static IP configured: 192.168.1.50" -ForegroundColor Green
    Write-Host "✓ DNS set to: 127.0.0.1" -ForegroundColor Green
} catch {
    Write-Host "⚠ IP configuration warning: $_" -ForegroundColor Yellow
    Write-Host "Continuing with installation..." -ForegroundColor Gray
}

# Step 3: Promote to Domain Controller
Write-Host "`nStep 3: Promoting to Domain Controller..." -ForegroundColor Yellow
Write-Host "Domain: meezan.local" -ForegroundColor Gray
Write-Host "NetBIOS: MEEZAN" -ForegroundColor Gray
Write-Host "`nThis will take ~5-10 minutes and the server will REBOOT automatically.`n" -ForegroundColor Cyan

try {
    $SecurePassword = ConvertTo-SecureString "Password123" -AsPlainText -Force
    
    Install-ADDSForest `
        -DomainName "meezan.local" `
        -DomainNetbiosName "MEEZAN" `
        -SafeModeAdministratorPassword $SecurePassword `
        -InstallDns `
        -NoRebootOnCompletion:$false `
        -Force:$true
    
    Write-Host "✓ Domain Controller promotion initiated!" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to promote to DC: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "║              SETUP COMPLETE - SERVER REBOOTING               ║" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "After reboot, login with:" -ForegroundColor Cyan
Write-Host "  Username: MEEZAN\Administrator" -ForegroundColor White
Write-Host "  Password: Password123`n" -ForegroundColor White
