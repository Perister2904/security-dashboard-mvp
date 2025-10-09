// Report-based workflow system for executive meetings and supervision
export const roles = [
  "CEO", "CISO", "COO", "Security Architect", "SOC Analyst", "Penetration Tester"
];

export const organizations = ["Meezan Bank", "Al Baraka Bank", "Dubai Islamic Bank", "Bank Alfalah"];

// Report types and workflow
export interface Report {
  id: string;
  title: string;
  type: 'vulnerability' | 'fix' | 'audit' | 'incident';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  submittedBy: string;
  submittedByRole: string;
  department: string;
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Fixed' | 'Rejected';
  assignedTo?: string;
  dateSubmitted: string;
  lastUpdated: string;
  technicalContent: string;
  executiveSummary?: string;
  affectedSystems: string[];
  workflowStage: string;
  nextAction?: string;
  attachments?: string[];
}

// Sample reports for demo
export const sampleReports: Report[] = [
  {
    id: "RPT-001",
    title: "SQL Injection in Mobile Banking Login",
    type: "vulnerability",
    severity: "Critical",
    submittedBy: "Ahmed Hassan",
    submittedByRole: "Penetration Tester",
    department: "Security Testing",
    status: "Under Review",
    assignedTo: "Security Architect",
    dateSubmitted: "2024-10-07",
    lastUpdated: "2024-10-08",
    technicalContent: "During penetration testing of the mobile banking application, a SQL injection vulnerability was discovered in the login authentication mechanism. The vulnerability exists in the user authentication query where user input is not properly sanitized. An attacker could exploit this to bypass authentication, access unauthorized accounts, or extract sensitive customer data from the database. The vulnerability affects the /api/auth/login endpoint with payload: ' OR '1'='1' --",
    affectedSystems: ["Mobile Banking App", "Customer Database", "Authentication Service"],
    workflowStage: "Security Review",
    nextAction: "Security Architect to provide fix recommendations"
  },
  {
    id: "RPT-002", 
    title: "Recommended Fix for SQL Injection Vulnerability",
    type: "fix",
    severity: "Critical",
    submittedBy: "Sarah Khan",
    submittedByRole: "Security Architect", 
    department: "Security Architecture",
    status: "Approved",
    assignedTo: "Development Team",
    dateSubmitted: "2024-10-08",
    lastUpdated: "2024-10-08",
    technicalContent: "To remediate the SQL injection vulnerability in RPT-001: 1) Implement parameterized queries/prepared statements for all database interactions 2) Add input validation and sanitization 3) Implement WAF rules to block SQL injection attempts 4) Update authentication service to use stored procedures 5) Conduct code review of all similar endpoints. Estimated fix time: 2-3 days. Testing required before production deployment.",
    affectedSystems: ["Mobile Banking App", "Authentication Service"],
    workflowStage: "Development",
    nextAction: "Development team to implement fixes and submit for testing"
  },
  {
    id: "RPT-003",
    title: "Phishing Email Campaign Targeting Customers", 
    type: "incident",
    severity: "High",
    submittedBy: "Ali Raza",
    submittedByRole: "SOC Analyst",
    department: "SOC",
    status: "Under Review",
    assignedTo: "CISO",
    dateSubmitted: "2024-10-08",
    lastUpdated: "2024-10-08", 
    technicalContent: "SOC detected a sophisticated phishing campaign targeting Meezan Bank customers. 47 emails sent to customers with fake login pages. 3 customers entered credentials before we blocked the domain. Indicators: Domain meezan-bank-secure.com (typosquatting), sender IP 185.220.101.182, email headers show spoofed from address. Customer education sent, affected accounts secured.",
    affectedSystems: ["Email Security", "Customer Accounts", "Web Filtering"],
    workflowStage: "Incident Response",
    nextAction: "CISO briefing and decision on customer notification"
  },
  {
    id: "RPT-004",
    title: "Outdated SSL Certificates on Payment Gateway",
    type: "vulnerability",
    severity: "Medium", 
    submittedBy: "Omar Sheikh",
    submittedByRole: "Penetration Tester",
    department: "Security Testing",
    status: "Approved",
    assignedTo: "Infrastructure Team",
    dateSubmitted: "2024-10-06",
    lastUpdated: "2024-10-08",
    technicalContent: "SSL certificates on payment gateway servers are expiring within 30 days. Current certificates use SHA-1 which is deprecated. Immediate renewal with SHA-256 certificates required to maintain secure payment processing and compliance.",
    affectedSystems: ["Payment Gateway", "E-commerce Platform", "Card Processing"],
    workflowStage: "Testing",
    nextAction: "Infrastructure team completing certificate deployment"
  },
  {
    id: "RPT-005", 
    title: "Multi-Factor Authentication Implementation",
    type: "fix",
    severity: "High",
    submittedBy: "Fatima Ahmed",
    submittedByRole: "Security Architect",
    department: "Security Architecture", 
    status: "Under Review",
    assignedTo: "Development Team",
    dateSubmitted: "2024-10-05",
    lastUpdated: "2024-10-07",
    technicalContent: "Implementation plan for MFA across all customer-facing applications. Phase 1: SMS-based OTP, Phase 2: TOTP authenticator apps, Phase 3: Biometric authentication. Requires updates to authentication service, mobile app, and web portal.",
    affectedSystems: ["Mobile Banking App", "Web Portal", "Authentication Service", "Customer Database"],
    workflowStage: "Architecture Review", 
    nextAction: "Waiting for executive approval of implementation timeline"
  }
];

// User roles and permissions
export interface UserRole {
  role: string;
  permissions: string[];
  accessLevel: 'Executive' | 'Management' | 'Operational';
  canApprove: boolean;
  canSubmit: string[];
  dashboardView: 'executive' | 'technical';
}

export const rolePermissions: UserRole[] = [
  {
    role: "CEO",
    permissions: ["view_all_reports", "executive_summary", "meeting_mode", "approve_critical"],
    accessLevel: "Executive",
    canApprove: true,
    canSubmit: [],
    dashboardView: "executive"
  },
  {
    role: "CISO", 
    permissions: ["view_all_reports", "executive_summary", "technical_details", "approve_all", "audit_workflow"],
    accessLevel: "Executive",
    canApprove: true,
    canSubmit: ["audit"],
    dashboardView: "executive"
  },
  {
    role: "COO",
    permissions: ["view_all_reports", "executive_summary", "meeting_mode"],
    accessLevel: "Executive", 
    canApprove: false,
    canSubmit: [],
    dashboardView: "executive"
  },
  {
    role: "Security Architect",
    permissions: ["view_technical", "submit_fixes", "review_reports"],
    accessLevel: "Management",
    canApprove: true,
    canSubmit: ["fix", "audit"],
    dashboardView: "technical"
  },
  {
    role: "SOC Analyst",
    permissions: ["view_assigned", "submit_incidents"],
    accessLevel: "Operational",
    canApprove: false,
    canSubmit: ["incident"],
    dashboardView: "technical"
  },
  {
    role: "Penetration Tester",
    permissions: ["view_assigned", "submit_vulnerabilities", "verify_fixes"],
    accessLevel: "Operational", 
    canApprove: false,
    canSubmit: ["vulnerability"],
    dashboardView: "technical"
  }
];

// Mock user for demo
export const currentUser = {
  name: "Executive User",
  role: "CISO",
  organization: "Meezan Bank",
  permissions: rolePermissions.find(r => r.role === "CISO")
};

// Workflow stages
export const workflowStages = [
  "Submitted",
  "Security Review", 
  "Architecture Review",
  "Development",
  "Testing",
  "Deployment", 
  "Verification",
  "Closed"
];

// Dashboard data based on reports
export function getDashboardData() {
  const reports = sampleReports;
  
  return {
    totalReports: reports.length,
    criticalReports: reports.filter(r => r.severity === "Critical").length,
    pendingReviews: reports.filter(r => r.status === "Under Review").length,
    recentReports: reports.slice(-5),
    reportsByDepartment: {
      "Security Testing": reports.filter(r => r.department === "Security Testing").length,
      "Security Architecture": reports.filter(r => r.department === "Security Architecture").length,
      "SOC": reports.filter(r => r.department === "SOC").length
    },
    workflowStatus: workflowStages.map(stage => ({
      stage,
      count: reports.filter(r => r.workflowStage === stage).length
    }))
  };
}