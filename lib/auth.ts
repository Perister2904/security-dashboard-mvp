// Authentication and Role-based Access Control
import { authAPI, setAuthToken, clearAuthToken, getAuthToken } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: 'CEO' | 'CISO' | 'Security Architect' | 'SOC Analyst' | 'Penetration Tester' | 'ceo' | 'ciso' | 'soc_analyst' | 'auditor' | 'admin';
  department: string;
  accessLevel: 'Executive' | 'Departmental' | 'Limited';
  permissions: string[];
}

// Map backend roles to frontend access levels
function mapRoleToAccessLevel(role: string): 'Executive' | 'Departmental' | 'Limited' {
  const executiveRoles = ['ceo', 'ciso', 'CEO', 'CISO', 'admin'];
  const departmentalRoles = ['soc_analyst', 'auditor', 'Security Architect', 'SOC Analyst', 'Penetration Tester'];
  
  if (executiveRoles.includes(role)) return 'Executive';
  if (departmentalRoles.includes(role)) return 'Departmental';
  return 'Limited';
}

// Get permissions based on role
function getPermissionsForRole(role: string): string[] {
  const permissionMap: Record<string, string[]> = {
    'ceo': ['view_all_reports', 'executive_dashboard', 'approve_critical', 'full_access'],
    'ciso': ['view_all_reports', 'executive_dashboard', 'security_oversight', 'approve_all', 'full_access'],
    'soc_analyst': ['view_own_reports', 'submit_incidents', 'view_soc_reports'],
    'auditor': ['view_all_reports', 'submit_audit_findings', 'compliance_reports'],
    'admin': ['view_all_reports', 'executive_dashboard', 'full_access', 'user_management'],
    'CEO': ['view_all_reports', 'executive_dashboard', 'approve_critical', 'full_access'],
    'CISO': ['view_all_reports', 'executive_dashboard', 'security_oversight', 'approve_all', 'full_access'],
    'SOC Analyst': ['view_own_reports', 'submit_incidents', 'view_soc_reports'],
    'Security Architect': ['view_architecture_reports', 'submit_fixes', 'review_vulnerabilities'],
    'Penetration Tester': ['view_own_reports', 'submit_vulnerabilities', 'verify_fixes', 'view_pentest_reports'],
  };
  return permissionMap[role] || ['view_own_reports'];
}

// Convert backend user to frontend User format
function mapBackendUser(backendUser: any): User {
  return {
    id: backendUser.id,
    name: backendUser.fullName || backendUser.full_name || backendUser.name,
    email: backendUser.email,
    username: backendUser.username,
    role: backendUser.role,
    department: backendUser.department || 'Security',
    accessLevel: mapRoleToAccessLevel(backendUser.role),
    permissions: getPermissionsForRole(backendUser.role),
  };
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

// Session management with real backend API
export class SessionManager {
  private static currentUser: User | null = null;
  private static sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private static lastActivity = Date.now();
  private static refreshToken: string | null = null;

  // Login with real backend API
  static async loginAsync(emailOrUsername: string, password: string): Promise<User | null> {
    try {
      // Extract username from email if needed
      const username = emailOrUsername.includes('@') 
        ? emailOrUsername.split('@')[0] 
        : emailOrUsername;

      const response = await authAPI.login(username, password);
      
      if (response.success && response.user) {
        this.currentUser = mapBackendUser(response.user);
        this.lastActivity = Date.now();
        
        if (response.tokens?.refreshToken) {
          this.refreshToken = response.tokens.refreshToken;
          if (typeof window !== 'undefined') {
            localStorage.setItem('refresh_token', response.tokens.refreshToken);
            localStorage.setItem('current_user', JSON.stringify(this.currentUser));
          }
        }
        
        return this.currentUser;
      }
      return null;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Synchronous login - falls back to mock for demo
  static login(email: string, password: string): User | null {
    // Try to restore session from localStorage first
    if (typeof window !== 'undefined') {
      const cachedUser = localStorage.getItem('current_user');
      const token = getAuthToken();
      
      if (cachedUser && token) {
        try {
          this.currentUser = JSON.parse(cachedUser);
          this.lastActivity = Date.now();
          return this.currentUser;
        } catch (e) {
          console.error('Failed to parse cached user');
        }
      }
    }
    
    // Fallback to mock users for demo compatibility
    const user = users.find(u => u.email === email);
    if (user && password === "demo123") {
      this.currentUser = user;
      this.lastActivity = Date.now();
      return user;
    }
    return null;
  }

  // Restore session from localStorage
  static restoreSession(): User | null {
    if (typeof window !== 'undefined') {
      const token = getAuthToken();
      const cachedUser = localStorage.getItem('current_user');
      
      if (token && cachedUser) {
        try {
          this.currentUser = JSON.parse(cachedUser);
          this.lastActivity = Date.now();
          return this.currentUser;
        } catch (e) {
          console.error('Failed to restore session');
        }
      }
    }
    return null;
  }

  static getCurrentUser(): User | null {
    if (this.isSessionValid()) {
      return this.currentUser;
    }
    // Try to restore from localStorage
    return this.restoreSession();
  }

  static isSessionValid(): boolean {
    return this.currentUser !== null && (Date.now() - this.lastActivity) < this.sessionTimeout;
  }

  static updateActivity(): void {
    this.lastActivity = Date.now();
  }

  static logout(): void {
    this.currentUser = null;
    this.refreshToken = null;
    clearAuthToken();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_user');
      localStorage.removeItem('refresh_token');
    }
  }

  static hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.permissions.includes(permission) || user.permissions.includes('full_access') : false;
  }

  static canAccessReport(report: any): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    // Executive access - can see everything
    if (user.accessLevel === 'Executive') return true;
    
    // Full access permission
    if (user.permissions.includes('full_access')) return true;
    
    // Departmental access - only own department's reports
    return report.department === user.department || 
           report.submittedByRole === user.role ||
           report.assignedTo === user.role;
  }
}