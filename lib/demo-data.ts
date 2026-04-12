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
  total_assets: 18,
  edr_coverage_pct: 94,
  dlp_coverage_pct: 83,
  av_coverage_pct: 96,
  compliance_pct: 89,
};

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type DemoAssetSeed = {
  id: string;
  name: string;
  type: "Server" | "Workstation";
  department: string;
  ipAddress: string;
  criticality: "Critical" | "High" | "Medium" | "Low";
  complianceStatus: "Compliant" | "Partially Compliant" | "Non-Compliant";
  edrStatus: "Active" | "Inactive";
  dlpStatus: "Active" | "Inactive" | "Not Installed";
  antivirusStatus: "Active" | "Inactive";
  seenOnNetwork: boolean;
  telemetrySource: string;
  ipSource: "wazuh" | "network_scan" | "ad_dns" | "manual";
  networkMatchFields: string[];
  networkMatchScore: number;
  networkMatchStrength: "strong" | "medium" | "weak" | null;
  networkMatchReason: string;
  hoursAgo: number;
};

function buildControl(status: "Active" | "Inactive" | "Not Installed", version: string | undefined, hoursAgo: number) {
  return {
    installed: status !== "Not Installed",
    status,
    version,
    lastUpdate: status === "Not Installed" ? undefined : isoHoursAgo(hoursAgo),
  };
}

const demoAssetSeeds: DemoAssetSeed[] = [
  { id: "asset-1", name: "DC-01", type: "Server", department: "Identity Services", ipAddress: "10.20.1.10", criticality: "Critical", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "wazuh", networkMatchFields: ["hostname", "ip"], networkMatchScore: 98, networkMatchStrength: "strong", networkMatchReason: "Hostname and current IP match Active Directory and endpoint telemetry.", hoursAgo: 2 },
  { id: "asset-2", name: "DC-02", type: "Server", department: "Identity Services", ipAddress: "10.20.1.11", criticality: "Critical", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "wazuh", networkMatchFields: ["hostname", "ip"], networkMatchScore: 97, networkMatchStrength: "strong", networkMatchReason: "Domain controller confirmed by endpoint telemetry and subnet visibility.", hoursAgo: 3 },
  { id: "asset-3", name: "PAYROLL-SQL-01", type: "Server", department: "Core Banking", ipAddress: "10.20.4.21", criticality: "Critical", complianceStatus: "Non-Compliant", edrStatus: "Active", dlpStatus: "Not Installed", antivirusStatus: "Inactive", seenOnNetwork: false, telemetrySource: "CMDB import", ipSource: "manual", networkMatchFields: [], networkMatchScore: 0, networkMatchStrength: null, networkMatchReason: "No corroborating signals were observed in the latest discovery window.", hoursAgo: 20 },
  { id: "asset-4", name: "FIN-WS-042", type: "Workstation", department: "Finance", ipAddress: "10.20.12.42", criticality: "High", complianceStatus: "Partially Compliant", edrStatus: "Active", dlpStatus: "Inactive", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "network_scan", networkMatchFields: ["hostname", "ip"], networkMatchScore: 95, networkMatchStrength: "strong", networkMatchReason: "Finance workstation matched by hostname and IP during discovery.", hoursAgo: 4 },
  { id: "asset-5", name: "FIN-WS-018", type: "Workstation", department: "Finance", ipAddress: "10.20.12.18", criticality: "High", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "wazuh", networkMatchFields: ["hostname", "ip"], networkMatchScore: 94, networkMatchStrength: "strong", networkMatchReason: "Asset telemetry and scan evidence are aligned.", hoursAgo: 5 },
  { id: "asset-6", name: "TREASURY-LAP-07", type: "Workstation", department: "Treasury", ipAddress: "10.20.14.7", criticality: "High", complianceStatus: "Partially Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "ad_dns", networkMatchFields: ["hostname"], networkMatchScore: 84, networkMatchStrength: "medium", networkMatchReason: "Hostname and DNS evidence corroborate treasury laptop activity.", hoursAgo: 6 },
  { id: "asset-7", name: "SWIFT-APP-01", type: "Server", department: "Payments", ipAddress: "10.20.8.15", criticality: "Critical", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "wazuh", networkMatchFields: ["hostname", "ip"], networkMatchScore: 96, networkMatchStrength: "strong", networkMatchReason: "Payment application server confirmed by agent telemetry and subnet scan.", hoursAgo: 1 },
  { id: "asset-8", name: "KARACHI-BR-ATM-09", type: "Workstation", department: "Branch Operations", ipAddress: "10.20.22.9", criticality: "Medium", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Branch telemetry collector", ipSource: "network_scan", networkMatchFields: ["ip"], networkMatchScore: 76, networkMatchStrength: "medium", networkMatchReason: "ATM support terminal matched subnet records for the branch segment.", hoursAgo: 7 },
  { id: "asset-9", name: "HR-LAP-017", type: "Workstation", department: "Human Resources", ipAddress: "10.20.18.17", criticality: "Medium", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "ad_dns", networkMatchFields: ["hostname"], networkMatchScore: 82, networkMatchStrength: "medium", networkMatchReason: "Hostname aligned with Active Directory and recent DNS evidence.", hoursAgo: 8 },
  { id: "asset-10", name: "LEGAL-LAP-03", type: "Workstation", department: "Legal", ipAddress: "10.20.19.3", criticality: "Medium", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "wazuh", networkMatchFields: ["hostname", "ip"], networkMatchScore: 91, networkMatchStrength: "strong", networkMatchReason: "Host identity confirmed through endpoint telemetry and current IP evidence.", hoursAgo: 5 },
  { id: "asset-11", name: "OPS-JUMP-01", type: "Server", department: "Infrastructure", ipAddress: "10.20.2.50", criticality: "High", complianceStatus: "Partially Compliant", edrStatus: "Active", dlpStatus: "Not Installed", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Privileged access bastion logs", ipSource: "manual", networkMatchFields: ["hostname", "ip"], networkMatchScore: 88, networkMatchStrength: "strong", networkMatchReason: "Privileged jump host confirmed during network discovery.", hoursAgo: 9 },
  { id: "asset-12", name: "SOC-WS-12", type: "Workstation", department: "Security Operations", ipAddress: "10.20.30.12", criticality: "Medium", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "wazuh", networkMatchFields: ["hostname", "ip"], networkMatchScore: 93, networkMatchStrength: "strong", networkMatchReason: "SOC analyst workstation validated by telemetry and scan evidence.", hoursAgo: 2 },
  { id: "asset-13", name: "SOC-WS-14", type: "Workstation", department: "Security Operations", ipAddress: "10.20.30.14", criticality: "Medium", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "wazuh", networkMatchFields: ["hostname", "ip"], networkMatchScore: 92, networkMatchStrength: "strong", networkMatchReason: "Analyst endpoint is healthy and currently observed on the subnet.", hoursAgo: 3 },
  { id: "asset-14", name: "MKT-LAP-11", type: "Workstation", department: "Marketing", ipAddress: "10.20.24.11", criticality: "Low", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "network_scan", networkMatchFields: ["ip"], networkMatchScore: 74, networkMatchStrength: "weak", networkMatchReason: "Subnet evidence is current; hostname confirmation is pending refresh.", hoursAgo: 11 },
  { id: "asset-15", name: "RISK-LAP-02", type: "Workstation", department: "Risk Management", ipAddress: "10.20.26.2", criticality: "Medium", complianceStatus: "Partially Compliant", edrStatus: "Active", dlpStatus: "Inactive", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "wazuh", networkMatchFields: ["hostname", "ip"], networkMatchScore: 89, networkMatchStrength: "strong", networkMatchReason: "Risk analyst laptop matched AD identity and current endpoint telemetry.", hoursAgo: 10 },
  { id: "asset-16", name: "AUDIT-LAP-05", type: "Workstation", department: "Internal Audit", ipAddress: "10.20.28.5", criticality: "Low", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: true, telemetrySource: "Wazuh endpoint telemetry", ipSource: "ad_dns", networkMatchFields: ["hostname"], networkMatchScore: 81, networkMatchStrength: "medium", networkMatchReason: "Audit workstation validated by hostname correlation and DNS evidence.", hoursAgo: 14 },
  { id: "asset-17", name: "WEB-GW-02", type: "Server", department: "Digital Banking", ipAddress: "10.20.6.22", criticality: "High", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Not Installed", antivirusStatus: "Active", seenOnNetwork: false, telemetrySource: "Gateway management plane", ipSource: "manual", networkMatchFields: [], networkMatchScore: 0, networkMatchStrength: null, networkMatchReason: "Gateway is currently outside the scanned subnet window.", hoursAgo: 18 },
  { id: "asset-18", name: "PKI-CA-01", type: "Server", department: "Identity Services", ipAddress: "10.20.1.25", criticality: "Critical", complianceStatus: "Compliant", edrStatus: "Active", dlpStatus: "Active", antivirusStatus: "Active", seenOnNetwork: false, telemetrySource: "Certificate services monitoring", ipSource: "manual", networkMatchFields: [], networkMatchScore: 0, networkMatchStrength: null, networkMatchReason: "Restricted certificate authority host is intentionally excluded from general subnet sweep.", hoursAgo: 22 },
];

export const demoAssets = demoAssetSeeds.map((asset, index) => ({
  id: asset.id,
  name: asset.name,
  type: asset.type,
  department: asset.department,
  ipAddress: asset.ipAddress,
  criticality: asset.criticality,
  complianceStatus: asset.complianceStatus,
  edr: buildControl(asset.edrStatus, asset.edrStatus === "Active" ? `7.14.${(index % 3) + 1}` : "7.11.0", asset.hoursAgo),
  dlp: buildControl(asset.dlpStatus, asset.dlpStatus === "Not Installed" ? undefined : `5.3.${(index % 4) + 1}`, asset.hoursAgo + 2),
  antivirus: buildControl(asset.antivirusStatus, asset.antivirusStatus === "Active" ? `4.9.${(index % 5) + 3}` : "4.7.1", asset.hoursAgo + 1),
  lastScan: isoMinutesAgo(20 + index * 4),
  seenOnNetwork: asset.seenOnNetwork,
  telemetrySource: asset.telemetrySource,
  ipSource: asset.ipSource,
  ipLastSeen: asset.seenOnNetwork ? isoMinutesAgo(8 + index * 3) : isoHoursAgo(asset.hoursAgo),
  adLastSeen: isoHoursAgo(asset.hoursAgo + 1),
  wazuhLastSeen: asset.ipSource === "manual" ? undefined : isoMinutesAgo(12 + index * 3),
  networkLastSeen: asset.seenOnNetwork ? isoMinutesAgo(10 + index * 2) : undefined,
  lastObservedAt: asset.seenOnNetwork ? isoMinutesAgo(10 + index * 2) : isoHoursAgo(asset.hoursAgo),
  adPrimaryIp: asset.ipAddress,
  adDnsIpAddresses: [asset.ipAddress],
  networkMatchFields: asset.networkMatchFields,
  networkMatchScore: asset.networkMatchScore,
  networkMatchStrength: asset.networkMatchStrength,
  networkMatchReason: asset.networkMatchReason,
}));

export const demoNetworkDiscovery = {
  scan_range: "10.20.0.0/24",
  scanner: "nmap",
  nmap_available: true,
  scan_status: "completed",
  scanned_at: isoMinutesAgo(12),
  authenticated_assets: demoAssetSeeds
    .filter((asset) => asset.seenOnNetwork)
    .map((asset) => ({
      id: asset.id,
      hostname: asset.name,
      ip_address: asset.ipAddress,
      asset_type: asset.type === "Server" ? "server" : "workstation",
      criticality: asset.criticality.toLowerCase(),
      department: asset.department,
      seen_on_network: true,
      match_fields: asset.networkMatchFields as Array<"hostname" | "ip" | "mac">,
      match_score: asset.networkMatchScore,
      match_strength: asset.networkMatchStrength,
      match_reason: asset.networkMatchReason,
    })),
  unauthorized_assets: [
    {
      ip_address: "10.20.66.14",
      hostname: "OPS-SWITCH-EDGE",
      mac_address: "00:1A:79:4C:AA:14",
      vendor: "Hikvision",
      reason: "Visible on the operations subnet but not present in the authenticated asset inventory.",
    },
    {
      ip_address: "10.20.66.22",
      hostname: "UNKNOWN-IOT-22",
      mac_address: "3C:52:82:BF:31:22",
      vendor: "Ubiquiti",
      reason: "Responded to the latest sweep and failed trusted identity correlation thresholds.",
    },
  ],
  summary: {
    authenticated_total: demoAssetSeeds.length,
    authenticated_seen_on_network: demoAssetSeeds.filter((asset) => asset.seenOnNetwork).length,
    unauthorized_total: 2,
  },
};

export const demoRiskPosture = {
  overallScore: 74,
  averageRiskScore: 66,
  byCriticality: [
    { criticality: "critical", count: 4, avg_risk_score: 88 },
    { criticality: "high", count: 6, avg_risk_score: 75 },
    { criticality: "medium", count: 5, avg_risk_score: 58 },
    { criticality: "low", count: 3, avg_risk_score: 34 },
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
    total: demoAssetSeeds.length,
    coverage: 89,
  },
  risks: {
    critical: 2,
    high: 4,
    open: 7,
    avgScore: 66,
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
