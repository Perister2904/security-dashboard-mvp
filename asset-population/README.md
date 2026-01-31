# 🔐 Asset Population System for Security Dashboard

**Complete automation suite** for deploying Active Directory, scanning assets, and populating your security dashboard with real compliance data.

---

## 🎯 What This Does

This system provides **3 deployment modes**:

1. **📍 Physical Machines** - Deploy on real Windows laptops/servers in your lab
2. **🖥️ Virtual Machines** - Test in VirtualBox/VMware/Hyper-V
3. **🧪 Demo Mode** - Generate realistic fake data for testing

Choose the mode that fits your needs and timeline!

---

## ⚡ QUICK START

### Option 1: Physical Machines (Production)
```powershell
# On Windows Server:
.\Server_Setup.ps1     # Wait for 2 reboots (~15 min)

# On each Windows Client:
.\Client_Join.ps1      # Wait for 1 reboot (~5 min)

# Back on Server:
pip install -r requirements.txt
python Asset_Scanner.py
```

### Option 2: Demo Mode (2 minutes)
```powershell
# On any machine with Python:
pip install -r requirements.txt
python Demo_Generator.py --count 100 --output demo_data.json
# Use demo_data.json in your dashboard!
```

### Option 3: Virtual Machines (Best for testing)
See **[TEST_WITHOUT_HARDWARE.md](TEST_WITHOUT_HARDWARE.md)** for VM setup guide.

---

## 📁 Complete File Structure

| File | Description | Use Case |
|------|-------------|----------|
| **🚀 Deployment Scripts** |
| `Server_Setup.ps1` | Set up Domain Controller | Run ONCE on Server |
| `Client_Join.ps1` | Join client to domain | Run on EACH client |
| `Verify_Setup.ps1` | Diagnose configuration issues | Troubleshooting |
| **📊 Scanner & Data Generation** |
| `Asset_Scanner.py` | Real asset scanner (LDAP + WinRM) | Production scanning |
| `Demo_Generator.py` | Generate realistic fake data | Testing/demos |
| `requirements.txt` | Python dependencies | Install first |
| **🔁 Automation & Integration** |
| `Schedule_Scanner.ps1` | Auto-scan every hour | Set up ONCE |
| `Push_To_Dashboard.ps1` | Push results to API | Optional integration |
| **📖 Documentation** |
| `WHAT_TO_RUN.md` | **START HERE!** Step-by-step commands | Quick reference |
| `REAL_DEPLOYMENT_GUIDE.md` | Complete physical deployment guide | Production setup |
| `TEST_WITHOUT_HARDWARE.md` | VM & demo mode instructions | Testing |
| `QUICK_START.md` | Brief overview | Original guide |
| **📝 Legacy Files** |
| `IMPLEMENTATION_SUMMARY.txt` | Technical details | Reference |
| `sample_output.json` | Example scanner output | Reference |

---

## 🎓 NEW USER? START HERE!

### 👉 **[WHAT_TO_RUN.md](WHAT_TO_RUN.md)** ← Read this first!
Tells you exactly what commands to run on each machine.

### Choose Your Path:

**🏢 I have physical Windows machines:**  
→ Read **[REAL_DEPLOYMENT_GUIDE.md](REAL_DEPLOYMENT_GUIDE.md)**

**🖥️ I want to test with VMs:**  
→ Read **[TEST_WITHOUT_HARDWARE.md](TEST_WITHOUT_HARDWARE.md)**

**🚀 I just want demo data NOW:**  
→ Run `python Demo_Generator.py --count 100 --output demo.json`

---

## 🏗️ Environment Configuration

### Network Settings (Default)
- **Subnet:** `192.168.1.0/24`
- **Gateway:** `192.168.1.1` (your router)
- **Domain Controller IP:** `192.168.1.50` (static)
- **Domain:** `meezan.local`

### Default Credentials
- **Domain Admin:** `Administrator` (you set password during setup)
- **Service Account:** `svc_scanner` / `CyberSec2025!`
- **Safe Mode Password:** `SafeMode2025!`

⚠️ **Change these passwords in production!**

---

## ⚡ Quick Command Reference

### Server Setup (Run ONCE)
```powershell
cd C:\asset-population
.\Server_Setup.ps1
# Wait for 2 automatic reboots (~15 min)
```

### Client Setup (Run on EACH client)
```powershell
cd C:\asset-population
.\Client_Join.ps1
# Enter: meezan.local\Administrator + password
# Wait for 1 automatic reboot (~5 min)
```

### Run Scanner
```powershell
pip install -r requirements.txt
python Asset_Scanner.py --output C:\scans\assets.json
```

### Verify Everything Works
```powershell
.\Verify_Setup.ps1          # On server
.\Verify_Setup.ps1 -IsClient  # On clients
```

### Automate Scanning (Optional)
```powershell
.\Schedule_Scanner.ps1  # Creates hourly task
```

---

## 🧪 Testing Options

### 1. Demo Mode (No infrastructure needed)
```powershell
# Generate 100 realistic fake assets
python Demo_Generator.py --count 100 --output demo.json

# Scenario: Mostly compliant
python Demo_Generator.py --scenario compliant --count 50

# Scenario: High risk
python Demo_Generator.py --scenario critical --count 50
```

### 2. Virtual Machines (Most realistic)
See **[TEST_WITHOUT_HARDWARE.md](TEST_WITHOUT_HARDWARE.md)** for VirtualBox setup

### 3. Physical Machines (Production)
See **[REAL_DEPLOYMENT_GUIDE.md](REAL_DEPLOYMENT_GUIDE.md)** for complete guide

---

## 📊 Output Format

All tools produce consistent JSON:

```json
[
  {
    "asset_name": "IT-SERVER-LAPTOP-001",
    "ip_address": "192.168.1.101",
    "department": "IT",
    "compliance_status": "Compliant",
    "risk_score": 15,
    "details": {
      "antivirus": true,
      "real_time_protection": true,
      "firewall_enabled": true,
      "encryption_enabled": true,
      "operating_system": "Windows 10 Pro",
      "last_update": "2026-01-25",
      "compliance_score": 95,
      "vulnerabilities": [],
      "alerts": []
    }
  }
]
```

---

## 🔧 Troubleshooting

### Quick Fixes

| Problem | Solution |
|---------|----------|
| "Cannot find domain" | Run `.\Verify_Setup.ps1 -IsClient -FixIssues` |
| "WinRM failed" | Run `Enable-PSRemoting -Force` |
| "Python not found" | Install from python.org, check "Add to PATH" |
| "Module not found" | Run `pip install -r requirements.txt` |

### View Logs
```powershell
# Server setup logs
Get-Content $env:TEMP\Server_Setup_*.log -Tail 50

# Client join logs
Get-Content $env:TEMP\Client_Join_*.log -Tail 50

# Scanner logs
Get-Content C:\asset-population\asset_scanner.log -Tail 50
```

### Comprehensive Diagnostics
```powershell
.\Verify_Setup.ps1 -Detailed -FixIssues
```

---

## 📈 Performance

- **Small:** 5 clients = ~30 seconds
- **Medium:** 25 clients = ~2 minutes
- **Large:** 100 clients = ~8 minutes

---

## 🔐 Security Notes

⚠️ **This is a LAB setup!** For production:

1. Change all default passwords
2. Use LDAPS: `python Asset_Scanner.py --ssl`
3. Restrict service account permissions
4. Enable MFA on admin accounts
5. Use secure credential storage (Key Vault)
6. Network segmentation
7. Regular security audits

---

## 📋 System Requirements

### Server
- Windows Server 2022/2019
- 4GB RAM (8GB recommended)
- 40GB disk space
- Administrator access

### Clients
- Windows 10/11 **Pro or Enterprise** (Home won't work!)
- 2GB RAM
- Administrator access

### Software
- Python 3.9+ (server only)
- PowerShell 5.0+ (built-in)

---

## 🎯 Success Checklist

You're done when:

- [x] Server is Domain Controller (`Get-ADDomainController`)
- [x] Clients joined domain (`.\Verify_Setup.ps1 -IsClient`)
- [x] Scanner retrieves real data (`python Asset_Scanner.py`)
- [x] JSON output is valid
- [x] (Optional) Hourly task configured
- [x] (Optional) Dashboard shows data

---

## 📖 Additional Resources

- **[WHAT_TO_RUN.md](WHAT_TO_RUN.md)** - Command reference
- **[REAL_DEPLOYMENT_GUIDE.md](REAL_DEPLOYMENT_GUIDE.md)** - Full physical setup
- **[TEST_WITHOUT_HARDWARE.md](TEST_WITHOUT_HARDWARE.md)** - VM & demo options
- **[QUICK_START.md](QUICK_START.md)** - Original brief guide

---

## 🆘 Still Need Help?

1. **Run diagnostics:** `.\Verify_Setup.ps1 -Detailed`
2. **Check documentation** above
3. **Review logs** in `%TEMP%\*.log`
4. **Try demo mode** to test dashboard first

---

**Ready to start? Open [WHAT_TO_RUN.md](WHAT_TO_RUN.md) now! 🚀**
