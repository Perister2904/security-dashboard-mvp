// Real-time updates and live data system
import { Report } from './reports';

export class RealTimeManager {
  private static listeners: Array<(reports: Report[]) => void> = [];
  private static reports: Report[] = [];
  private static updateInterval: NodeJS.Timeout | null = null;

  static initialize(initialReports: Report[]): void {
    this.reports = [...initialReports];
    this.startRealTimeUpdates();
  }

  static subscribe(callback: (reports: Report[]) => void): () => void {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  static addReport(report: Report): void {
    this.reports.unshift(report); // Add to beginning for latest first
    this.notifyListeners();
    this.simulateWorkflowProgress(report.id);
  }

  static updateReportStatus(reportId: string, status: string, assignedTo?: string): void {
    const reportIndex = this.reports.findIndex(r => r.id === reportId);
    if (reportIndex !== -1) {
      this.reports[reportIndex] = {
        ...this.reports[reportIndex],
        status: status as any,
        assignedTo,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      this.notifyListeners();
    }
  }

  static getReports(): Report[] {
    return [...this.reports];
  }

  private static notifyListeners(): void {
    this.listeners.forEach(callback => callback([...this.reports]));
  }

  private static startRealTimeUpdates(): void {
    // Simulate real-time updates every 10 seconds
    this.updateInterval = setInterval(() => {
      this.simulateNewActivity();
    }, 10000);
  }

  private static simulateNewActivity(): void {
    // Occasionally simulate new reports or status updates
    if (Math.random() > 0.7) {
      const randomReport = this.generateRandomReport();
      this.addReport(randomReport);
    }
    
    // Update existing report statuses
    if (Math.random() > 0.8) {
      const pendingReports = this.reports.filter(r => r.status === 'Under Review');
      if (pendingReports.length > 0) {
        const report = pendingReports[Math.floor(Math.random() * pendingReports.length)];
        this.updateReportStatus(report.id, 'Approved', 'Development Team');
      }
    }
  }

  private static simulateWorkflowProgress(reportId: string): void {
    // Simulate workflow progression over time
    setTimeout(() => {
      this.updateReportStatus(reportId, 'Under Review', 'Security Architect');
    }, 5000);

    setTimeout(() => {
      this.updateReportStatus(reportId, 'Approved', 'Development Team');
    }, 15000);
  }

  private static generateRandomReport(): Report {
    const reportTypes = ['vulnerability', 'incident', 'fix', 'audit'];
    const severities = ['Critical', 'High', 'Medium', 'Low'];
    const departments = ['SOC', 'Security Testing', 'Security Architecture'];
    const titles = [
      'Suspicious Login Activity Detected',
      'Outdated SSL Certificate Found',
      'Malware Detection in Email System',
      'Unauthorized API Access Attempt',
      'Database Query Performance Issue'
    ];

    const reportId = `RPT-${String(Date.now()).slice(-3)}`;
    const type = reportTypes[Math.floor(Math.random() * reportTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const title = titles[Math.floor(Math.random() * titles.length)];

    return {
      id: reportId,
      title,
      type: type as any,
      severity: severity as any,
      submittedBy: "System Auto-Detection",
      submittedByRole: "SOC Analyst",
      department,
      status: 'Submitted',
      dateSubmitted: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0],
      technicalContent: `Automated detection system identified potential ${type} requiring investigation. Preliminary analysis suggests ${severity.toLowerCase()} priority based on system impact assessment.`,
      affectedSystems: ['Core Banking System', 'Network Infrastructure'],
      workflowStage: 'Initial Review',
      nextAction: 'Awaiting analyst assignment'
    };
  }

  static cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.listeners = [];
  }
}

// Pentest verification with animation states
export interface PentestVerification {
  reportId: string;
  status: 'idle' | 'scanning' | 'analyzing' | 'complete' | 'error';
  progress: number;
  currentStep: string;
  results?: {
    vulnerabilityFixed: boolean;
    details: string;
    recommendations?: string[];
  };
}

export class PentestVerificationManager {
  private static verifications: Map<string, PentestVerification> = new Map();
  private static listeners: Array<(verification: PentestVerification) => void> = [];

  static startVerification(reportId: string, callback: (verification: PentestVerification) => void): void {
    const verification: PentestVerification = {
      reportId,
      status: 'scanning',
      progress: 0,
      currentStep: 'Initializing security scanners...'
    };

    this.verifications.set(reportId, verification);
    this.listeners.push(callback);

    this.runVerificationSteps(reportId, callback);
  }

  private static async runVerificationSteps(reportId: string, callback: (verification: PentestVerification) => void): Promise<void> {
    const steps = [
      { step: 'Initializing security scanners...', duration: 1000, progress: 10 },
      { step: 'Running OWASP ZAP scan...', duration: 2000, progress: 30 },
      { step: 'Executing Nuclei templates...', duration: 1500, progress: 50 },
      { step: 'Performing Trivy analysis...', duration: 1000, progress: 70 },
      { step: 'Analyzing results...', duration: 1500, progress: 90 },
      { step: 'Generating report...', duration: 500, progress: 100 }
    ];

    for (const { step, duration, progress } of steps) {
      const verification = this.verifications.get(reportId);
      if (verification) {
        verification.currentStep = step;
        verification.progress = progress;
        callback(verification);
        
        await new Promise(resolve => setTimeout(resolve, duration));
      }
    }

    // Complete verification with results - 80% success rate (realistic)
    const verification = this.verifications.get(reportId);
    if (verification) {
      verification.status = 'complete';
      verification.currentStep = 'Verification complete';
      
      // 80% of vulnerabilities should be successfully fixed
      const isFixed = Math.random() > 0.2; // 80% success rate
      
      // Generate realistic verification messages
      const successMessages = [
        'Vulnerability successfully patched. Security testing confirms the fix is effective.',
        'Fix verified successful. Original attack vector is no longer exploitable.',
        'Security controls implemented correctly. Vulnerability has been resolved.',
        'Patch applied successfully. Multiple security scanners confirm remediation.',
        'Vulnerability closed. Implementation meets security standards.'
      ];
      
      const failureMessages = [
        'Vulnerability still exists. Additional remediation required.',
        'Partial fix detected. Security issue persists in some scenarios.',
        'Original vulnerability remains exploitable. Fix implementation incomplete.',
        'Security controls bypassed. Require alternative remediation approach.'
      ];
      
      const successRecommendations = [
        ['Monitor for similar vulnerabilities', 'Update security guidelines', 'Document lessons learned'],
        ['Conduct code review of related endpoints', 'Implement security testing in CI/CD', 'Schedule follow-up assessment'],
        ['Update threat model', 'Train development team', 'Add security monitoring'],
        ['Create security awareness training', 'Review coding standards', 'Schedule quarterly scans']
      ];
      
      const failureRecommendations = [
        ['Implement additional security controls', 'Review fix implementation', 'Escalate to senior developers'],
        ['Engage security consultant', 'Redesign affected component', 'Implement temporary mitigations'],
        ['Conduct thorough code audit', 'Apply defense-in-depth strategy', 'Schedule emergency fix'],
        ['Review architecture design', 'Implement input validation', 'Add monitoring and alerting']
      ];

      verification.results = {
        vulnerabilityFixed: isFixed,
        details: isFixed 
          ? successMessages[Math.floor(Math.random() * successMessages.length)]
          : failureMessages[Math.floor(Math.random() * failureMessages.length)],
        recommendations: isFixed 
          ? successRecommendations[Math.floor(Math.random() * successRecommendations.length)]
          : failureRecommendations[Math.floor(Math.random() * failureRecommendations.length)]
      };
      callback(verification);
    }
  }

  static getVerification(reportId: string): PentestVerification | undefined {
    return this.verifications.get(reportId);
  }
}