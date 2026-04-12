# 🖥️ Windows Server VM Setup - COMPLETE GUIDE

## ✅ Current Status

- ✅ Windows Server 2022 ISO Downloaded (4.7 GB)
- ✅ VirtualBox VM Created ("AD-Server-Production")
- ✅ VM is currently installing Windows Server
- ⏰ **Wait for installation to complete (~15-20 minutes)**

---

## 📋 What's Happening Right Now

The VM window should be open and showing:

1. Blue "Windows" logo with spinning dots
2. OR "Getting ready" / "Setting up" messages
3. OR Password setup screen

**DO NOT CLOSE THE VM WINDOW!**

---

## 🎯 NEXT STEPS (After Windows Installation Finishes)

### Step 1: Initial Windows Setup (Inside VM)

1. **Set Administrator Password**
   - When prompted, enter: `P@ssw0rd123!`
   - Confirm: `P@ssw0rd123!`
   - Press Enter

2. **Login to Windows Server**
   - Press `Ctrl + Right Shift + Del` (VirtualBox capture)
   - OR use VM menu: Input → Keyboard → Insert Ctrl+Alt+Del
   - Enter password: `P@ssw0rd123!`
   - Press Enter

3. **Wait for Server Manager to Load**
   - Server Manager opens automatically
   - Desktop should appear with blue background

---

### Step 2: Run the Domain Controller Setup (Inside VM)

Once you see the Windows Server desktop:

1. **Open PowerShell as Administrator (Inside VM)**
   - Press Windows Key
   - Type: `powershell`
   - Right-click "Windows PowerShell"
   - Click "Run as Administrator"
   - Click "Yes" on UAC prompt

2. **Copy the Server_Setup.ps1 Script to VM**
   
   **Option A: Use Shared Clipboard**
   - In VM menu: Devices → Shared Clipboard → Bidirectional
   - Copy `Server_Setup.ps1` content from host machine
   - Paste into Notepad in VM
   - Save as `C:\Server_Setup.ps1`

   **Option B: Use Shared Folder**
   - In VM menu: Devices → Shared Folders → Shared Folder Settings
   - Add folder: `C:\Users\haryp\Desktop\FINAL YEAR PROJECT\security-dashboard-mvp-exec-friendly\asset-population`
   - Mount as: `E:\`
   - Access script at `E:\Server_Setup.ps1`

3. **Run the Setup Script**
   
   ```powershell
   # Inside VM PowerShell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   cd C:\
   .\Server_Setup.ps1
   ```

4. **What Happens During Setup:**
   - ✅ Installs AD Domain Services
   - ✅ Configures DNS
   - ✅ Sets static IP: 192.168.1.50
   - ✅ Creates domain: meezan.local
   - ✅ Promotes to Domain Controller
   - ⚠️ **VM will REBOOT automatically (2 times)**
   - ✅ Creates service account: svc_scanner
   - ✅ Enables WinRM for remote scanning

   **Total time: ~15-20 minutes + 2 reboots**

---

### Step 3: Verify Domain Controller is Ready

After the script completes and VM reboots twice:

1. **Login Again**
   - Username: `MEEZAN\Administrator`
   - Password: `P@ssw0rd123!`

2. **Verify AD is Working (Inside VM)**
   
   ```powershell
   # Run these commands in VM PowerShell
   Get-ADDomain
   Get-ADUser -Filter * | Select-Object Name
   Get-Service -Name ADWS, Netlogon, DNS | Select-Object Name, Status
   ```

   **Expected Output:**
   - Domain Name: meezan.local
   - Users: Administrator, svc_scanner
   - All services: Running

---

## 🌐 Step 4: Connect Your Physical Laptop to the Domain

Once the VM shows the domain is working:

1. **Get the Server IP Address (Inside VM)**
   
   ```powershell
   ipconfig
   # Look for: IPv4 Address (should be 192.168.1.50)
   ```

2. **On Your Physical Windows 11 Laptop (Host Machine)**

   Open PowerShell as Administrator and run:

   ```powershell
   cd "c:\Users\haryp\Desktop\FINAL YEAR PROJECT\security-dashboard-mvp-exec-friendly\asset-population"
   
   # Set DNS to point to the VM
   Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Set-DnsClientServerAddress -ServerAddresses "192.168.1.50"
   
   # Test connectivity
   ping 192.168.1.50
   nslookup meezan.local
   
   # Join the domain
   .\Client_Join.ps1
   ```

   **When prompted:**
   - Domain: `meezan.local`
   - Username: `MEEZAN\Administrator`
   - Password: `P@ssw0rd123!`

3. **Your laptop will REBOOT automatically**

4. **After reboot, login with domain credentials:**
   - Username: `MEEZAN\Administrator`
   - Password: `P@ssw0rd123!`

---

## 📊 Step 5: Run the REAL Asset Scanner

Once your laptop is domain-joined:

```powershell
cd "c:\Users\haryp\Desktop\FINAL YEAR PROJECT\security-dashboard-mvp-exec-friendly\asset-population"

# Scan the domain
python Asset_Scanner.py --domain meezan.local --dc-ip 192.168.1.50 --username "MEEZAN\svc_scanner" --password "Scanner123!" --output real_assets.json

# View results
Get-Content real_assets.json | ConvertFrom-Json | Format-Table asset_name, ip_address, compliance_status
```

**You will see:**
- ✅ Your physical laptop hostname
- ✅ Real IP address
- ✅ Actual Windows Defender status
- ✅ Real firewall state
- ✅ Genuine compliance status

---

## 🌍 Step 6: Have Other People Join the Domain

Give your friends/colleagues these instructions:

1. **Connect to the same Wi-Fi network** as your laptop
2. **Set DNS to your laptop's IP** (192.168.1.50)
3. **Run Client_Join.ps1** with domain credentials
4. **Reboot and login** with domain account

Then run the scanner again to see ALL real devices!

---

## 🔧 Troubleshooting

### If VM won't start:
```powershell
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" startvm "AD-Server-Production"
```

### If installation seems stuck:
- Wait at least 30 minutes
- Check VM window for progress
- Do NOT force close

### If you need to restart setup:
```powershell
# Delete VM and start over
& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" unregistervm "AD-Server-Production" --delete
```

Then re-run the VM creation commands.

---

## 📁 Important Files

- **VM Location:** `C:\Users\haryp\VirtualBox VMs\AD-Server-Production\`
- **ISO Location:** `C:\Users\haryp\Downloads\WindowsServer2022.iso`
- **Scripts:** `C:\Users\haryp\Desktop\FINAL YEAR PROJECT\security-dashboard-mvp-exec-friendly\asset-population\`

---

## ⏰ Timeline

- [x] ISO Download: DONE (5 seconds)
- [x] VM Creation: DONE (1 minute)
- [ ] Windows Installation: IN PROGRESS (~15-20 minutes)
- [ ] Domain Controller Setup: PENDING (~15 minutes + 2 reboots)
- [ ] Physical Laptop Join: PENDING (~5 minutes + 1 reboot)
- [ ] Real Asset Scanning: PENDING (~2 minutes)

**Total estimated time: ~45-60 minutes for complete real AD deployment**

---

## 🎯 What You'll Have When Done

✅ Real Windows Server 2022 Domain Controller
✅ Real Active Directory domain (meezan.local)
✅ Real DNS server
✅ Your physical laptop domain-joined
✅ Real asset scanning via WinRM
✅ Genuine compliance data (no dummy data!)
✅ Ability to add more physical devices

**This is a PRODUCTION-GRADE Active Directory lab environment!**

---

🚀 **Current Action:** Wait for Windows Server installation to complete in the VM window, then proceed to Step 2 above.
