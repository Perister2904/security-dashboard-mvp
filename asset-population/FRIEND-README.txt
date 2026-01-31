============================================
INSTRUCTIONS FOR YOUR FRIEND
============================================

Hey! Follow these SIMPLE steps to connect:

============================================
REQUIREMENT (MOST IMPORTANT!)
============================================

1. Connect to the SAME Wi-Fi as me
2. Ask me for the Wi-Fi password
3. Make sure you're on 192.168.18.x network

That's it for network setup!

============================================
HOW TO JOIN MY DOMAIN
============================================

OPTION 1: AUTOMATED (EASIEST!)
-------------------------------
1. Copy the file: FRIEND-COMPLETE-SETUP.ps1
2. Right-click it → "Run with PowerShell"
3. Follow the prompts
4. Computer will restart
5. Login with:
   - Username: MEEZAN\Administrator
   - Password: Password123

Done! Super easy.

OPTION 2: MANUAL STEPS
-------------------------------
Only if the script doesn't work:

1. Open PowerShell as Administrator
2. Copy and run these commands:

# Set DNS
$DCIP = "192.168.18.100"
Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | ForEach-Object {
    Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses $DCIP
}

# Join Domain
$Domain = "meezan.local"
$AdminUser = "MEEZAN\Administrator"
$AdminPassword = "Password123"
$securePassword = ConvertTo-SecureString $AdminPassword -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($AdminUser, $securePassword)
Add-Computer -DomainName $Domain -Credential $credential -Restart

3. After restart, login with:
   - Username: MEEZAN\Administrator
   - Password: Password123

============================================
VERIFICATION (AFTER RESTART)
============================================

To check if everything worked:

1. Open PowerShell
2. Type: whoami
3. Should show: meezan\administrator

Or type: systeminfo | findstr "Domain"
Should show: meezan.local

============================================
TROUBLESHOOTING
============================================

Problem: Script says "NOT on 192.168.18.x network"
→ You're on wrong Wi-Fi! Connect to my Wi-Fi first

Problem: "Cannot reach DC"
→ Contact me - my server might be offline

Problem: Domain join fails
→ Make sure you're on my Wi-Fi (192.168.18.x)
→ Contact me to verify server is running

Problem: After restart, can't login
→ Use: MEEZAN\Administrator
→ Password: Password123
→ Make sure to include "MEEZAN\"

============================================
QUICK CHECKLIST
============================================

Before running the script:
☐ Connected to correct Wi-Fi
☐ On 192.168.18.x network (check: ipconfig)
☐ Can ping 192.168.18.100
☐ Have FRIEND-COMPLETE-SETUP.ps1 file

After running script:
☐ Computer restarted
☐ Logged in with MEEZAN\Administrator
☐ Verified with: whoami

============================================
THAT'S IT! Call me if you need help.
============================================
