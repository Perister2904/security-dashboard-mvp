export type DemoUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "admin" | "ciso" | "soc_analyst";
  department: string;
  accessLevel: "Executive" | "Departmental" | "Limited";
  permissions: string[];
};

type DemoCredential = {
  aliases: string[];
  password: string;
  user: DemoUser;
};

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

const adminUser: DemoUser = {
  id: "demo-admin",
  name: "Sarah Khan",
  email: "admin@company.local",
  username: "admin",
  role: "admin",
  department: "Information Security",
  accessLevel: "Executive",
  permissions: ["view_all_reports", "executive_dashboard", "full_access", "user_management"],
};

const cisoUser: DemoUser = {
  id: "demo-ciso",
  name: "Ayesha Rahman",
  email: "ciso@company.local",
  username: "ciso",
  role: "ciso",
  department: "Cybersecurity Leadership",
  accessLevel: "Executive",
  permissions: ["view_all_reports", "executive_dashboard", "security_oversight", "approve_all", "full_access"],
};

const analystUser: DemoUser = {
  id: "demo-analyst",
  name: "Bilal Ahmed",
  email: "demo@security.local",
  username: "demo",
  role: "soc_analyst",
  department: "Security Operations",
  accessLevel: "Departmental",
  permissions: ["view_own_reports", "submit_incidents", "view_soc_reports"],
};

const demoCredentials: DemoCredential[] = [
  {
    aliases: ["admin", "admin@company.local"],
    password: "Admin@123",
    user: adminUser,
  },
  {
    aliases: ["ciso", "ciso@company.local"],
    password: "Ciso@123",
    user: cisoUser,
  },
  {
    aliases: ["demo", "demo@security.local"],
    password: "demo123",
    user: analystUser,
  },
];

export function getDemoUserForCredentials(emailOrUsername: string, password: string): DemoUser | null {
  const normalized = emailOrUsername.trim().toLowerCase();
  const match = demoCredentials.find((candidate) => candidate.password === password && candidate.aliases.includes(normalized));
  return match ? match.user : null;
}

export function isPresentationDemoMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem("auth_mode") === "demo";
}

export const demoSocMetrics = {
  active_incidents: 4,
  critical_incidents: 1,
  mttr: 4.5,
  mtd: 8.5,
  mtr: 12.3,
  mtc: 45.2,
  alerts_24h: 1247,
  incidents_created: 23,
  incidents_resolved: 19,
  false_positive_rate: 11,
  escalation_rate: 18,
};

export const demoSocIncidents = [
  {
    id: "soc-1",
    title: "Multiple Failed Login Attempts Detected",
    description: "Brute force activity targeting privileged accounts was blocked by MFA and conditional access policy.",
    severity: "Critical",
    status: "In Progress",
    source: "SIEM - Authentication Logs",
    timestamp: isoMinutesAgo(3),
  },
  {
    id: "soc-2",
    title: "Suspicious Outbound Traffic",
    description: "Unusual data transfer from a finance endpoint to a newly seen external IP was isolated for review.",
    severity: "High",
    status: "Open",
    source: "Firewall - NetFlow Analytics",
    timestamp: isoMinutesAgo(18),
  },
  {
    id: "soc-3",
    title: "Potential Phishing Email Campaign",
    description: "Email gateway quarantined a coordinated credential-harvesting attempt across finance and treasury staff.",
    severity: "Medium",
    status: "In Progress",
    source: "Secure Email Gateway",
    timestamp: isoMinutesAgo(52),
  },
  {
    id: "soc-4",
    title: "Malware Contained on Finance Workstation",
    description: "Endpoint controls blocked execution and containment completed before lateral movement occurred.",
    severity: "Critical",
    status: "Resolved",
    source: "EDR - CrowdStrike",
    timestamp: isoHoursAgo(5),
  },
];

export const demoCoverageStats = {
  total_assets: 142,
  edr_coverage_pct: 93,
  dlp_coverage_pct: 88,
  av_coverage_pct: 96,
  compliance_pct: 91,
};

export const demoAssets = [
  {
    id: "asset-1",
    name: 'DC-01',
    type: "Server",
    department: "Identity Services",
    ipAddress: "10.20.1.10",
    criticality: "Critical",
    complianceStatus: "Compliant",
    edr: { installed: true, status: "Active", version: "7.14.2", lastUpdate: isoHoursAgo(2) },
    dlp: { installed: true, status: "Active", version: "5.3.1", lastUpdate: isoHoursAgo(6) },
    antivirus: { installed: true, status: "Active", version: "4.9.8", lastUpdate: isoHoursAgo(1) },
    lastScan: isoMinutesAgo(40),
    seenOnNetwork: true,
    telemetrySource: "Wazuh endpoint telemetry",
    ipSource: "wazuh",
    ipLastSeen: isoMinutesAgo(7),
    adLastSeen: isoHoursAgo(2),
    wazuhLastSeen: isoMinutesAgo(7),
    networkLastSeen: isoMinutesAgo(11),
    lastObservedAt: isoMinutesAgo(7),
    adPrimaryIp: "10.20.1.10",
    adDnsIpAddresses: ["10.20.1.10"],
    networkMatchFields: ["hostname", "ip"],
    networkMatchScore: 98,
    networkMatchStrength: "strong",
    networkMatchReason: "Hostname and current IP match AD inventory and recent telemetry.",
  },
  {
    id: "asset-2",
    name: "FIN-WS-042",
    type: "Workstation",
    department: "Finance",
    ipAddress: "10.20.12.42",
    criticality: "High",
    complianceStatus: "Partially Compliant",
    edr: { installed: true, status: "Active", version: "7.14.2", lastUpdate: isoHoursAgo(3) },
    dlp: { installed: true, status: "Inactive", version: "5.1.0", lastUpdate: isoDaysAgo(1) },
    antivirus: { installed: true, status: "Active", version: "4.9.8", lastUpdate: isoHoursAgo(4) },
    lastScan: isoMinutesAgo(55),
    seenOnNetwork: true,
    telemetrySource: "Wazuh endpoint telemetry",
    ipSource: "network_scan",
    ipLastSeen: isoMinutesAgo(12),
    adLastSeen: isoHoursAgo(5),
    wazuhLastSeen: isoMinutesAgo(15),
    networkLastSeen: isoMinutesAgo(12),
    lastObservedAt: isoMinutesAgo(12),
    adPrimaryIp: "10.20.12.42",
    adDnsIpAddresses: ["10.20.12.42"],
    networkMatchFields: ["hostname", "ip"],
    networkMatchScore: 95,
    networkMatchStrength: "strong",
    networkMatchReason: "Finance workstation was confirmed by AD hostname and subnet scan.",
  },
  {
    id: "asset-3",
    name: "HR-LAP-017",
    type: "Workstation",
    department: "Human Resources",
    ipAddress: "10.20.18.17",
    criticality: "Medium",
    complianceStatus: "Compliant",
    edr: { installed: true, status: "Active", version: "7.14.2", lastUpdate: isoHoursAgo(8) },
    dlp: { installed: true, status: "Active", version: "5.3.1", lastUpdate: isoHoursAgo(9) },
    antivirus: { installed: true, status: "Active", version: "4.9.8", lastUpdate: isoHoursAgo(7) },
    lastScan: isoMinutesAgo(72),
    seenOnNetwork: true,
    telemetrySource: "Wazuh endpoint telemetry",
    ipSource: "ad_dns",
    ipLastSeen: isoHoursAgo(2),
    adLastSeen: isoHoursAgo(4),
    wazuhLastSeen: isoHoursAgo(2),
    networkLastSeen: isoMinutesAgo(25),
    lastObservedAt: isoMinutesAgo(25),
    adPrimaryIp: "10.20.18.17",
    adDnsIpAddresses: ["10.20.18.17"],
    networkMatchFields: ["hostname"],
    networkMatchScore: 82,
    networkMatchStrength: "medium",
    networkMatchReason: "Hostname aligned with AD, IP confirmed by recent DNS evidence.",
  },
  {
    id: "asset-4",
    name: "PAYROLL-SQL-01",
    type: "Server",
    department: "Core Banking",
    ipAddress: "10.20.4.21",
    criticality: "Critical",
    complianceStatus: "Non-Compliant",
    edr: { installed: true, status: "Active", version: "7.13.0", lastUpdate: isoDaysAgo(2) },
    dlp: { installed: false, status: "Not Installed", version: undefined, lastUpdate: undefined },
    antivirus: { installed: true, status: "Inactive", version: "4.8.1", lastUpdate: isoDaysAgo(5) },
    lastScan: isoMinutesAgo(95),
    seenOnNetwork: false,
    telemetrySource: "CMDB import",
    ipSource: "manual",
    ipLastSeen: isoDaysAgo(1),
    adLastSeen: isoDaysAgo(1),
    wazuhLastSeen: undefined,
    networkLastSeen: undefined,
    lastObservedAt: isoDaysAgo(1),
    adPrimaryIp: "10.20.4.21",
    adDnsIpAddresses: ["10.20.4.21"],
    networkMatchFields: [],
    networkMatchScore: 0,
    networkMatchStrength: null,
    networkMatchReason: "No corroborating signals in the latest network sweep.",
  },
];

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const demoNetworkDiscovery = {
  scan_range: "10.20.0.0/24",
  scanner: "nmap",
  nmap_available: true,
  scan_status: "completed",
  scanned_at: isoMinutesAgo(12),
  authenticated_assets: [
    {
      id: "asset-1",
      hostname: "DC-01",
      ip_address: "10.20.1.10",
      asset_type: "server",
      criticality: "critical",
      department: "Identity Services",
      seen_on_network: true,
      match_fields: ["hostname", "ip"],
      match_score: 98,
      match_strength: "strong",
      match_reason: "Confirmed by hostname and IP correlation.",
    },
    {
      id: "asset-2",
      hostname: "FIN-WS-042",
      ip_address: "10.20.12.42",
      asset_type: "workstation",
      criticality: "high",
      department: "Finance",
      seen_on_network: true,
      match_fields: ["hostname", "ip"],
      match_score: 95,
      match_strength: "strong",
      match_reason: "Finance workstation matched AD and scan telemetry.",
    },
    {
      id: "asset-3",
      hostname: "HR-LAP-017",
      ip_address: "10.20.18.17",
      asset_type: "workstation",
      criticality: "medium",
      department: "Human Resources",
      seen_on_network: true,
      match_fields: ["hostname"],
      match_score: 82,
      match_strength: "medium",
      match_reason: "Hostname match with recent DNS support.",
    },
  ],
  unauthorized_assets: [
    {
      ip_address: "10.20.66.14",
      hostname: "UNKNOWN-IOT-14",
      mac_address: "00:1A:79:4C:AA:14",
      vendor: "Shenzhen IoT Vendor",
      reason: "Visible on subnet but no authenticated AD asset or approved CMDB entry exists.",
    },
    {
      ip_address: "10.20.66.22",
      hostname: null,
      mac_address: "3C:52:82:BF:31:22",
      vendor: "Unknown",
      reason: "Unmanaged host responded to scan and failed trusted correlation thresholds.",
    },
  ],
  summary: {
    authenticated_total: 142,
    authenticated_seen_on_network: 118,
    unauthorized_total: 2,
  },
};

export const demoRiskPosture = {
  overallScore: 74,
  averageRiskScore: 68,
  byCriticality: [
    { criticality: "critical", count: 18, avg_risk_score: 88 },
    { criticality: "high", count: 41, avg_risk_score: 74 },
    { criticality: "medium", count: 56, avg_risk_score: 61 },
    { criticality: "low", count: 27, avg_risk_score: 37 },
  ],
};

export const demoExecutiveSummary = {
  security: {
    activeIncidents: 4,
    criticalIncidents: 1,
    mttr: 4.5,
    alertVolume: 1247,
  },
  assets: {
    total: 142,
    coverage: 91,
  },
  risks: {
    critical: 2,
    high: 5,
    open: 11,
    avgScore: 68,
  },
};

export const demoSocSummary = {
  mtr: 12.3,
  mttr: 4.5,
  incidents_created: 23,
  incidents_resolved: 19,
};

export const demoTopRisks = [
  {
    id: "risk-1",
    title: "Privilege escalation path in payroll domain",
    description: "An inherited service-account permission chain could allow broad lateral movement into payroll systems.",
    risk_score: 89,
    priority: "Critical",
    mitigation_plan: "Reduce delegated rights and rotate exposed service credentials this week.",
    owner: "Identity Engineering",
    status: "Mitigation In Progress",
  },
  {
    id: "risk-2",
    title: "Incomplete DLP coverage on finance endpoints",
    description: "A subset of finance laptops is operating without current DLP telemetry, reducing exfiltration visibility.",
    risk_score: 77,
    priority: "High",
    mitigation_plan: "Reinstall agents during the next endpoint maintenance window.",
    owner: "Endpoint Security",
    status: "Scheduled",
  },
  {
    id: "risk-3",
    title: "Unmanaged devices detected on restricted subnet",
    description: "Network discovery flagged two hosts outside the authenticated AD inventory in a restricted zone.",
    risk_score: 74,
    priority: "High",
    mitigation_plan: "Physically validate devices and isolate switch ports until ownership is confirmed.",
    owner: "Network Operations",
    status: "Open",
  },
  {
    id: "risk-4",
    title: "Legacy antivirus signatures on payroll SQL server",
    description: "Critical payroll infrastructure is protected but running outdated endpoint signatures.",
    risk_score: 71,
    priority: "High",
    mitigation_plan: "Emergency maintenance patch approved for tonight's change window.",
    owner: "Server Operations",
    status: "Approved",
  },
];
