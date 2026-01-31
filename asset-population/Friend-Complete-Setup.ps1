# ============================================
# COMPLETE SETUP FOR FRIEND - FINAL VERSION
# ============================================
# THIS IS ALL YOUR FRIEND NEEDS TO DO!

Write-Host "`n╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   COMPLETE DOMAIN JOIN - AUTOMATED SETUP          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`n⚠️  REQUIREMENT: Be on the SAME Wi-Fi as admin!" -ForegroundColor Yellow
Write-Host "   Network must be: 192.168.18.x" -ForegroundColor Yellow

$DCIP = "192.168.18.100"
$Domain = "meezan.local"
$AdminUser = "MEEZAN\Administrator"
$AdminPassword = "Password123"

# ============================================
# STEP 1: NETWORK CHECK
# ============================================
Write-Host "`n[STEP 1/5] Checking Network..." -ForegroundColor Cyan

$myIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.18.*"}).IPAddress

if ($myIP) {
    Write-Host "✅ Connected to correct network: $myIP" -ForegroundColor Green
} else {
    Write-Host "❌ NOT on 192.168.18.x network!" -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
    Write-Host "YOU MUST:" -ForegroundColor Yellow
    Write-Host "1. Connect to admin's Wi-Fi" -ForegroundColor White
    Write-Host "2. Ask admin for Wi-Fi password" -ForegroundColor White
    Write-Host "3. Run this script again" -ForegroundColor White
    Write-Host "" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ============================================
# STEP 2: TEST DC
# ============================================
Write-Host "`n[STEP 2/5] Testing Domain Controller..." -ForegroundColor Cyan
Write-Host "DC IP: $DCIP" -ForegroundColor White

$pingTest = Test-Connection -ComputerName $DCIP -Count 2 -Quiet
if ($pingTest) {
    Write-Host "✅ DC is reachable" -ForegroundColor Green
} else {
    Write-Host "⚠️  Ping failed (trying port test...)" -ForegroundColor Yellow
}

$ldapTest = Test-NetConnection -ComputerName $DCIP -Port 389 -WarningAction SilentlyContinue -InformationLevel Quiet
if ($ldapTest) {
    Write-Host "✅ LDAP port 389 is accessible!" -ForegroundColor Green
} else {
    Write-Host "❌ Cannot reach DC!" -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
    Write-Host "CONTACT ADMIN:" -ForegroundColor Yellow
    Write-Host "- DC may be offline" -ForegroundColor White
    Write-Host "- Firewall may be blocking" -ForegroundColor White
    Write-Host "- Wrong network" -ForegroundColor White
    Write-Host "" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ============================================
# STEP 3: SET DNS
# ============================================
Write-Host "`n[STEP 3/5] Setting DNS to DC..." -ForegroundColor Cyan

$adapters = Get-NetAdapter | Where-Object {$_.Status -eq "Up"}
$dnsSet = $false

foreach ($adapter in $adapters) {
    try {
        Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses $DCIP -ErrorAction Stop
        Write-Host "✅ DNS set on: $($adapter.Name)" -ForegroundColor Green
        $dnsSet = $true
    } catch {
        Write-Host "⚠️  Skipped: $($adapter.Name)" -ForegroundColor Yellow
    }
}

if (-not $dnsSet) {
    Write-Host "❌ Could not set DNS!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Start-Sleep -Seconds 2

# Verify DNS
$verifyDNS = (Get-DnsClientServerAddress | Where-Object {$_.ServerAddresses -contains $DCIP}).ServerAddresses
if ($verifyDNS) {
    Write-Host "✅ DNS verified: $DCIP" -ForegroundColor Green
}

# ============================================
# STEP 4: TEST DOMAIN
# ============================================
Write-Host "`n[STEP 4/5] Testing Domain Controller..." -ForegroundColor Cyan

try {
    $dcTest = nltest /dsgetdc:$Domain 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Domain controller is responding!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Domain test failed (will try to join anyway...)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not test domain (will try to join anyway...)" -ForegroundColor Yellow
}

# ============================================
# STEP 5: JOIN DOMAIN
# ============================================
Write-Host "`n[STEP 5/5] Joining Domain..." -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "Domain: $Domain" -ForegroundColor White
Write-Host "Admin: $AdminUser" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "⚠️  YOUR COMPUTER WILL RESTART!" -ForegroundColor Yellow
Write-Host "" -ForegroundColor White

$confirm = Read-Host "Continue? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nJoining domain (please wait)..." -ForegroundColor Cyan

$securePassword = ConvertTo-SecureString $AdminPassword -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($AdminUser, $securePassword)

try {
    Add-Computer -DomainName $Domain -Credential $credential -Restart -Force
    Write-Host "✅ SUCCESS! Restarting now..." -ForegroundColor Green
} catch {
    Write-Host "❌ FAILED: $_" -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "1. Check you're on 192.168.18.x network" -ForegroundColor White
    Write-Host "2. Verify DC is at: $DCIP" -ForegroundColor White
    Write-Host "3. Test: ping $DCIP" -ForegroundColor White
    Write-Host "4. Test: Test-NetConnection $DCIP -Port 389" -ForegroundColor White
    Write-Host "5. Contact admin!" -ForegroundColor White
    Write-Host "" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  AFTER RESTART, LOGIN WITH:" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Username: $AdminUser" -ForegroundColor Cyan
Write-Host "Password: $AdminPassword" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Green
if ($pingResult) {
    Write-Host "✅ Ping successful!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Ping failed (might be normal if ICMP blocked)" -ForegroundColor Yellow
}

# Test LDAP port
Write-Host "Testing LDAP port 389..." -ForegroundColor Gray
$ldapTest = Test-NetConnection -ComputerName $DCTailscaleIP -Port 389 -WarningAction SilentlyContinue
if ($ldapTest.TcpTestSucceeded) {
    Write-Host "✅ LDAP port accessible!" -ForegroundColor Green
} else {
    Write-Host "❌ LDAP port not accessible!" -ForegroundColor Red
    Write-Host "   Ask admin to check DC firewall and Tailscale connection" -ForegroundColor Yellow
    Read-Host "`nPress Enter to continue anyway"
}

Write-Host "`n[STEP 4/5] Configuring DNS" -ForegroundColor Yellow
Write-Host "Setting DNS to point to DC..." -ForegroundColor Gray

# Get all network adapters
$adapters = Get-NetAdapter | Where-Object {$_.Status -eq "Up"}
foreach ($adapter in $adapters) {
    try {
        Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses $DCTailscaleIP
        Write-Host "✅ Set DNS on: $($adapter.Name)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Could not set DNS on: $($adapter.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`n[STEP 5/5] Joining Domain" -ForegroundColor Yellow
Write-Host "Domain: $Domain" -ForegroundColor Cyan
Write-Host "Admin: $AdminUser" -ForegroundColor Cyan

$securePassword = ConvertTo-SecureString $AdminPassword -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($AdminUser, $securePassword)

Write-Host "`nJoining domain (this will restart your computer)..." -ForegroundColor Yellow
try {
    Add-Computer -DomainName $Domain -Credential $credential -Restart -Force
    Write-Host "✅ Domain join initiated! Computer will restart..." -ForegroundColor Green
} catch {
    Write-Host "❌ Domain join failed: $_" -ForegroundColor Red
    Write-Host "`n🔧 TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "1. Verify DC is online (ask admin)" -ForegroundColor White
    Write-Host "2. Check credentials: $AdminUser / $AdminPassword" -ForegroundColor White
    Write-Host "3. Test: nltest /dsgetdc:$Domain" -ForegroundColor White
    Write-Host "4. Verify DNS: Get-DnsClientServerAddress" -ForegroundColor White
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "After restart, login with:" -ForegroundColor Yellow
Write-Host "Username: $AdminUser" -ForegroundColor Cyan
Write-Host "Password: $AdminPassword" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
