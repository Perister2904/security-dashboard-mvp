#!/bin/bash
echo "Setting up domain join..."
export DEBIAN_FRONTEND=noninteractive
echo "nameserver 192.168.18.100" | sudo tee /etc/resolv.conf
sudo apt-get update -qq
sudo apt-get install -y realmd sssd adcli krb5-user packagekit samba-common-bin -qq
echo "Password123" | sudo realm join --user=Administrator meezan.local
sudo realm list
echo "Domain join complete!"
