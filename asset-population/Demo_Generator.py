#!/usr/bin/env python3
"""
Enhanced Demo Data Generator for Security Dashboard
===================================================

Generates realistic asset data with various compliance scenarios,
departments, risk levels, and time-series data.

Run this when you need test data without real infrastructure.
"""

import json
import random
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Realistic asset names by department
DEPARTMENTS = {
    "IT": ["SERVER", "DEVOPS", "NETWORK", "BACKUP"],
    "Finance": ["FINDESK", "ACCOUNTING", "PAYROLL", "AUDIT"],
    "HR": ["HRDESK", "RECRUIT", "TRAINING", "BENEFITS"],
    "Sales": ["SALES", "CRM", "DEMO", "CLIENT"],
    "Executive": ["EXEC", "CEO", "CFO", "BOARD"],
    "Operations": ["OPS", "LOGISTICS", "WAREHOUSE", "SHIPPING"],
    "Legal": ["LEGAL", "COMPLIANCE", "CONTRACT", "PATENT"],
    "Marketing": ["MARKETING", "DESIGN", "SOCIAL", "CONTENT"]
}

OS_VERSIONS = [
    "Windows 10 Pro",
    "Windows 10 Enterprise",
    "Windows 11 Pro",
    "Windows 11 Enterprise",
    "Windows Server 2022",
    "Windows Server 2019"
]

VULNERABILITIES = [
    "CVE-2024-1234: Critical RCE in Remote Desktop",
    "CVE-2024-5678: High Privilege Escalation",
    "CVE-2023-9999: Medium Information Disclosure",
    "CVE-2023-8888: Critical Zero-Day Exploit",
    "CVE-2024-7777: High Memory Corruption",
    "CVE-2024-6666: Medium Denial of Service"
]

SOFTWARE_PACKAGES = [
    "Microsoft Office 365",
    "Google Chrome 120.0.6099.109",
    "Mozilla Firefox 121.0",
    "Adobe Acrobat Reader DC 23.006",
    "Zoom Client 5.16.10",
    "Microsoft Teams 1.6.00.30767",
    "Slack 4.36.134",
    "7-Zip 23.01",
    "VLC Media Player 3.0.20",
    "Python 3.12.1",
    "Node.js 20.11.0",
    "Visual Studio Code 1.85.2",
    "Docker Desktop 4.26.1",
    "Git 2.43.0"
]


def generate_asset_name(department: str, index: int) -> str:
    """Generate a realistic asset name."""
    prefix = random.choice(DEPARTMENTS[department])
    suffix = f"{index:03d}"
    asset_type = random.choice(["LAPTOP", "DESKTOP", "WORKSTATION"])
    return f"{department.upper()}-{prefix}-{asset_type}-{suffix}"


def generate_ip_address(subnet: str = "192.168.1", start: int = 100) -> str:
    """Generate a valid IP address."""
    host = start + random.randint(0, 150)
    return f"{subnet}.{host}"


def generate_compliance_details(compliance_level: str) -> Dict[str, Any]:
    """Generate detailed compliance information based on level."""
    
    if compliance_level == "Compliant":
        return {
            "antivirus": True,
            "real_time_protection": True,
            "firewall_enabled": True,
            "encryption_enabled": True,
            "last_update": (datetime.now() - timedelta(days=random.randint(0, 7))).strftime("%Y-%m-%d"),
            "last_scan": datetime.now().isoformat() + "Z",
            "scan_duration_seconds": round(random.uniform(5.0, 15.0), 2),
            "vulnerabilities": [],
            "installed_software": random.sample(SOFTWARE_PACKAGES, k=random.randint(5, 10)),
            "patch_level": "Up to date",
            "compliance_score": random.randint(90, 100),
            "alerts": []
        }
    
    elif compliance_level == "Non-Compliant":
        alerts = []
        details = {
            "antivirus": random.choice([True, False]),
            "real_time_protection": False,
            "firewall_enabled": random.choice([True, False]),
            "encryption_enabled": False,
            "last_update": (datetime.now() - timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d"),
            "last_scan": datetime.now().isoformat() + "Z",
            "scan_duration_seconds": round(random.uniform(5.0, 15.0), 2),
            "vulnerabilities": random.sample(VULNERABILITIES, k=random.randint(1, 4)),
            "installed_software": random.sample(SOFTWARE_PACKAGES, k=random.randint(5, 10)),
            "patch_level": "Outdated",
            "compliance_score": random.randint(20, 50),
            "alerts": []
        }
        
        if not details["antivirus"]:
            alerts.append("Antivirus not installed or disabled")
        if not details["real_time_protection"]:
            alerts.append("Real-time protection disabled")
        if not details["firewall_enabled"]:
            alerts.append("Windows Firewall is disabled")
        if not details["encryption_enabled"]:
            alerts.append("BitLocker encryption not enabled")
        
        days_overdue = (datetime.now() - datetime.strptime(details["last_update"], "%Y-%m-%d")).days
        if days_overdue > 30:
            alerts.append(f"Windows updates {days_overdue} days overdue")
        
        if len(details["vulnerabilities"]) > 0:
            alerts.append(f"{len(details['vulnerabilities'])} critical vulnerabilities detected")
        
        details["alerts"] = alerts
        return details
    
    elif compliance_level == "Critical":
        return {
            "antivirus": False,
            "real_time_protection": False,
            "firewall_enabled": False,
            "encryption_enabled": False,
            "last_update": (datetime.now() - timedelta(days=random.randint(180, 365))).strftime("%Y-%m-%d"),
            "last_scan": datetime.now().isoformat() + "Z",
            "scan_duration_seconds": round(random.uniform(5.0, 15.0), 2),
            "vulnerabilities": random.sample(VULNERABILITIES, k=random.randint(3, 6)),
            "installed_software": random.sample(SOFTWARE_PACKAGES, k=random.randint(5, 10)),
            "patch_level": "Severely outdated",
            "compliance_score": random.randint(0, 30),
            "alerts": [
                "CRITICAL: No antivirus protection",
                "CRITICAL: Firewall disabled",
                "CRITICAL: Windows updates over 180 days overdue",
                "CRITICAL: Multiple high-severity vulnerabilities",
                "WARNING: No disk encryption",
                "WARNING: System at high risk of compromise"
            ]
        }
    
    else:  # Partial
        return {
            "antivirus": True,
            "real_time_protection": random.choice([True, False]),
            "firewall_enabled": True,
            "encryption_enabled": random.choice([True, False]),
            "last_update": (datetime.now() - timedelta(days=random.randint(10, 30))).strftime("%Y-%m-%d"),
            "last_scan": datetime.now().isoformat() + "Z",
            "scan_duration_seconds": round(random.uniform(5.0, 15.0), 2),
            "vulnerabilities": random.sample(VULNERABILITIES, k=random.randint(0, 2)),
            "installed_software": random.sample(SOFTWARE_PACKAGES, k=random.randint(5, 10)),
            "patch_level": "Partially updated",
            "compliance_score": random.randint(60, 80),
            "alerts": [
                "Real-time protection may be disabled",
                "Some Windows updates pending"
            ]
        }


def generate_asset(department: str, index: int, compliance_bias: str = "mixed") -> Dict[str, Any]:
    """Generate a single asset with realistic data."""
    
    # Determine compliance status based on bias
    if compliance_bias == "compliant":
        compliance_status = random.choices(
            ["Compliant", "Partial", "Non-Compliant", "Critical"],
            weights=[80, 15, 4, 1]
        )[0]
    elif compliance_bias == "non-compliant":
        compliance_status = random.choices(
            ["Compliant", "Partial", "Non-Compliant", "Critical"],
            weights=[10, 20, 50, 20]
        )[0]
    elif compliance_bias == "critical":
        compliance_status = random.choices(
            ["Compliant", "Partial", "Non-Compliant", "Critical"],
            weights=[5, 10, 35, 50]
        )[0]
    else:  # mixed
        compliance_status = random.choices(
            ["Compliant", "Partial", "Non-Compliant", "Critical"],
            weights=[50, 25, 20, 5]
        )[0]
    
    asset_name = generate_asset_name(department, index)
    ip_address = generate_ip_address()
    os_version = random.choice(OS_VERSIONS)
    
    asset = {
        "asset_name": asset_name,
        "ip_address": ip_address,
        "department": department,
        "compliance_status": compliance_status,
        "risk_score": random.randint(0, 100) if compliance_status != "Compliant" else random.randint(0, 30),
        "details": generate_compliance_details(compliance_status)
    }
    
    asset["details"]["operating_system"] = os_version
    asset["details"]["hostname"] = asset_name
    asset["details"]["department"] = department
    
    return asset


def generate_demo_data(count: int = 50, compliance_bias: str = "mixed") -> List[Dict[str, Any]]:
    """Generate multiple demo assets."""
    
    assets = []
    departments = list(DEPARTMENTS.keys())
    
    # Distribute assets across departments
    assets_per_dept = count // len(departments)
    remainder = count % len(departments)
    
    index = 1
    for dept_idx, department in enumerate(departments):
        dept_count = assets_per_dept + (1 if dept_idx < remainder else 0)
        
        for i in range(dept_count):
            asset = generate_asset(department, index, compliance_bias)
            assets.append(asset)
            index += 1
    
    return assets


def main():
    parser = argparse.ArgumentParser(
        description="Generate realistic demo data for Security Dashboard",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python Demo_Generator.py                          # Generate 50 mixed assets
  python Demo_Generator.py --count 200              # Generate 200 assets
  python Demo_Generator.py --scenario compliant     # Mostly compliant assets
  python Demo_Generator.py --scenario critical      # Mostly critical assets
  python Demo_Generator.py --output demo.json       # Save to specific file
        """
    )
    
    parser.add_argument('--count', type=int, default=50,
                        help='Number of assets to generate (default: 50)')
    parser.add_argument('--scenario', choices=['mixed', 'compliant', 'non-compliant', 'critical'],
                        default='mixed',
                        help='Compliance distribution scenario (default: mixed)')
    parser.add_argument('--output', type=str, default=None,
                        help='Output file path (default: print to stdout)')
    parser.add_argument('--pretty', action='store_true', default=True,
                        help='Pretty-print JSON output (default: true)')
    
    args = parser.parse_args()
    
    print(f"Generating {args.count} demo assets with '{args.scenario}' scenario...", file=__import__('sys').stderr)
    
    # Generate data
    assets = generate_demo_data(count=args.count, compliance_bias=args.scenario)
    
    # Output
    json_output = json.dumps(assets, indent=2 if args.pretty else None)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(json_output)
        print(f"✓ Generated {len(assets)} assets and saved to: {args.output}", file=__import__('sys').stderr)
    else:
        print(json_output)
    
    # Print summary
    compliant = sum(1 for a in assets if a['compliance_status'] == 'Compliant')
    partial = sum(1 for a in assets if a['compliance_status'] == 'Partial')
    non_compliant = sum(1 for a in assets if a['compliance_status'] == 'Non-Compliant')
    critical = sum(1 for a in assets if a['compliance_status'] == 'Critical')
    
    print(f"\nSummary:", file=__import__('sys').stderr)
    print(f"  Compliant: {compliant} ({compliant/len(assets)*100:.1f}%)", file=__import__('sys').stderr)
    print(f"  Partial: {partial} ({partial/len(assets)*100:.1f}%)", file=__import__('sys').stderr)
    print(f"  Non-Compliant: {non_compliant} ({non_compliant/len(assets)*100:.1f}%)", file=__import__('sys').stderr)
    print(f"  Critical: {critical} ({critical/len(assets)*100:.1f}%)", file=__import__('sys').stderr)


if __name__ == '__main__':
    main()
