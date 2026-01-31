// SOC Performance Data Structures

export interface SOCEvent {
  id: string;
  timestamp: string;
  type: 'alert' | 'incident' | 'investigation' | 'resolved';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  source: string;
  assignedTo: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  detectionTime: string;
  responseTime?: string;
  containmentTime?: string;
  resolutionTime?: string;
}

export interface SOCMetrics {
  meanTimeToDetect: number; // in minutes
  meanTimeToRespond: number; // in minutes
  meanTimeToContain: number; // in minutes
  meanTimeToResolve: number; // in hours
  alertsGenerated: number;
  incidentsCreated: number;
  incidentsResolved: number;
  falsePositiveRate: number; // percentage
  escalationRate: number; // percentage
}

export interface RemediationTask {
  id: string;
  title: string;
  description: string;
  relatedEvent: string;
  assignedTo: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Blocked';
  dueDate: string;
  completedDate?: string;
  progress: number; // 0-100
  steps: {
    step: string;
    completed: boolean;
  }[];
}

export interface Asset {
  id: string;
  name: string;
  type: 'Server' | 'Workstation' | 'Network Device' | 'Mobile' | 'Cloud Service';
  ipAddress?: string;
  department: string;
  criticality: 'Critical' | 'High' | 'Medium' | 'Low';
  edr: {
    installed: boolean;
    version?: string;
    lastUpdate?: string;
    status: 'Active' | 'Inactive' | 'Not Installed';
  };
  dlp: {
    installed: boolean;
    version?: string;
    lastUpdate?: string;
    status: 'Active' | 'Inactive' | 'Not Installed';
  };
  antivirus: {
    installed: boolean;
    version?: string;
    lastUpdate?: string;
    status: 'Active' | 'Inactive' | 'Not Installed';
  };
  lastScan: string;
  complianceStatus: 'Compliant' | 'Non-Compliant' | 'Partially Compliant';
}

export interface RiskPosture {
  overallScore: number; // 0-100
  trend: 'improving' | 'stable' | 'worsening';
  criticalRisks: {
    title: string;
    description: string;
    businessImpact: string;
    likelihood: number;
    impact: number;
    riskScore: number;
  }[];
  coverageGaps: {
    assetCount: number;
    missingTools: string[];
    department: string;
  }[];
}

// Sample SOC Events
export const sampleSOCEvents: SOCEvent[] = [
  {
    id: 'EVT-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    type: 'alert',
    severity: 'Critical',
    title: 'Multiple Failed Login Attempts Detected',
    description: 'Brute force attack detected from IP 192.168.1.100 targeting admin account',
    source: 'SIEM - Authentication Logs',
    assignedTo: 'SOC Analyst - Ahmed',
    status: 'In Progress',
    detectionTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    responseTime: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'EVT-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    type: 'incident',
    severity: 'High',
    title: 'Suspicious Outbound Traffic',
    description: 'Unusual data transfer detected to external IP in high-risk region',
    source: 'Firewall - NetFlow Analysis',
    assignedTo: 'SOC Lead - Fatima',
    status: 'Open',
    detectionTime: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'EVT-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    type: 'investigation',
    severity: 'Medium',
    title: 'Potential Phishing Email Campaign',
    description: '15 employees received emails with suspicious attachments',
    source: 'Email Security Gateway',
    assignedTo: 'SOC Analyst - Ali',
    status: 'In Progress',
    detectionTime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    responseTime: new Date(Date.now() - 1000 * 60 * 105).toISOString(),
  },
  {
    id: 'EVT-004',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    type: 'resolved',
    severity: 'Critical',
    title: 'Malware Detected on Finance Workstation',
    description: 'Trojan detected and quarantined on FIN-WS-042',
    source: 'EDR - CrowdStrike',
    assignedTo: 'SOC Analyst - Ahmed',
    status: 'Resolved',
    detectionTime: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    responseTime: new Date(Date.now() - 1000 * 60 * 295).toISOString(),
    containmentTime: new Date(Date.now() - 1000 * 60 * 285).toISOString(),
    resolutionTime: new Date(Date.now() - 1000 * 60 * 270).toISOString(),
  },
];

// Sample SOC Metrics
export const currentSOCMetrics: SOCMetrics = {
  meanTimeToDetect: 8.5, // 8.5 minutes
  meanTimeToRespond: 12.3, // 12.3 minutes  
  meanTimeToContain: 45.2, // 45.2 minutes
  meanTimeToResolve: 4.5, // 4.5 hours
  alertsGenerated: 1247,
  incidentsCreated: 89,
  incidentsResolved: 76,
  falsePositiveRate: 12.5, // 12.5%
  escalationRate: 8.2, // 8.2%
};

// Sample Remediation Tasks
export const sampleRemediationTasks: RemediationTask[] = [
  {
    id: 'REM-001',
    title: 'Patch Critical SQL Injection Vulnerability',
    description: 'Apply security patch to authentication endpoint',
    relatedEvent: 'RPT-001',
    assignedTo: 'Dev Team Lead - Hassan',
    priority: 'Critical',
    status: 'In Progress',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    progress: 65,
    steps: [
      { step: 'Code review completed', completed: true },
      { step: 'Patch developed', completed: true },
      { step: 'Testing in staging environment', completed: false },
      { step: 'Deploy to production', completed: false },
    ],
  },
  {
    id: 'REM-002',
    title: 'Update EDR on All Finance Workstations',
    description: 'Deploy latest EDR version to ensure malware protection',
    relatedEvent: 'EVT-004',
    assignedTo: 'IT Admin - Zainab',
    priority: 'High',
    status: 'In Progress',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    progress: 45,
    steps: [
      { step: 'Download EDR package', completed: true },
      { step: 'Test on pilot group', completed: true },
      { step: 'Roll out to Finance department (45/120 complete)', completed: false },
      { step: 'Verify all installations', completed: false },
    ],
  },
  {
    id: 'REM-003',
    title: 'Implement MFA for Admin Accounts',
    description: 'Enable multi-factor authentication to prevent brute force attacks',
    relatedEvent: 'EVT-001',
    assignedTo: 'Security Engineer - Usman',
    priority: 'Critical',
    status: 'Not Started',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    progress: 0,
    steps: [
      { step: 'Select MFA solution', completed: false },
      { step: 'Configure MFA server', completed: false },
      { step: 'Enroll admin users', completed: false },
      { step: 'Enforce MFA policy', completed: false },
    ],
  },
];

// NO SAMPLE ASSETS - Use real backend data only
export const sampleAssets: Asset[] = [];

// NO SAMPLE RISK POSTURE - Use real backend data only
export const currentRiskPosture: RiskPosture = {
  overallScore: 0,
  trend: 'stable',
  criticalRisks: [],
  coverageGaps: [],
};

// Helper function to format time duration
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  } else {
    const hours = minutes / 60;
    return `${hours.toFixed(1)} hrs`;
  }
}

// Helper function to calculate time difference
export function calculateTimeDiff(start: string, end: string): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return (endTime - startTime) / (1000 * 60); // Return in minutes
}

// Helper function to get status color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'Open':
    case 'Not Started':
      return 'text-gray-600 bg-gray-100 dark:bg-gray-800';
    case 'In Progress':
      return 'text-blue-600 bg-blue-100 dark:bg-blue-900';
    case 'Resolved':
    case 'Completed':
      return 'text-green-600 bg-green-100 dark:bg-green-900';
    case 'Blocked':
      return 'text-red-600 bg-red-100 dark:bg-red-900';
    case 'Closed':
      return 'text-purple-600 bg-purple-100 dark:bg-purple-900';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}
