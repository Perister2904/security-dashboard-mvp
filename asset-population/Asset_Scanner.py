#!/usr/bin/env python3
"""
Asset Scanner for Security Dashboard
===================================

Scans Active Directory computers via LDAP and collects security compliance
information over WinRM. This script only supports real directory-backed scans.
"""

import argparse
import json
import logging
import os
import socket
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from ldap3 import ALL, SUBTREE, Connection, Server
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler("asset_scanner.log")],
)
logger = logging.getLogger(__name__)


class AssetScanner:
    """Scans AD computers and queries endpoint protection state with WinRM."""

    def __init__(
        self,
        domain: str,
        dc_ip: str,
        username: str,
        password: str,
        use_ssl: bool = False,
    ):
        self.domain = domain
        self.dc_ip = dc_ip
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        self.base_dn = ",".join([f"DC={part}" for part in domain.split(".")])
        self.full_username = f"{username}@{domain}" if "@" not in username else username
        self.scan_results: List[Dict[str, Any]] = []

        logger.info(f"Asset Scanner initialized for domain: {domain}")
        logger.info(f"Domain Controller: {dc_ip}")
        logger.info(f"Base DN: {self.base_dn}")

    def get_ad_computers(self) -> List[Dict[str, str]]:
        computers = []
        ldap_port = 636 if self.use_ssl else 389

        try:
            logger.info(f"Connecting to LDAP server at {self.dc_ip}:{ldap_port}")

            server = Server(self.dc_ip, port=ldap_port, use_ssl=self.use_ssl, get_info=ALL)
            conn = Connection(server, user=self.full_username, password=self.password, auto_bind=True)

            logger.info("Successfully connected to Active Directory")

            conn.search(
                search_base=self.base_dn,
                search_filter="(objectClass=computer)",
                search_scope=SUBTREE,
                attributes=[
                    "cn",
                    "dNSHostName",
                    "operatingSystem",
                    "operatingSystemVersion",
                    "distinguishedName",
                    "whenCreated",
                    "lastLogonTimestamp",
                ],
            )

            for entry in conn.entries:
                computers.append(
                    {
                        "hostname": str(entry.cn) if entry.cn else "Unknown",
                        "dns_hostname": str(entry.dNSHostName) if hasattr(entry, "dNSHostName") and entry.dNSHostName else None,
                        "os": str(entry.operatingSystem) if hasattr(entry, "operatingSystem") and entry.operatingSystem else "Unknown",
                        "os_version": str(entry.operatingSystemVersion)
                        if hasattr(entry, "operatingSystemVersion") and entry.operatingSystemVersion
                        else "",
                        "dn": str(entry.distinguishedName) if entry.distinguishedName else "",
                    }
                )

            conn.unbind()
            logger.info(f"Found {len(computers)} computers in Active Directory")
        except LDAPException as exc:
            logger.error(f"LDAP connection failed: {exc}")
            raise
        except Exception as exc:
            logger.error(f"Error retrieving AD computers: {exc}")
            raise

        return computers

    def resolve_hostname(self, hostname: str, dns_hostname: Optional[str] = None) -> Optional[str]:
        hostnames_to_try = []

        if dns_hostname:
            hostnames_to_try.append(dns_hostname)

        hostnames_to_try.extend([f"{hostname}.{self.domain}", hostname])

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
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((ip, port))
            sock.close()
            return result == 0
        except socket.error:
            return False

    def get_defender_status(self, hostname: str, ip: str) -> Dict[str, Any]:
        result = {
            "antivirus": None,
            "real_time_protection": None,
            "error": None,
        }

        if not self.check_host_reachable(ip):
            result["error"] = "Host unreachable"
            logger.warning(f"Host {hostname} ({ip}) is unreachable on port 5985")
            return result

        try:
            logger.info(f"Connecting to {hostname} ({ip}) via WinRM...")

            session = winrm.Session(
                target=ip,
                auth=(self.full_username, self.password),
                transport="ntlm",
                server_cert_validation="ignore",
            )

            response = session.run_ps(
                """
                $status = Get-MpComputerStatus | Select-Object AntivirusEnabled, RealTimeProtectionEnabled
                $status | ConvertTo-Json
                """
            )

            if response.status_code == 0:
                status = json.loads(response.std_out.decode("utf-8"))
                result["antivirus"] = status.get("AntivirusEnabled")
                result["real_time_protection"] = status.get("RealTimeProtectionEnabled")
                logger.info(f"Successfully queried Defender status for {hostname}")
            else:
                error_msg = response.std_err.decode("utf-8") if response.std_err else "Unknown WinRM error"
                result["error"] = f"WinRM command failed: {error_msg}"
                logger.error(f"WinRM command failed for {hostname}: {error_msg}")
        except (WinRMError, WinRMTransportError) as exc:
            result["error"] = f"WinRM connection failed: {str(exc)}"
            logger.error(f"WinRM error for {hostname}: {exc}")
        except json.JSONDecodeError as exc:
            result["error"] = f"Failed to parse Defender status: {str(exc)}"
            logger.error(f"JSON parse error for {hostname}: {exc}")
        except Exception as exc:
            result["error"] = str(exc)
            logger.error(f"Unexpected error querying {hostname}: {exc}")

        return result

    def determine_compliance_status(self, defender_status: Dict[str, Any]) -> str:
        if defender_status.get("error"):
            return "Unknown"
        if defender_status.get("antivirus") and defender_status.get("real_time_protection"):
            return "Compliant"
        if defender_status.get("antivirus") or defender_status.get("real_time_protection"):
            return "Partial"
        return "Non-Compliant"

    def scan_all_assets(self, skip_dc: bool = True) -> List[Dict[str, Any]]:
        logger.info("Starting full asset scan...")

        computers = self.get_ad_computers()
        if skip_dc:
            computers = [c for c in computers if c["hostname"].lower() not in ["dc", "dc01", socket.gethostname().lower()]]
            logger.info(f"Skipping Domain Controller, scanning {len(computers)} client machines")

        for computer in computers:
            hostname = computer["hostname"]
            dns_hostname = computer.get("dns_hostname")
            logger.info(f"Processing asset: {hostname}")

            ip = self.resolve_hostname(hostname, dns_hostname)
            if not ip:
                self.scan_results.append(
                    {
                        "asset_name": hostname,
                        "ip_address": None,
                        "compliance_status": "Unknown",
                        "details": {
                            "error": "Could not resolve hostname to IP",
                            "operating_system": computer["os"],
                            "os_version": computer["os_version"],
                        },
                    }
                )
                continue

            defender_status = self.get_defender_status(hostname, ip)
            compliance_status = self.determine_compliance_status(defender_status)

            asset_result = {
                "asset_name": hostname,
                "ip_address": ip,
                "compliance_status": compliance_status,
                "details": {
                    "antivirus": defender_status.get("antivirus"),
                    "real_time_protection": defender_status.get("real_time_protection"),
                    "operating_system": computer["os"],
                    "os_version": computer["os_version"],
                },
            }

            if defender_status.get("error"):
                asset_result["details"]["error"] = defender_status["error"]

            self.scan_results.append(asset_result)

        logger.info(f"Scan complete. Scanned {len(self.scan_results)} assets.")
        return self.scan_results

    def get_results_json(self) -> str:
        return json.dumps(self.scan_results, indent=2)

    def save_results(self, filename: Optional[str] = None) -> str:
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"asset_scan_{timestamp}.json"

        with open(filename, "w", encoding="utf-8") as file_handle:
            json.dump(self.scan_results, file_handle, indent=2)

        logger.info(f"Results saved to: {filename}")
        return filename


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Security Dashboard Asset Scanner - scans real AD computers for compliance status",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python Asset_Scanner.py --domain corp.local --dc-ip 10.0.0.5 --username svc_scanner --password YOUR_PASSWORD
  python Asset_Scanner.py --output results.json
  python Asset_Scanner.py --ssl --include-dc
        """,
    )

    parser.add_argument("--domain", type=str, default=os.environ.get("AD_DOMAIN", ""), help="Active Directory domain name")
    parser.add_argument("--dc-ip", type=str, default=os.environ.get("AD_DC_IP", ""), help="Domain Controller IP address")
    parser.add_argument("--username", type=str, default=os.environ.get("AD_USERNAME", ""), help="Service account username")
    parser.add_argument("--password", type=str, default=os.environ.get("AD_PASSWORD", ""), help="Service account password")
    parser.add_argument("--output", type=str, default=None, help="Output JSON file path (default: auto-generated)")
    parser.add_argument("--ssl", action="store_true", help="Use LDAPS (SSL) for AD connection")
    parser.add_argument("--include-dc", action="store_true", help="Include Domain Controller in scan")
    parser.add_argument("--quiet", action="store_true", help="Suppress log output, only print JSON result")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    if args.quiet:
        logging.getLogger().setLevel(logging.ERROR)
    elif args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    missing_args = [name for name, value in {
        "domain": args.domain,
        "dc-ip": args.dc_ip,
        "username": args.username,
        "password": args.password,
    }.items() if not value]

    if missing_args:
        logger.error(
            "Missing required configuration: %s. Supply them as CLI flags or environment variables.",
            ", ".join(missing_args),
        )
        return 2

    try:
        scanner = AssetScanner(
            domain=args.domain,
            dc_ip=args.dc_ip,
            username=args.username,
            password=args.password,
            use_ssl=args.ssl,
        )

        results = scanner.scan_all_assets(skip_dc=not args.include_dc)
        print(scanner.get_results_json())

        if args.output:
            scanner.save_results(args.output)

        if len(results) == 0:
            logger.warning("No assets were scanned")
            return 1

        return 0
    except LDAPException as exc:
        logger.error(f"LDAP Error: {exc}")
        logger.error("Ensure the Domain Controller is running and credentials are correct")
        return 2
    except Exception as exc:
        logger.error(f"Scanner failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
