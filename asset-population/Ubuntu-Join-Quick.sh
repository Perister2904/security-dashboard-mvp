# ============================================
# UBUNTU VM - JOIN TO AD (QUICK VERSION)
# ============================================
# Copy and paste these commands directly into Ubuntu VM

# Configuration
DC_IP="192.168.18.100"
DOMAIN="meezan.local"
REALM="MEEZAN.LOCAL"
ADMIN_USER="Administrator"
ADMIN_PASS="Password123"

# 1. Test DC connectivity
ping -c 2 $DC_IP

# 2. Install packages (will prompt for Kerberos realm - enter: MEEZAN.LOCAL)
sudo apt-get update
sudo apt-get install -y realmd sssd sssd-tools libnss-sss libpam-sss adcli samba-common-bin oddjob oddjob-mkhomedir packagekit krb5-user

# 3. Set DNS to DC
echo "nameserver $DC_IP" | sudo tee /etc/resolv.conf
echo "search $DOMAIN" | sudo tee -a /etc/resolv.conf

# 4. Configure Kerberos
sudo tee /etc/krb5.conf > /dev/null << 'EOF'
[libdefaults]
    default_realm = MEEZAN.LOCAL
    dns_lookup_realm = false
    dns_lookup_kdc = true

[realms]
    MEEZAN.LOCAL = {
        kdc = 192.168.18.100
        admin_server = 192.168.18.100
    }

[domain_realm]
    .meezan.local = MEEZAN.LOCAL
    meezan.local = MEEZAN.LOCAL
EOF

# 5. Discover domain
sudo realm discover meezan.local

# 6. Join domain
echo "Password123" | sudo realm join --user=Administrator meezan.local

# 7. Allow domain logins
sudo realm permit --all
sudo pam-auth-update --enable mkhomedir

# 8. Verify
sudo realm list
id Administrator@meezan.local

# ============================================
# DONE! Ubuntu is now joined to AD
# ============================================
