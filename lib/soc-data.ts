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
    status: 'Active' | 'Inactive' | 'Not Installed' | 'Unknown';
  };
  dlp: {
    installed: boolean;
    version?: string;
    lastUpdate?: string;
    status: 'Active' | 'Inactive' | 'Not Installed' | 'Unknown';
  };
  antivirus: {
    installed: boolean;
    version?: string;
    lastUpdate?: string;
    status: 'Active' | 'Inactive' | 'Not Installed' | 'Unknown';
  };
  lastScan: string;
  complianceStatus: 'Compliant' | 'Non-Compliant' | 'Partially Compliant' | 'Unknown';
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
export const sampleSOCEvents: SOCEvent[] = [];

// Sample SOC Metrics
export const currentSOCMetrics: SOCMetrics = {
  meanTimeToDetect: 0,
  meanTimeToRespond: 0,
  meanTimeToContain: 0,
  meanTimeToResolve: 0,
  alertsGenerated: 0,
  incidentsCreated: 0,
  incidentsResolved: 0,
  falsePositiveRate: 0,
  escalationRate: 0,
};

// Sample Remediation Tasks
export const sampleRemediationTasks: RemediationTask[] = [];

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
