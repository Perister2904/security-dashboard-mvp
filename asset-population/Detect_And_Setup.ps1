#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Automatic Detection and Real AD Setup
    
.DESCRIPTION
    Detects your environment and sets up the best real AD solution automatically.
#>

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Real AD Environment Detection" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if we're running as admin
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ ERROR: This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "   Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Running as Administrator" -ForegroundColor Green

# Detect OS
$os = Get-CimInstance Win32_OperatingSystem
$osName = $os.Caption
$isServer = $osName -like "*Server*"

Write-Host "`n📊 System Information:" -ForegroundColor Cyan
Write-Host "   OS: $osName" -ForegroundColor White
Write-Host "   Architecture: $($os.OSArchitecture)" -ForegroundColor White
Write-Host "   Build: $($os.BuildNumber)" -ForegroundColor White

if ($isServer) {
    Write-Host "`n✓ Windows Server detected! Can install AD DS directly." -ForegroundColor Green
    
    $install = Read-Host "`nInstall Active Directory Domain Services now? (y/n)"
    
    if ($install -eq 'y' -or $install -eq 'Y') {
        Write-Host "`n🚀 Starting Server Setup..." -ForegroundColor Green
        .\Server_Setup.ps1
    }
} else {
    Write-Host "`n⚠️  Windows Client detected. Cannot install AD DS directly." -ForegroundColor Yellow
    Write-Host "   Checking virtualization options...`n" -ForegroundColor Yellow
    
    # Check Hyper-V availability
    try {
        $hyperV = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -ErrorAction Stop
        $hyperVInstalled = $hyperV.State -eq "Enabled"
        
        if ($hyperVInstalled) {
            Write-Host "✓ Hyper-V is installed and enabled" -ForegroundColor Green
            Write-Host "`n🎯 OPTION 1: Create Windows Server VM in Hyper-V" -ForegroundColor Cyan
            Write-Host "   1. Download Windows Server 2022 ISO" -ForegroundColor White
            Write-Host "   2. Create VM with 4GB RAM" -ForegroundColor White
            Write-Host "   3. Install Windows Server in VM" -ForegroundColor White
            Write-Host "   4. Run Server_Setup.ps1 inside VM`n" -ForegroundColor White
        } else {
            Write-Host "⚠️  Hyper-V is not enabled" -ForegroundColor Yellow
            
            $enableHyperV = Read-Host "`nEnable Hyper-V now? (requires reboot) (y/n)"
            
            if ($enableHyperV -eq 'y' -or $enableHyperV -eq 'Y') {
                Write-Host "`nEnabling Hyper-V..." -ForegroundColor Green
                Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -NoRestart
                
                Write-Host "✓ Hyper-V enabled. Please reboot your computer." -ForegroundColor Green
                Write-Host "  After reboot, run this script again.`n" -ForegroundColor Yellow
                exit 0
            }
        }
    }
    catch {
        Write-Host "✗ Hyper-V not available on this system" -ForegroundColor Red
    }
    
    # Check for existing AD connectivity
    Write-Host "`n🎯 OPTION 2: Connect to Existing Active Directory" -ForegroundColor Cyan
    Write-Host "   If you have access to a corporate/school AD:`n" -ForegroundColor White
    
    $hasAD = Read-Host "Do you have access to an existing Active Directory? (y/n)"
    
    if ($hasAD -eq 'y' -or $hasAD -eq 'Y') {
        Write-Host "`n📝 Enter AD Connection Details:" -ForegroundColor Cyan
        
        $domain = Read-Host "   Domain name (e.g., company.com)"
        $dcIP = Read-Host "   Domain Controller IP"
        $username = Read-Host "   Username (e.g., scanner-svc)"
        $password = Read-Host "   Password" -AsSecureString
        $passwordText = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
        
        Write-Host "`n🧪 Testing AD connection..." -ForegroundColor Yellow
        
        try {
            $testResult = python Asset_Scanner.py `
                --domain "$domain" `
                --dc-ip "$dcIP" `
                --username "$username" `
                --password "$passwordText" `
                --quiet
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Successfully connected to Active Directory!" -ForegroundColor Green
                Write-Host "`n📊 Running full scan..." -ForegroundColor Green
                
                python Asset_Scanner.py `
                    --domain "$domain" `
                    --dc-ip "$dcIP" `
                    --username "$username" `
                    --password "$passwordText" `
                    --output "real_ad_scan_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
                
                Write-Host "`n✅ Real AD scan complete!" -ForegroundColor Green
            } else {
                Write-Host "✗ Failed to connect to AD" -ForegroundColor Red
            }
        }
        catch {
            Write-Host "✗ Connection test failed: $_" -ForegroundColor Red
        }
    }
    
    # Option 3: VirtualBox
    Write-Host "`n🎯 OPTION 3: Use VirtualBox" -ForegroundColor Cyan
    Write-Host "   1. Download VirtualBox from virtualbox.org" -ForegroundColor White
    Write-Host "   2. Download Windows Server 2022 ISO" -ForegroundColor White
    Write-Host "   3. Create VM and run Server_Setup.ps1`n" -ForegroundColor White
    
    Write-Host "📖 For detailed instructions, see:" -ForegroundColor Cyan
    Write-Host "   • REAL_AD_DEPLOYMENT.md" -ForegroundColor White
    Write-Host "   • TEST_WITHOUT_HARDWARE.md`n" -ForegroundColor White
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Detection Complete" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
