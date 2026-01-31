# ============================================
# UBUNTU VM - JOIN ACTIVE DIRECTORY
# ============================================
# Run this script on Ubuntu VM
# Connects Ubuntu to meezan.local domain

#!/bin/bash

echo "============================================"
echo "  UBUNTU VM - JOIN ACTIVE DIRECTORY"
echo "============================================"

# Configuration
DC_IP="192.168.18.100"
DOMAIN="meezan.local"
REALM="MEEZAN.LOCAL"
ADMIN_USER="Administrator"
ADMIN_PASS="Password123"

echo ""
echo "[STEP 1/6] Checking Network Connection"
echo "----------------------------------------"

# Get IP address
MY_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n 1)
echo "Your IP: $MY_IP"

# Test DC connectivity
echo "Testing DC connectivity: $DC_IP"
if ping -c 2 $DC_IP > /dev/null 2>&1; then
    echo "✅ DC is reachable"
else
    echo "❌ Cannot reach DC at $DC_IP"
    echo "Check network settings!"
    exit 1
fi

echo ""
echo "[STEP 2/6] Installing Required Packages"
echo "----------------------------------------"

echo "Updating package lists..."
sudo apt-get update -qq

echo "Installing packages (this may take a few minutes)..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    realmd \
    sssd \
    sssd-tools \
    libnss-sss \
    libpam-sss \
    adcli \
    samba-common-bin \
    oddjob \
    oddjob-mkhomedir \
    packagekit \
    krb5-user > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Packages installed"
else
    echo "❌ Package installation failed"
    exit 1
fi

echo ""
echo "[STEP 3/6] Configuring DNS"
echo "----------------------------------------"

# Backup original resolv.conf
sudo cp /etc/resolv.conf /etc/resolv.conf.backup

# Set DC as DNS server
echo "Setting DNS to DC..."
echo "nameserver $DC_IP" | sudo tee /etc/resolv.conf > /dev/null
echo "search $DOMAIN" | sudo tee -a /etc/resolv.conf > /dev/null

echo "✅ DNS configured"

echo ""
echo "[STEP 4/6] Configuring Kerberos"
echo "----------------------------------------"

# Create krb5.conf
sudo tee /etc/krb5.conf > /dev/null << EOF
[libdefaults]
    default_realm = $REALM
    dns_lookup_realm = false
    dns_lookup_kdc = true
    ticket_lifetime = 24h
    renew_lifetime = 7d
    forwardable = true

[realms]
    $REALM = {
        kdc = $DC_IP
        admin_server = $DC_IP
    }

[domain_realm]
    .$DOMAIN = $REALM
    $DOMAIN = $REALM
EOF

echo "✅ Kerberos configured"

echo ""
echo "[STEP 5/6] Discovering Domain"
echo "----------------------------------------"

echo "Discovering domain: $DOMAIN"
sudo realm discover $DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ Domain discovered"
else
    echo "❌ Domain discovery failed"
    echo "Check DC is running and DNS is correct"
    exit 1
fi

echo ""
echo "[STEP 6/6] Joining Domain"
echo "----------------------------------------"

echo "Joining domain as $ADMIN_USER..."
echo "This may take a minute..."

# Join domain
echo "$ADMIN_PASS" | sudo realm join --user=$ADMIN_USER $DOMAIN --verbose

if [ $? -eq 0 ]; then
    echo "✅ Successfully joined domain!"
else
    echo "❌ Domain join failed"
    exit 1
fi

# Configure home directory creation
sudo pam-auth-update --enable mkhomedir

# Allow domain users to login
sudo realm permit --all

echo ""
echo "============================================"
echo "  CONFIGURATION COMPLETE!"
echo "============================================"
echo ""
echo "Verifying domain join:"
sudo realm list

echo ""
echo "Testing authentication:"
id $ADMIN_USER@$DOMAIN

echo ""
echo "============================================"
echo "You can now login with domain users:"
echo "  Username: $ADMIN_USER@$DOMAIN"
echo "  Password: $ADMIN_PASS"
echo "============================================"
