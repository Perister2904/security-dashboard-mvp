# 🚨 CRITICAL: Real Active Directory Deployment Guide

## ⚠️ IMPORTANT DISCOVERY

Your machine is **Windows 11 Pro** which **CANNOT** be promoted to a Domain Controller.

**Domain Controllers require Windows Server (2019/2022).**

---

## 🎯 REAL SOLUTIONS TO GET ACTUAL AD DATA

### Solution 1: Connect to Existing Corporate AD (RECOMMENDED)

If you have access to an existing Active Directory:

```powershell
# Run the REAL scanner against existing AD
python Asset_Scanner.py `
    --domain "your-company.com" `
    --dc-ip "10.0.0.5" `
    --username "scanner-account" `
    --password "YourPassword" `
    --output real_corporate_data.json
```

**Requirements:**
- Network access to the domain controller
- Valid domain credentials
- Domain controller IP address

---

### Solution 2: Set Up Windows Server VM (PRODUCTION GRADE)

**Step 1: Enable Hyper-V** (Requires admin rights)

```powershell
# Run PowerShell as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -NoRestart
Restart-Computer
```

**Step 2: Download Windows Server ISO**

1. Go to: https://www.microsoft.com/en-us/evalcenter/evaluate-windows-server-2022
2. Download Windows Server 2022 Evaluation (180-day trial)
3. Save to: `C:\ISOs\WindowsServer2022.iso`

**Step 3: Create VM**

```powershell
# Create Hyper-V VM
New-VM -Name "DC-Server" -MemoryStartupBytes 4GB -Generation 2 -NewVHDPath "C:\VMs\DC-Server.vhdx" -NewVHDSizeBytes 40GB

# Attach ISO
Set-VMDvdDrive -VMName "DC-Server" -Path "C:\ISOs\WindowsServer2022.iso"

# Start VM
Start-VM -Name "DC-Server"

# Connect to VM console
vmconnect localhost "DC-Server"
```

**Step 4: Install Windows Server in VM**

1. Install Windows Server 2022 (Desktop Experience)
2. Set Administrator password
3. Complete installation

**Step 5: Copy Scripts to VM**

```powershell
# Share asset-population folder
New-SmbShare -Name "AssetPopulation" -Path "C:\Users\haryp\Desktop\FINAL YEAR PROJECT\security-dashboard-mvp-exec-friendly\asset-population" -FullAccess "Everyone"

# In VM, access: \\LAPPY\AssetPopulation
```

**Step 6: Run Server_Setup.ps1 in VM**

```powershell
# Inside the VM, run:
cd \\LAPPY\AssetPopulation
Copy-Item -Recurse . C:\asset-population
cd C:\asset-population
.\Server_Setup.ps1
```

---

### Solution 3: Use Azure AD Domain Services (CLOUD)

Set up a real AD in Azure (requires Azure subscription):

```bash
# Install Azure CLI
winget install Microsoft.AzureCLI

# Login to Azure
az login

# Create AD Domain Services
az addomain create --resource-group YourRG --name yourdomain.com
```

---

### Solution 4: Use Existing AD (If Available)

**Do you have access to:**
- Company/School Active Directory?
- Azure AD tenant?
- AWS Directory Service?

If YES, I can configure the scanner to connect NOW.

---

## ⚡ IMMEDIATE NEXT STEPS

**Tell me which option you prefer:**

1. **I have access to existing AD** → I'll configure scanner immediately
2. **I want to set up Hyper-V VM** → I need you to run PowerShell as Admin
3. **I'll use VirtualBox instead** → I'll guide you through that
4. **I want cloud AD** → I'll help with Azure/AWS setup

**Or if you want me to try automatic setup:**

Run this command **AS ADMINISTRATOR** and I'll detect the best option:

```powershell
# Right-click PowerShell → "Run as Administrator", then:
Set-ExecutionPolicy Bypass -Scope Process -Force
cd "C:\Users\haryp\Desktop\FINAL YEAR PROJECT\security-dashboard-mvp-exec-friendly\asset-population"
.\Detect_And_Setup.ps1
```

---

## 🔴 BOTTOM LINE

**You CANNOT install Active Directory on Windows 11 Pro.** 

You need:
- Windows Server 2019/2022 (VM or physical)
- OR access to existing AD
- OR cloud-based AD service

**What would you like me to do?**
