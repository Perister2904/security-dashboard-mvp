# 🚀 Quick Start Guide

## Prerequisites
- Windows Server 2022 (Node 1 - Server)
- Windows 10/11 (Node 2 - Client)
- Both on same Wi-Fi network (192.168.1.0/24)
- Administrator access on both machines

## Setup Sequence (Total Time: ~20 minutes)

### ⏰ Step 1: Server Setup (10 minutes + 2 reboots)

On **Node 1 (Server)**:

```powershell
# Open PowerShell as Administrator
cd C:\path\to\asset-population
Set-ExecutionPolicy Bypass -Scope Process -Force
.\Server_Setup.ps1
```

**Wait for automatic reboot** (~5 min)

After reboot, the script auto-runs again to complete setup.

**Verify:**
```powershell
# Check Domain Controller status
Get-ADDomainController

# Check Service Account
Get-ADUser svc_scanner

# Check WinRM
Get-Service WinRM
```

### ⏰ Step 2: Client Join (5 minutes + 1 reboot)

On **Node 2 (Client)**:

```powershell
# Open PowerShell as Administrator
cd C:\path\to\asset-population
Set-ExecutionPolicy Bypass -Scope Process -Force
.\Client_Join.ps1
```

**Enter credentials when prompted:**
- Username: `meezan.local\Administrator`
- Password: `[password you set during DC promotion]`

**Wait for automatic reboot** (~2 min)

### ⏰ Step 3: Run Scanner (2 minutes)

On **Node 1 (Server)**:

```bash
# Install Python 3 if not installed
# Download from: https://www.python.org/downloads/

# Install dependencies
pip install -r requirements.txt

# Run scanner
python Asset_Scanner.py
```

**Output:**
```json
[
  {
    "asset_name": "LAPTOP-CLIENT1",
    "ip_address": "192.168.1.101",
    "compliance_status": "Compliant",
    "details": {
      "antivirus": true,
      "real_time_protection": true,
      "operating_system": "Windows 10 Pro"
    }
  }
]
```

## 🧪 Test Without Hardware

**Demo Mode** (no AD required):

```bash
python Asset_Scanner.py --demo
```

This generates sample data perfect for testing your dashboard UI!

## 🔥 Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot find domain" | Check DNS points to 192.168.1.50 |
| "WinRM connection failed" | Run `Enable-PSRemoting -Force` on client |
| "Host unreachable" | Client may be offline/sleeping |
| "LDAP connection failed" | Verify DC service is running |

## 📊 Next Steps

1. **Save output:** `python Asset_Scanner.py --output assets.json`
2. **Import to Dashboard:** Use the JSON in your Security Dashboard Asset Inventory
3. **Schedule Scans:** Create Windows Task Scheduler job to run hourly

## 💡 Pro Tips

- Run scanner from DC to avoid network issues
- Use `--verbose` flag for detailed debugging
- Skip DC from scans with default settings (already enabled)
- Create multiple clients for realistic dashboard data

---

**Need help?** Check the full [README.md](README.md) for detailed troubleshooting.
