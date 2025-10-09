// Authentication and Role-based Access Control
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'CEO' | 'CISO' | 'Security Architect' | 'SOC Analyst' | 'Penetration Tester';
  department: string;
  accessLevel: 'Executive' | 'Departmental' | 'Limited';
  permissions: string[];
}

// Mock users for demo
export const users: User[] = [
  {
    id: "user-001",
    name: "Ahmad Hassan",
    email: "ahmad.hassan@meezanbank.com",
    role: "CEO",
    department: "Executive",
    accessLevel: "Executive",
    permissions: ["view_all_reports", "executive_dashboard", "approve_critical", "full_access"]
  },
  {
    id: "user-002", 
    name: "Sarah Khan",
    email: "sarah.khan@meezanbank.com",
    role: "CISO",
    department: "Information Security",
    accessLevel: "Executive",
    permissions: ["view_all_reports", "executive_dashboard", "security_oversight", "approve_all", "full_access"]
  },
  {
    id: "user-003",
    name: "Ali Raza",
    email: "ali.raza@meezanbank.com", 
    role: "SOC Analyst",
    department: "SOC",
    accessLevel: "Departmental",
    permissions: ["view_own_reports", "submit_incidents", "view_soc_reports"]
  },
  {
    id: "user-004",
    name: "Omar Sheikh",
    email: "omar.sheikh@meezanbank.com",
    role: "Penetration Tester", 
    department: "Security Testing",
    accessLevel: "Departmental",
    permissions: ["view_own_reports", "submit_vulnerabilities", "verify_fixes", "view_pentest_reports"]
  },
  {
    id: "user-005",
    name: "Fatima Ahmed",
    email: "fatima.ahmed@meezanbank.com",
    role: "Security Architect",
    department: "Security Architecture", 
    accessLevel: "Departmental",
    permissions: ["view_architecture_reports", "submit_fixes", "review_vulnerabilities"]
  }
];

// Session management
export class SessionManager {
  private static currentUser: User | null = null;
  private static sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private static lastActivity = Date.now();

  static login(email: string, password: string): User | null {
    // Mock authentication - in real system this would validate against backend
    const user = users.find(u => u.email === email);
    if (user && password === "demo123") { // Mock password
      this.currentUser = user;
      this.lastActivity = Date.now();
      return user;
    }
    return null;
  }

  static getCurrentUser(): User | null {
    if (this.isSessionValid()) {
      return this.currentUser;
    }
    this.logout();
    return null;
  }

  static isSessionValid(): boolean {
    return this.currentUser !== null && (Date.now() - this.lastActivity) < this.sessionTimeout;
  }

  static updateActivity(): void {
    this.lastActivity = Date.now();
  }

  static logout(): void {
    this.currentUser = null;
  }

  static hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.permissions.includes(permission) : false;
  }

  static canAccessReport(report: any): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    // Executive access - can see everything
    if (user.accessLevel === 'Executive') return true;
    
    // Departmental access - only own department's reports
    return report.department === user.department || 
           report.submittedByRole === user.role ||
           report.assignedTo === user.role;
  }
}

// Initialize with CISO for demo
SessionManager.login("sarah.khan@meezanbank.com", "demo123");