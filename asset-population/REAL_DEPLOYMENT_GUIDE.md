# 🚀 REAL DEPLOYMENT GUIDE - Physical Machines

## Overview
This guide walks you through deploying a **real Active Directory environment** on physical Windows machines for asset scanning and security dashboard population.

---

## 🎯 What You'll Build

**Real Production Environment:**
- ✅ Windows Server 2022 Domain Controller
- ✅ Multiple Windows 10/11 clients joined to domain
- ✅ Automated asset scanning every hour
- ✅ Real compliance data (antivirus, updates, security)
- ✅ Live data feed to your dashboard

---

## 📋 Prerequisites Checklist

### Hardware Requirements
- [ ] **1x Windows Server 2022** laptop/desktop (Node 1 - Server)
- [ ] **1+ Windows 10/11** laptops/desktops (Node 2+ - Clients)
- [ ] All machines connected to **same Wi-Fi network**
- [ ] At least 4GB RAM per machine
- [ ] Administrator access on all machines

### Network Requirements
- [ ] Wi-Fi network: `192.168.1.0/24` subnet (or any local subnet)
- [ ] Gateway: `192.168.1.1` (your router)
- [ ] Server will use: `192.168.1.50` (static IP)
- [ ] Clients will use: DHCP (automatic)
- [ ] **No internet firewall blocking local traffic**

### Software Requirements
- [ ] Windows Server 2022 on Node 1
- [ ] Windows 10/11 Pro or Enterprise on clients (Home edition **won't work**)
- [ ] Python 3.9+ on Server (download from python.org)
- [ ] Asset-population.zip file transferred to all machines

---

## 🚀 Deployment Steps

### Step 1: Transfer Files to All Machines

#### Option A: USB Drive (Easiest)
1. Copy `asset-population.zip` to USB drive
2. Insert USB into each laptop
3. Copy to `C:\asset-population\` on each machine
4. Extract the zip file

#### Option B: Network Share
1. On your Linux machine, create a share:
   ```bash
   cd /home/harister/security-dashboard-mvp
   python3 -m http.server 8000
   ```
2. On Windows machines, download:
   ```powershell
   # Get your Linux machine's IP (e.g., 192.168.1.100)
   Invoke-WebRequest -Uri "http://192.168.1.100:8000/asset-population.zip" -OutFile "C:\asset-population.zip"
   Expand-Archive -Path "C:\asset-population.zip" -DestinationPath "C:\asset-population"
   ```

#### Option C: Cloud Storage
1. Upload `asset-population.zip` to Google Drive/Dropbox
2. Download on each Windows machine
3. Extract to `C:\asset-population\`

---

### Step 2: Server Setup (Node 1 - Windows Server 2022)

**⏱️ Estimated Time: 15 minutes + 2 automatic reboots**

#### 2.1 Open PowerShell as Administrator
```powershell
# Right-click Start Menu → "Windows PowerShell (Admin)"
```

#### 2.2 Navigate to folder
```powershell
cd C:\asset-population
```

#### 2.3 Run Server Setup Script
```powershell
# Allow script execution
Set-ExecutionPolicy Bypass -Scope Process -Force

# Run the setup
.\Server_Setup.ps1
```

#### 2.4 What Happens Next
1. **Network Configuration** (2 min)
   - Sets static IP to `192.168.1.50`
   - Configures DNS to `127.0.0.1`
   
2. **Install AD DS** (3 min)
   - Installs Active Directory Domain Services
   - Installs DNS Server
   - Installs Group Policy Management

3. **Promote to Domain Controller** (5 min)
   - **⚠️ YOU WILL BE PROMPTED FOR PASSWORD!**
   - Enter a strong password (e.g., `Admin@2026!`)
   - **REMEMBER THIS PASSWORD!** You'll need it for client join
   - Creates domain: `meezan.local`
   
4. **🔄 AUTOMATIC REBOOT #1** (Server restarts)

5. **Post-Reboot Configuration** (3 min)
   - Script automatically continues
   - Creates service account: `svc_scanner`
   - Configures WinRM for remote management
   
6. **🔄 AUTOMATIC REBOOT #2** (Server restarts again)

7. **✅ SETUP COMPLETE!**

#### 2.5 Verify Server Setup
After the second reboot:
```powershell
# Open PowerShell as Administrator

# Check Domain Controller status
Get-ADDomainController
# Should show: meezan.local with IP 192.168.1.50

# Check Service Account
Get-ADUser svc_scanner
# Should show: svc_scanner account details

# Check WinRM service
Get-Service WinRM
# Should show: Running

# Test DNS
nslookup meezan.local
# Should resolve to 192.168.1.50
```

**✅ If all commands succeed, server is ready!**

---

### Step 3: Client Join (Node 2+ - Windows 10/11)

**⏱️ Estimated Time: 5 minutes per client + 1 automatic reboot**

**🚨 IMPORTANT:** 
- Run this on **each client laptop** you want to scan
- Server must be fully set up first (Step 2 complete)
- Client must be Windows 10/11 **Pro or Enterprise** (not Home)

#### 3.1 Open PowerShell as Administrator
```powershell
# Right-click Start Menu → "Windows PowerShell (Admin)"
```

#### 3.2 Navigate to folder
```powershell
cd C:\asset-population
```

#### 3.3 Run Client Join Script
```powershell
# Allow script execution
Set-ExecutionPolicy Bypass -Scope Process -Force

# Run the join script
.\Client_Join.ps1
```

#### 3.4 Enter Credentials When Prompted
```
Username: meezan.local\Administrator
Password: [The password you set during DC promotion in Step 2.3]
```

#### 3.5 What Happens Next
1. **Configure DNS** (1 min)
   - Points DNS to `192.168.1.50` (the server)
   - Tests domain connectivity

2. **Enable WinRM** (1 min)
   - Enables remote management service
   - Configures firewall rules

3. **Join Domain** (2 min)
   - Joins `meezan.local` domain
   - Configures computer account in AD

4. **🔄 AUTOMATIC REBOOT** (Client restarts)

5. **✅ CLIENT JOINED!**

#### 3.6 Verify Client Join
After reboot, log in with domain account:
- Username: `meezan.local\Administrator`
- Password: [Your domain password]

Then verify:
```powershell
# Open PowerShell

# Check domain membership
(Get-WmiObject Win32_ComputerSystem).Domain
# Should show: meezan.local

# Check WinRM
Get-Service WinRM
# Should show: Running
```

**✅ Repeat Step 3 on EVERY client laptop you want to scan!**

---

### Step 4: Install Python on Server

**⏱️ Estimated Time: 5 minutes**

#### 4.1 Download Python
On Node 1 (Server), open browser and go to:
```
https://www.python.org/downloads/
```

Download **Python 3.12** (or latest 3.x)

#### 4.2 Install Python
1. Run installer
2. ✅ **CHECK "Add Python to PATH"** (important!)
3. Click "Install Now"
4. Wait for installation

#### 4.3 Verify Installation
```powershell
# Open new PowerShell window
python --version
# Should show: Python 3.12.x

pip --version
# Should show: pip 24.x
```

#### 4.4 Install Scanner Dependencies
```powershell
cd C:\asset-population
pip install -r requirements.txt
```

**Expected output:**
```
Installing collected packages: ldap3, pywinrm, requests
Successfully installed ldap3-2.9.1 pywinrm-0.4.3 requests-2.31.0
```

---

### Step 5: Run Asset Scanner

**⏱️ Estimated Time: 2 minutes**

#### 5.1 Basic Scan
```powershell
cd C:\asset-population
python Asset_Scanner.py
```

**Expected Output:**
```json
[
  {
    "asset_name": "DESKTOP-ABC123",
    "ip_address": "192.168.1.101",
    "compliance_status": "Compliant",
    "details": {
      "antivirus": true,
      "real_time_protection": true,
      "operating_system": "Windows 10 Pro",
      "last_scan": "2026-01-27T14:30:00Z"
    }
  },
  {
    "asset_name": "LAPTOP-XYZ789",
    "ip_address": "192.168.1.102",
    "compliance_status": "Non-Compliant",
    "details": {
      "antivirus": false,
      "real_time_protection": false,
      "operating_system": "Windows 11 Pro",
      "last_scan": "2026-01-27T14:30:05Z"
    }
  }
]
```

#### 5.2 Save to File
```powershell
python Asset_Scanner.py --output C:\scans\assets.json
```

#### 5.3 Verbose Mode (for debugging)
```powershell
python Asset_Scanner.py --verbose
```

#### 5.4 Scan Specific Computers
```powershell
python Asset_Scanner.py --computers "DESKTOP-ABC123,LAPTOP-XYZ789"
```

---

## 🔁 Automated Scanning (Every Hour)

### Option 1: Windows Task Scheduler (Recommended)

#### Create Scheduled Task
```powershell
# Run on Server
$action = New-ScheduledTaskAction -Execute "python.exe" -Argument "C:\asset-population\Asset_Scanner.py --output C:\scans\assets.json"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Register-ScheduledTask -TaskName "AssetScanner" -Action $action -Trigger $trigger -Principal $principal
```

**Verify:**
```powershell
Get-ScheduledTask -TaskName "AssetScanner"
```

### Option 2: Manual Script
Run `Schedule_Scanner.ps1` (included in package):
```powershell
.\Schedule_Scanner.ps1
```

---

## 📊 Integrate with Your Dashboard

### Method 1: Manual Import
1. Run scanner and save to file
2. Copy JSON file to your dashboard server
3. Import via dashboard UI

### Method 2: API Integration (Automated)
Use the provided `Push_To_Dashboard.ps1` script:

```powershell
# Edit the script to add your dashboard API endpoint
notepad Push_To_Dashboard.ps1

# Run the integration
.\Push_To_Dashboard.ps1
```

This will:
- Run the scanner
- POST results to your dashboard API
- Log success/failure

### Method 3: Database Direct Insert
Use `Database_Insert.py` (coming in next section)

---

## 🧪 Testing & Verification

### Test 1: Can Server See Clients?
```powershell
# On Server
Get-ADComputer -Filter * | Select-Object Name, DNSHostName
```

**Expected:**
```
Name            DNSHostName
----            -----------
SERVER-2022     SERVER-2022.meezan.local
DESKTOP-ABC123  DESKTOP-ABC123.meezan.local
LAPTOP-XYZ789   LAPTOP-XYZ789.meezan.local
```

### Test 2: Can Server Connect via WinRM?
```powershell
# On Server
Test-WSMan -ComputerName "DESKTOP-ABC123.meezan.local"
```

**Expected:** XML response (not an error)

### Test 3: Can Scanner Reach Clients?
```powershell
# On Server
python Asset_Scanner.py --test-connection
```

**Expected:**
```
✓ DESKTOP-ABC123: Reachable
✓ LAPTOP-XYZ789: Reachable
✗ WORKSTATION-OLD: Unreachable (offline)
```

---

## 🔥 Troubleshooting Common Issues

### Issue 1: "Cannot find domain meezan.local"

**Cause:** DNS not pointing to server

**Fix on Client:**
```powershell
# Manually set DNS
Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Set-DnsClientServerAddress -ServerAddresses "192.168.1.50","8.8.8.8"

# Test DNS
nslookup meezan.local
# Should resolve to 192.168.1.50
```

### Issue 2: "WinRM cannot connect"

**Cause:** Firewall blocking or WinRM not running

**Fix on Client:**
```powershell
# Enable WinRM
Enable-PSRemoting -Force

# Add firewall rule
New-NetFirewallRule -DisplayName "WinRM HTTP" -Direction Inbound -LocalPort 5985 -Protocol TCP -Action Allow

# Start service
Start-Service WinRM
Set-Service WinRM -StartupType Automatic
```

### Issue 3: Scanner shows "Host unreachable"

**Cause:** Client is offline or firewall blocking

**Fix:**
1. **Check client is powered on and connected to Wi-Fi**
2. **Ping from server:**
   ```powershell
   Test-Connection -ComputerName "DESKTOP-ABC123" -Count 2
   ```
3. **Check Windows Firewall on client:**
   ```powershell
   # On client
   Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled False  # Temporary!
   ```

### Issue 4: "ldap3 module not found"

**Cause:** Python dependencies not installed

**Fix on Server:**
```powershell
cd C:\asset-population
pip install --upgrade -r requirements.txt
```

### Issue 5: Domain password not working

**Cause:** Account locked or wrong password

**Fix on Server:**
```powershell
# Reset password for Administrator
Set-ADAccountPassword -Identity Administrator -Reset -NewPassword (ConvertTo-SecureString -AsPlainText "NewPass@2026!" -Force)

# Unlock account
Unlock-ADAccount -Identity Administrator
```

---

## 📂 File Locations After Setup

```
C:\asset-population\
├── Server_Setup.ps1          # Server setup script
├── Client_Join.ps1           # Client join script
├── Asset_Scanner.py          # Main scanner
├── Push_To_Dashboard.ps1     # API integration
├── Schedule_Scanner.ps1      # Task scheduler
├── Verify_Setup.ps1          # Verification script
├── requirements.txt          # Python dependencies
├── REAL_DEPLOYMENT_GUIDE.md  # This file
└── logs\
    └── asset_scanner.log     # Scanner logs

C:\scans\
└── assets.json               # Scan results (created by scanner)
```

---

## 🎯 Success Criteria

✅ **You've successfully deployed when:**
1. Server is promoted to Domain Controller (Step 2)
2. At least 1 client joined domain (Step 3)
3. Scanner retrieves data from clients (Step 5)
4. JSON output shows real compliance data
5. Scheduled task runs every hour

---

## 🆘 Get More Help

### Check Logs
```powershell
# Server setup logs
Get-Content $env:TEMP\Server_Setup_*.log -Tail 50

# Client join logs
Get-Content $env:TEMP\Client_Join_*.log -Tail 50

# Scanner logs
Get-Content C:\asset-population\asset_scanner.log -Tail 50
```

### Run Verification Script
```powershell
.\Verify_Setup.ps1
```

This checks:
- Domain Controller status
- Client connectivity
- WinRM functionality
- Python dependencies
- Network configuration

---

## 🚀 Next Steps

1. **Add more clients** - Repeat Step 3 on additional laptops
2. **Configure dashboard** - Integrate scanner output with your UI
3. **Monitor compliance** - Watch for non-compliant assets
4. **Create alerts** - Set up email notifications for critical findings
5. **Schedule reports** - Generate weekly executive summaries

---

## 📌 Important Notes

- **Domain Admin Password:** Keep it safe! You'll need it for all domain operations
- **Service Account:** `svc_scanner` / `CyberSec2025!` - Used by scanner only
- **Static IP:** Server must always be at `192.168.1.50`
- **Backups:** Consider backing up AD regularly
- **Production Use:** This is a lab setup - for production, add more security!

---

**Need help? Check the logs first, then run Verify_Setup.ps1 to diagnose issues!**
