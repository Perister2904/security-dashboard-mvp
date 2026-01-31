#!/usr/bin/env python3
"""
Asset Scanner for Security Dashboard
=====================================

This script scans Active Directory computers via LDAP and collects
security compliance information (antivirus status) via WinRM.

Dependencies: ldap3, pywinrm
Run on: Node 1 (Domain Controller / Server)

Author: Security Dashboard Team
Date: January 2026
"""

import json
import socket
import logging
import sys
import argparse
from typing import List, Dict, Any, Optional
from datetime import datetime

# Third-party imports
try:
    from ldap3 import Server, Connection, ALL, SUBTREE
    from ldap3.core.exceptions import LDAPException
except ImportError:
    print("ERROR: ldap3 module not found. Install with: pip install ldap3")
    sys.exit(1)

try:
    import winrm
    from winrm.exceptions import WinRMError, WinRMTransportError
except ImportError:
    print("ERROR: pywinrm module not found. Install with: pip install pywinrm")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('asset_scanner.log')
    ]
)
logger = logging.getLogger(__name__)


class AssetScanner:
    """
    Scans Active Directory for computers and checks their security compliance
    using WinRM to query Windows Defender status.
    """
    
    def __init__(
        self,
        domain: str = "meezan.local",
        dc_ip: str = "192.168.1.50",
        username: str = "svc_scanner",
        password: str = "CyberSec2025!",
        use_ssl: bool = False
    ):
        """
        Initialize the Asset Scanner.
        
        Args:
            domain: Active Directory domain name
            dc_ip: Domain Controller IP address
            username: Service account username
            password: Service account password
            use_ssl: Whether to use LDAPS (port 636) instead of LDAP (port 389)
        """
        self.domain = domain
        self.dc_ip = dc_ip
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        
        # Construct the base DN from domain
        self.base_dn = ','.join([f"DC={part}" for part in domain.split('.')])
        
        # Full username for authentication - Try UPN format first, fallback to domain\user
        self.full_username = f"{username}@{domain}" if '@' not in username else username
        
        # Store scan results
        self.scan_results: List[Dict[str, Any]] = []
        
        logger.info(f"Asset Scanner initialized for domain: {domain}")
        logger.info(f"Domain Controller: {dc_ip}")
        logger.info(f"Base DN: {self.base_dn}")
    
    def get_ad_computers(self) -> List[Dict[str, str]]:
        """
        Connect to Active Directory via LDAP and retrieve all computer objects.
        
        Returns:
            List of dictionaries containing computer information
        """
        computers = []
        ldap_port = 636 if self.use_ssl else 389
        
        try:
            logger.info(f"Connecting to LDAP server at {self.dc_ip}:{ldap_port}")
            
            # Create LDAP server connection
            server = Server(
                self.dc_ip,
                port=ldap_port,
                use_ssl=self.use_ssl,
                get_info=ALL
            )
            
            # Connect with service account credentials
            conn = Connection(
                server,
                user=self.full_username,
                password=self.password,
                auto_bind=True
            )
            
            logger.info("Successfully connected to Active Directory")
            
            # Search for all computer objects
            search_filter = "(objectClass=computer)"
            attributes = ['cn', 'dNSHostName', 'operatingSystem', 'operatingSystemVersion', 
                         'distinguishedName', 'whenCreated', 'lastLogonTimestamp']
            
            logger.info(f"Searching for computers in: {self.base_dn}")
            
            conn.search(
                search_base=self.base_dn,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=attributes
            )
            
            for entry in conn.entries:
                computer = {
                    'hostname': str(entry.cn) if entry.cn else 'Unknown',
                    'dns_hostname': str(entry.dNSHostName) if hasattr(entry, 'dNSHostName') and entry.dNSHostName else None,
                    'os': str(entry.operatingSystem) if hasattr(entry, 'operatingSystem') and entry.operatingSystem else 'Unknown',
                    'os_version': str(entry.operatingSystemVersion) if hasattr(entry, 'operatingSystemVersion') and entry.operatingSystemVersion else '',
                    'dn': str(entry.distinguishedName) if entry.distinguishedName else ''
                }
                computers.append(computer)
                logger.debug(f"Found computer: {computer['hostname']}")
            
            conn.unbind()
            logger.info(f"Found {len(computers)} computers in Active Directory")
            
        except LDAPException as e:
            logger.error(f"LDAP connection failed: {e}")
            raise
        except Exception as e:
            logger.error(f"Error retrieving AD computers: {e}")
            raise
        
        return computers
    
    def resolve_hostname(self, hostname: str, dns_hostname: Optional[str] = None) -> Optional[str]:
        """
        Resolve a hostname to an IP address.
        
        Args:
            hostname: Computer hostname
            dns_hostname: Full DNS hostname (if available)
            
        Returns:
            IP address or None if resolution fails
        """
        # Try different hostname formats
        hostnames_to_try = []
        
        if dns_hostname:
            hostnames_to_try.append(dns_hostname)
        
        hostnames_to_try.extend([
            f"{hostname}.{self.domain}",
            hostname
        ])
        
        for name in hostnames_to_try:
            try:
                ip = socket.gethostbyname(name)
                logger.debug(f"Resolved {name} to {ip}")
                return ip
            except socket.gaierror:
                continue
        
        logger.warning(f"Could not resolve hostname: {hostname}")
        return None
    
    def check_host_reachable(self, ip: str, port: int = 5985, timeout: float = 3.0) -> bool:
        """
        Check if a host is reachable on the WinRM port.
        
        Args:
            ip: IP address to check
            port: Port to check (default: 5985 for WinRM HTTP)
            timeout: Connection timeout in seconds
            
        Returns:
            True if host is reachable, False otherwise
        """
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((ip, port))
            sock.close()
            return result == 0
        except socket.error:
            return False
    
    def get_defender_status(self, hostname: str, ip: str) -> Dict[str, Any]:
        """
        Query Windows Defender status via WinRM.
        
        Args:
            hostname: Computer hostname
            ip: IP address of the computer
            
        Returns:
            Dictionary containing Defender status information
        """
        result = {
            'antivirus': None,
            'real_time_protection': None,
            'error': None
        }
        
        # Check if host is reachable first
        if not self.check_host_reachable(ip):
            result['error'] = 'Host unreachable'
            logger.warning(f"Host {hostname} ({ip}) is unreachable on port 5985")
            return result
        
        try:
            logger.info(f"Connecting to {hostname} ({ip}) via WinRM...")
            
            # Create WinRM session
            session = winrm.Session(
                target=ip,
                auth=(self.full_username, self.password),
                transport='ntlm',
                server_cert_validation='ignore'
            )
            
            # Execute PowerShell command to get Defender status
            ps_command = """
            $status = Get-MpComputerStatus | Select-Object AntivirusEnabled, RealTimeProtectionEnabled
            $status | ConvertTo-Json
            """
            
            response = session.run_ps(ps_command)
            
            if response.status_code == 0:
                # Parse the JSON output
                output = response.std_out.decode('utf-8').strip()
                if output:
                    defender_status = json.loads(output)
                    result['antivirus'] = defender_status.get('AntivirusEnabled', False)
                    result['real_time_protection'] = defender_status.get('RealTimeProtectionEnabled', False)
                    logger.info(f"Defender status for {hostname}: AV={result['antivirus']}, RTP={result['real_time_protection']}")
                else:
                    result['error'] = 'Empty response from Get-MpComputerStatus'
            else:
                error_output = response.std_err.decode('utf-8').strip()
                result['error'] = f"PowerShell error: {error_output[:200]}"
                logger.error(f"PowerShell error on {hostname}: {error_output}")
                
        except WinRMTransportError as e:
            result['error'] = f"WinRM transport error: {str(e)[:100]}"
            logger.error(f"WinRM transport error for {hostname}: {e}")
        except WinRMError as e:
            result['error'] = f"WinRM error: {str(e)[:100]}"
            logger.error(f"WinRM error for {hostname}: {e}")
        except json.JSONDecodeError as e:
            result['error'] = f"JSON parse error: {str(e)}"
            logger.error(f"Failed to parse Defender status JSON for {hostname}: {e}")
        except Exception as e:
            result['error'] = f"Unexpected error: {str(e)[:100]}"
            logger.error(f"Unexpected error scanning {hostname}: {e}")
        
        return result
    
    def determine_compliance_status(self, defender_status: Dict[str, Any]) -> str:
        """
        Determine compliance status based on Defender configuration.
        
        Args:
            defender_status: Dictionary containing Defender status
            
        Returns:
            Compliance status string: 'Compliant', 'Non-Compliant', 'Partial', or 'Unknown'
        """
        if defender_status.get('error'):
            return 'Unknown'
        
        av_enabled = defender_status.get('antivirus')
        rtp_enabled = defender_status.get('real_time_protection')
        
        if av_enabled is None or rtp_enabled is None:
            return 'Unknown'
        
        if av_enabled and rtp_enabled:
            return 'Compliant'
        elif av_enabled or rtp_enabled:
            return 'Partial'
        else:
            return 'Non-Compliant'
    
    def scan_all_assets(self, skip_dc: bool = True) -> List[Dict[str, Any]]:
        """
        Perform a complete scan of all AD computers.
        
        Args:
            skip_dc: Whether to skip scanning the Domain Controller
            
        Returns:
            List of asset scan results in the required JSON format
        """
        logger.info("Starting full asset scan...")
        self.scan_results = []
        
        # Get all computers from AD
        try:
            computers = self.get_ad_computers()
        except Exception as e:
            logger.error(f"Failed to retrieve AD computers: {e}")
            return self.scan_results
        
        # Get DC hostname from the provided DC IP/hostname to skip it if needed
        # Do NOT use socket.gethostname() as that returns the scanner's own hostname
        dc_hostname_to_skip = None
        if skip_dc:
            try:
                # Try to get the DC's hostname by resolving its IP
                dc_hostname_to_skip = socket.gethostbyaddr(self.dc_ip)[0].split('.')[0].upper()
                logger.info(f"Will skip scanning Domain Controller: {dc_hostname_to_skip}")
            except Exception as e:
                logger.warning(f"Could not resolve DC hostname from {self.dc_ip}: {e}")
        
        for computer in computers:
            hostname = computer['hostname']
            
            # Skip the Domain Controller if requested
            if skip_dc and dc_hostname_to_skip and hostname.upper() == dc_hostname_to_skip:
                logger.info(f"Skipping Domain Controller: {hostname}")
                continue
            
            # Resolve IP address
            ip = self.resolve_hostname(hostname, computer.get('dns_hostname'))
            
            if not ip:
                # Add entry with unknown status
                asset_result = {
                    'asset_name': hostname,
                    'ip_address': 'Unknown',
                    'compliance_status': 'Unknown',
                    'details': {
                        'antivirus': None,
                        'real_time_protection': None,
                        'error': 'Could not resolve hostname',
                        'operating_system': computer.get('os', 'Unknown')
                    }
                }
                self.scan_results.append(asset_result)
                continue
            
            # Get Defender status
            defender_status = self.get_defender_status(hostname, ip)
            
            # Determine compliance
            compliance = self.determine_compliance_status(defender_status)
            
            # Build result object
            asset_result = {
                'asset_name': hostname,
                'ip_address': ip,
                'compliance_status': compliance,
                'details': {
                    'antivirus': defender_status.get('antivirus'),
                    'real_time_protection': defender_status.get('real_time_protection'),
                    'operating_system': computer.get('os', 'Unknown')
                }
            }
            
            # Add error info if present
            if defender_status.get('error'):
                asset_result['details']['error'] = defender_status['error']
            
            self.scan_results.append(asset_result)
        
        logger.info(f"Scan complete. Scanned {len(self.scan_results)} assets.")
        return self.scan_results
    
    def get_results_json(self, pretty: bool = True) -> str:
        """
        Get scan results as JSON string.
        
        Args:
            pretty: Whether to format JSON with indentation
            
        Returns:
            JSON string of scan results
        """
        if pretty:
            return json.dumps(self.scan_results, indent=2)
        return json.dumps(self.scan_results)
    
    def save_results(self, filename: str = None) -> str:
        """
        Save scan results to a JSON file.
        
        Args:
            filename: Output filename (default: asset_scan_<timestamp>.json)
            
        Returns:
            Path to the saved file
        """
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"asset_scan_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(self.scan_results, f, indent=2)
        
        logger.info(f"Results saved to: {filename}")
        return filename


def create_sample_output() -> List[Dict[str, Any]]:
    """
    Create sample output for testing/demonstration when AD is not available.
    
    Returns:
        Sample asset scan results
    """
    return [
        {
            "asset_name": "LAPTOP-CLIENT1",
            "ip_address": "192.168.1.101",
            "compliance_status": "Compliant",
            "details": {
                "antivirus": True,
                "real_time_protection": True,
                "operating_system": "Windows 11 Pro"
            }
        },
        {
            "asset_name": "DESKTOP-FINANCE",
            "ip_address": "192.168.1.102",
            "compliance_status": "Non-Compliant",
            "details": {
                "antivirus": False,
                "real_time_protection": False,
                "operating_system": "Windows 10 Enterprise"
            }
        },
        {
            "asset_name": "SERVER-DB01",
            "ip_address": "192.168.1.10",
            "compliance_status": "Partial",
            "details": {
                "antivirus": True,
                "real_time_protection": False,
                "operating_system": "Windows Server 2022"
            }
        },
        {
            "asset_name": "LAPTOP-SALES",
            "ip_address": "192.168.1.103",
            "compliance_status": "Unknown",
            "details": {
                "antivirus": None,
                "real_time_protection": None,
                "error": "Host unreachable",
                "operating_system": "Windows 10 Pro"
            }
        }
    ]


def main():
    """Main entry point for the Asset Scanner."""
    parser = argparse.ArgumentParser(
        description='Security Dashboard Asset Scanner - Scans AD computers for compliance status',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python Asset_Scanner.py                          # Run with default settings
  python Asset_Scanner.py --demo                   # Generate sample output (no AD required)
  python Asset_Scanner.py --domain corp.local      # Use custom domain
  python Asset_Scanner.py --output results.json    # Save to specific file
  python Asset_Scanner.py --dc-ip 10.0.0.5        # Use custom DC IP
        """
    )
    
    parser.add_argument('--domain', type=str, default='meezan.local',
                        help='Active Directory domain name (default: meezan.local)')
    parser.add_argument('--dc-ip', type=str, default='192.168.1.50',
                        help='Domain Controller IP address (default: 192.168.1.50)')
    parser.add_argument('--username', type=str, default='svc_scanner',
                        help='Service account username (default: svc_scanner)')
    parser.add_argument('--password', type=str, default='CyberSec2025!',
                        help='Service account password')
    parser.add_argument('--output', type=str, default=None,
                        help='Output JSON file path (default: auto-generated)')
    parser.add_argument('--ssl', action='store_true',
                        help='Use LDAPS (SSL) for AD connection')
    parser.add_argument('--include-dc', action='store_true',
                        help='Include Domain Controller in scan')
    parser.add_argument('--demo', action='store_true',
                        help='Generate sample output without connecting to AD')
    parser.add_argument('--quiet', action='store_true',
                        help='Suppress log output, only print JSON result')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose/debug logging')
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.quiet:
        logging.getLogger().setLevel(logging.ERROR)
    elif args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Demo mode - generate sample output
    if args.demo:
        logger.info("Running in demo mode - generating sample output")
        results = create_sample_output()
        print(json.dumps(results, indent=2))
        
        # Save to file if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2)
            logger.info(f"Demo results saved to: {args.output}")
        
        return 0
    
    try:
        # Create scanner instance
        scanner = AssetScanner(
            domain=args.domain,
            dc_ip=args.dc_ip,
            username=args.username,
            password=args.password,
            use_ssl=args.ssl
        )
        
        # Run the scan
        results = scanner.scan_all_assets(skip_dc=not args.include_dc)
        
        # Output results
        print(scanner.get_results_json())
        
        # Save to file if requested
        if args.output:
            scanner.save_results(args.output)
        
        # Return appropriate exit code
        if len(results) == 0:
            logger.warning("No assets were scanned")
            return 1
        
        return 0
        
    except LDAPException as e:
        logger.error(f"LDAP Error: {e}")
        logger.error("Ensure the Domain Controller is running and credentials are correct")
        return 2
    except Exception as e:
        logger.error(f"Scanner failed: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
