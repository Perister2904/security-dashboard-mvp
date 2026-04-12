// Authentication and Role-based Access Control
import { authAPI, setAuthToken, clearAuthToken, getAuthToken, setAuthFailureHandler } from './api';

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

function notifyAuthStateChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth-state-changed'));
  }
}

// Session management with real backend API
export class SessionManager {
  private static currentUser: User | null = null;
  private static sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private static lastActivity = Date.now();
  private static refreshToken: string | null = null;

  static {
    setAuthFailureHandler(() => {
      SessionManager.logout();
    });
  }

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
        
        if (response.tokens?.accessToken) {
          setAuthToken(response.tokens.accessToken);
        }

        if (response.tokens?.refreshToken) {
          this.refreshToken = response.tokens.refreshToken;
          if (typeof window !== 'undefined') {
            localStorage.setItem('refresh_token', response.tokens.refreshToken);
            localStorage.setItem('current_user', JSON.stringify(this.currentUser));
          }
        }

        notifyAuthStateChanged();
        
        return this.currentUser;
      }
      return null;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Restore session from localStorage
  static restoreSession(): User | null {
    if (typeof window !== 'undefined') {
      const token = getAuthToken();
      const cachedUser = localStorage.getItem('current_user');
      this.refreshToken = localStorage.getItem('refresh_token');
      
      if (token && cachedUser) {
        try {
          this.currentUser = JSON.parse(cachedUser);
          this.lastActivity = Date.now();
          return this.currentUser;
        } catch (e) {
          console.error('Failed to restore session');
        }
      }
      
      if (!token && cachedUser) {
        localStorage.removeItem('current_user');
        localStorage.removeItem('refresh_token');
      }
    }
    return null;
  }

  private static async attemptTokenRefresh(): Promise<boolean> {
    const storedRefreshToken =
      this.refreshToken || (typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null);

    if (!storedRefreshToken) {
      return false;
    }

    try {
      const response = await authAPI.refreshToken(storedRefreshToken);
      if (!response?.success || !response.tokens?.accessToken) {
        return false;
      }

      setAuthToken(response.tokens.accessToken);
      this.refreshToken = storedRefreshToken;
      this.lastActivity = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  static async validateSession(): Promise<User | null> {
    const restoredUser = this.restoreSession();
    const token = getAuthToken();

    if (!restoredUser || !token) {
      this.logout();
      return null;
    }

    try {
      const response = await authAPI.getCurrentUser();
      if (response.success && response.user) {
        this.currentUser = mapBackendUser(response.user);
        this.lastActivity = Date.now();

        if (typeof window !== 'undefined') {
          localStorage.setItem('current_user', JSON.stringify(this.currentUser));
        }

        notifyAuthStateChanged();
        return this.currentUser;
      }
    } catch {
      const refreshed = await this.attemptTokenRefresh();
      if (refreshed) {
        try {
          const retryResponse = await authAPI.getCurrentUser();
          if (retryResponse.success && retryResponse.user) {
            this.currentUser = mapBackendUser(retryResponse.user);
            this.lastActivity = Date.now();

            if (typeof window !== 'undefined') {
              localStorage.setItem('current_user', JSON.stringify(this.currentUser));
            }

            notifyAuthStateChanged();
            return this.currentUser;
          }
        } catch {
          // Fall through to logout below.
        }
      }
    }

    this.logout();
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

    notifyAuthStateChanged();
  }

  static hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.permissions.includes(permission) || user.permissions.includes('full_access') : false;
  }
}
