"use client";
/* eslint-disable react/no-unescaped-entities */
import { useEffect, useState, useCallback } from "react";
import { Moon, Sun, FileText, Download, Users, AlertTriangle, CheckCircle, Clock, Eye, EyeOff, LogOut, Activity, TrendingUp, Target } from "lucide-react";
import { useTheme } from "next-themes";
import { sampleReports, getDashboardData, Report } from "@/lib/reports";
import { SessionManager, User, users } from "@/lib/auth";
import { RealTimeManager } from "@/lib/realtime";

// Chart Components
import SecurityTrendsChart from "@/components/SecurityTrendsChart";
import ThreatCategoriesChart from "@/components/ThreatCategoriesChart";

// New Dashboard Components
import SOCPerformanceDashboard from "@/components/SOCPerformanceDashboard";
import AssetRiskPostureDashboard from "@/components/AssetRiskPostureDashboard";
import CEORiskSummary from "@/components/CEORiskSummary";

type Tab = "SOC Performance" | "Asset & Risk Posture" | "CEO Risk Summary" | "Reports Dashboard";

// Report Submission Form Component
function ReportSubmissionForm({ currentUser, onSubmit, existingReports }: { 
  currentUser: User, 
  onSubmit: (report: Report) => void,
  existingReports: Report[]
}) {
  const [formData, setFormData] = useState({
    type: 'vulnerability' as 'vulnerability' | 'fix' | 'audit' | 'incident',
    title: '',
    severity: 'Medium' as 'Critical' | 'High' | 'Medium' | 'Low',
    technicalContent: '',
    affectedSystems: '',
    chainToReport: '',
    chainName: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced validation
    const errors = [];
    if (!formData.title.trim()) errors.push('Title is required');
    if (!formData.technicalContent.trim()) errors.push('Technical details are required');
    if (formData.title.length > 100) errors.push('Title must be under 100 characters');
    if (formData.technicalContent.length < 20) errors.push('Technical details must be at least 20 characters');
    if (formData.chainToReport === 'NEW_CHAIN' && !formData.chainName.trim()) {
      errors.push('Chain name is required when creating a new chain');
    }
    
    if (errors.length > 0) {
      alert('Please fix the following issues:\n• ' + errors.join('\n• '));
      return;
    }

    // Handle chain logic
    let chainInfo = '';
    if (formData.chainToReport === 'NEW_CHAIN') {
      chainInfo = `🆕 NEW CHAIN: ${formData.chainName}`;
    } else if (formData.chainToReport) {
      const chainedReport = existingReports.find(r => r.id === formData.chainToReport);
      chainInfo = `🔗 CHAINED TO: ${chainedReport?.id} - ${chainedReport?.title}`;
    }

    const newReport: Report = {
      id: `RPT-${String(Date.now()).slice(-4)}`,
      title: formData.title,
      type: formData.type,
      severity: formData.severity,
      submittedBy: currentUser.name,
      submittedByRole: currentUser.role,
      department: currentUser.department,
      status: 'Submitted',
      dateSubmitted: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0],
      technicalContent: `${formData.technicalContent}${chainInfo ? `\n\n${chainInfo}` : ''}`,
      affectedSystems: formData.affectedSystems.split(',').map(s => s.trim()).filter(s => s),
      workflowStage: 'Initial Review',
      nextAction: 'Awaiting assignment'
    };

    onSubmit(newReport);
    
    // Reset form
    setFormData({
      type: 'vulnerability',
      title: '',
      severity: 'Medium',
      technicalContent: '',
      affectedSystems: '',
      chainToReport: '',
      chainName: ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Report Type *</label>
        <select 
          value={formData.type}
          onChange={(e) => setFormData({...formData, type: e.target.value as any})}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="vulnerability">Vulnerability</option>
          <option value="fix">Security Fix</option>
          <option value="incident">Incident Report</option>
          <option value="audit">Audit Finding</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Title *</label>
        <input 
          type="text" 
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
          placeholder="Brief description of the issue" 
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Severity</label>
        <select 
          value={formData.severity}
          onChange={(e) => setFormData({...formData, severity: e.target.value as any})}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Technical Details *</label>
        <textarea 
          value={formData.technicalContent}
          onChange={(e) => setFormData({...formData, technicalContent: e.target.value})}
          className="w-full p-2 border rounded-lg h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
          placeholder="Detailed technical description of the vulnerability, incident, or finding..."
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Affected Systems</label>
        <input 
          type="text" 
          value={formData.affectedSystems}
          onChange={(e) => setFormData({...formData, affectedSystems: e.target.value})}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
          placeholder="e.g., Mobile Banking App, Core Banking System (comma-separated)" 
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          🔗 Chain Management (Optional)
        </label>
        <select 
          value={formData.chainToReport}
          onChange={(e) => setFormData({...formData, chainToReport: e.target.value})}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- No Chain --</option>
          <option value="NEW_CHAIN">🆕 Create New Chain</option>
          <optgroup label="Existing Reports">
            {existingReports.map(report => (
              <option key={report.id} value={report.id}>
                {report.id}: {report.title} ({report.severity})
              </option>
            ))}
          </optgroup>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {formData.chainToReport === 'NEW_CHAIN' 
            ? "This will create a new chain starting with your report" 
            : formData.chainToReport 
            ? "Link this report to an existing one for workflow tracking"
            : "Optional: Chain reports together for better workflow visibility"
          }
        </p>
        
        {formData.chainToReport === 'NEW_CHAIN' && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
            <label className="block text-sm font-medium mb-2 text-blue-800 dark:text-blue-200">
              🆕 Chain Name
            </label>
            <input 
              type="text" 
              value={formData.chainName}
              onChange={(e) => setFormData({...formData, chainName: e.target.value})}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              placeholder="e.g., Email Security Investigation, Mobile Banking Security Review"
              required
            />
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              Give your new chain a descriptive name for tracking related reports
            </p>
          </div>
        )}
      </div>
      
      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary">
          <FileText className="w-4 h-4" />
          Submit Report
        </button>
        <div className="text-sm text-gray-500 flex items-center">
          <span>* Required fields</span>
        </div>
      </div>
    </form>
  );
}

export default function Page() {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("SOC Performance");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>(sampleReports);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [meetingMode, setMeetingMode] = useState(false);
  
  const [userRole, setUserRole] = useState('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Update userRole when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setUserRole(currentUser.role);
    }
  }, [currentUser]);

  // Auto-clear notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
  };

  // Simple, clear workflow - who did what, when
  const getActualWorkflowJourney = (primaryReport: Report) => {
    const journey = [];

    // Step 1: Who found it
    journey.push({
      step: "Found Issue",
      whoDidIt: primaryReport.submittedBy,
      role: primaryReport.submittedByRole,
      department: primaryReport.department,
      when: primaryReport.dateSubmitted,
      status: "completed",
      description: `Discovered: ${primaryReport.title}`
    });

    // Step 2: Who's handling it now
    if (primaryReport.assignedTo) {
      journey.push({
        step: "Working On It",
        whoDidIt: primaryReport.assignedTo,
        role: "Security Analyst",
        department: "Security Team",
        when: primaryReport.lastUpdated,
        status: primaryReport.status === 'Under Review' ? "in-progress" : "completed",
        description: `Analyzing and planning fix`
      });
    }

    // Step 3: Implementation (if being fixed)
    if (primaryReport.status === 'Approved' || primaryReport.status === 'Fixed') {
      journey.push({
        step: "Fixing It",
        whoDidIt: primaryReport.assignedTo || "Dev Team",
        role: "Developer",
        department: "IT Department", 
        when: primaryReport.lastUpdated,
        status: primaryReport.status === 'Fixed' ? "completed" : "in-progress",
        description: `Implementing the fix`
      });
    }

    return journey;
  };



  // Initialize real-time system
  useEffect(() => {
    setMounted(true);
    
    // Check for existing session
    const user = SessionManager.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setUserRole(user.role);
      RealTimeManager.initialize(sampleReports);
      
      // Subscribe to real-time updates
      const unsubscribe = RealTimeManager.subscribe((updatedReports) => {
        setReports(updatedReports);
      });

      return () => {
        unsubscribe();
        RealTimeManager.cleanup();
      };
    }
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      RealTimeManager.cleanup();
    };
  }, []);



  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      showNotification('error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    
    try {
      // Try real backend API first
      const user = await SessionManager.loginAsync(loginEmail, loginPassword);
      
      if (user) {
        setCurrentUser(user);
        showNotification('success', `Welcome back, ${user.name}!`);
        RealTimeManager.initialize(sampleReports);
        
        // Subscribe to real-time updates
        RealTimeManager.subscribe((updatedReports) => {
          setReports(updatedReports);
        });
      } else {
        showNotification('error', 'Invalid credentials. Please try again.');
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      
      // Fallback to mock authentication for demo
      const user = SessionManager.login(loginEmail, loginPassword);
      if (user) {
        setCurrentUser(user);
        showNotification('success', `Welcome back, ${user.name}! (Demo Mode)`);
        RealTimeManager.initialize(sampleReports);
        RealTimeManager.subscribe((updatedReports) => {
          setReports(updatedReports);
        });
      } else {
        showNotification('error', error.message || 'Invalid credentials. Please try again.');
      }
    }
    
    setIsLoading(false);
  };




  const getExecutiveSummary = useCallback((report: Report) => {
    if (report.id === "RPT-001") {
      return "A critical security flaw was found in our mobile banking app that could allow hackers to access customer accounts without passwords. This affects all mobile banking users and requires immediate attention. The security team has identified the exact problem and is working on a fix.";
    }
    if (report.id === "RPT-002") {
      return "Our security experts have created a detailed plan to fix the mobile banking security flaw. The fix involves updating our app's security measures and will take 2-3 days to implement. Once complete, customer accounts will be fully protected.";
    }
    if (report.id === "RPT-003") {
      return "Cybercriminals sent fake emails to 47 of our customers pretending to be from Meezan Bank. We blocked the attack quickly, but 3 customers may have entered their information on the fake website. We've secured those accounts and are educating all customers about this threat.";
    }
    return "Executive summary will be generated by AI based on the technical report content.";
  }, []);

  // Pre-define export function to prevent useEffect re-runs (will be properly implemented after login)
  const onExportMemoized = useCallback(() => {
    if (!currentUser) return;
    
    // Filter reports based on user role
    const userReports = reports.filter(report => {
      // Full access for executives and admins
      if (currentUser.role === 'CEO' || currentUser.role === 'CISO' || currentUser.role === 'admin' || currentUser.role === 'ciso' || currentUser.role === 'ceo') {
        return true;
      }
      // Department-based access for others
      return report.submittedBy === currentUser.name || 
             report.submittedByRole === currentUser.role ||
             report.department === currentUser.department ||
             report.assignedTo === currentUser.role;
    });

    // Create a comprehensive report export
    const exportData = {
      timestamp: new Date().toISOString(),
      user: currentUser?.name,
      role: currentUser?.role,
      organization: "Meezan Bank",
      reports: userReports.map(r => ({
        id: r.id,
        title: r.title,
        severity: r.severity,
        status: r.status,
        submittedBy: r.submittedBy,
        dateSubmitted: r.dateSubmitted,
        workflowStage: r.workflowStage
      })),
      summary: {
        totalReports: userReports.length,
        criticalIssues: userReports.filter(r => r.severity === 'Critical').length,
        pendingReviews: userReports.filter(r => r.status === 'Under Review').length
      }
    };
    
    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Also trigger print view
    setTimeout(() => window.print(), 100);
    showNotification('success', 'Dashboard data exported successfully');
  }, [currentUser, reports]);

  // Update activity on user interaction and add keyboard shortcuts
  useEffect(() => {
    const updateActivity = () => SessionManager.updateActivity();
    
    const handleKeyPress = (e: KeyboardEvent) => {
      updateActivity();
      
      // Keyboard shortcuts (only when logged in)
      if (currentUser && e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setTab("Reports Dashboard");
            break;
          case '2':
            e.preventDefault();
            setTab("Asset & Risk Posture");
            break;
          case 'e':
            e.preventDefault();
            if (currentUser.role === 'CEO' || currentUser.role === 'CISO') {
              onExportMemoized();
            }
            break;
        }
      }
    };
    
    document.addEventListener('click', updateActivity);
    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('click', updateActivity);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentUser, onExportMemoized]);

  // Show login screen if not authenticated
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <FileText className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
              Security Dashboard Access
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Sign in to access security reports and workflow management
            </p>
          </div>
          <div className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email Address
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Demo Accounts:</h3>
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <div className="font-semibold text-green-700 dark:text-green-300">✅ Real Backend (Recommended):</div>
                <div>• SOC Analyst: analyst / SecurePass@123</div>
                <div>• Admin: admin / Admin@123</div>
                <div className="mt-2 font-semibold text-orange-600 dark:text-orange-300">📋 Demo Mode (Fallback):</div>
                <div>• CEO/CISO: sarah.khan@meezanbank.com</div>
                <div>• SOC Analyst: ali.raza@meezanbank.com</div>
                <div className="mt-1 font-medium">Demo Password: demo123</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dashboardData = getDashboardData();
  
  // Filter reports based on user role
  const accessibleReports = reports.filter(report => {
    if (!currentUser) return false;
    
    // Full access for executives and admins
    if (currentUser.role === 'CEO' || currentUser.role === 'CISO' || currentUser.role === 'admin' || currentUser.role === 'ciso' || currentUser.role === 'ceo') {
      return true;
    }
    
    // Department-based access for others
    return report.submittedBy === currentUser.name || 
           report.submittedByRole === currentUser.role ||
           report.department === currentUser.department ||
           report.assignedTo === currentUser.role;
  });

  const handleLogout = () => {
    SessionManager.logout();
    setCurrentUser(null);
    setLoginEmail("");
    setLoginPassword("");
  };



  return (
    <div className="space-y-6">
      {/* Notification Banner */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
          notification.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-medium">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="w-8 h-8 text-blue-600" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Security Operations Center Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              SOC Performance • Asset Management • Risk Posture • Executive Reporting
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Logged in as: {currentUser.name} ({currentUser.role}) • {currentUser.department}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 header-actions flex-wrap">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
          <button 
            className={`btn ${meetingMode ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : ''}`}
            onClick={() => setMeetingMode(!meetingMode)}
          >
            <Users className="w-4 h-4" />
            {meetingMode ? "Exit Meeting" : "Meeting Mode"}
          </button>
          <button className="btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {mounted ? (
              theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
          <button 
            onClick={() => {
              const updatedReports = RealTimeManager.getReports();
              setReports(updatedReports);
              showNotification('success', 'Dashboard refreshed with latest data');
            }}
            className="btn"
          >
            <Clock className="w-4 h-4" /> Refresh
          </button>
          <button className="btn btn-primary" onClick={onExportMemoized}>
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 mb-6">
        {(currentUser?.role === 'CEO' || currentUser?.role === 'CISO' || currentUser?.role === 'admin' || currentUser?.role === 'ciso' || currentUser?.role === 'ceo' ? 
          ["SOC Performance", "Asset & Risk Posture", "CEO Risk Summary", "Reports Dashboard"] :
          ["Reports Dashboard"]
        ).map((t) => (
          <button key={t} className={`tab ${tab === t ? "tab-active" : ""}`} onClick={() => {
            setTab(t as Tab);
            setSelectedReport(null);
          }}>
            {t === "SOC Performance" && <Activity className="w-4 h-4 mr-1" />}
            {t === "Asset & Risk Posture" && <Target className="w-4 h-4 mr-1" />}
            {t === "CEO Risk Summary" && <TrendingUp className="w-4 h-4 mr-1" />}
            {t === "Reports Dashboard" && <FileText className="w-4 h-4 mr-1" />}
            {t}
          </button>
        ))}
      </nav>

            {tab === "Reports Dashboard" && (
        <section className="space-y-6">
          {/* Compact Header with KPIs */}
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Security Reports & Analytics Dashboard
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentUser?.role === 'CEO' || currentUser?.role === 'CISO' || currentUser?.role === 'admin' || currentUser?.role === 'ciso' || currentUser?.role === 'ceo' ? 'Total' : 'My'}
                  </p>
                  <p className="text-2xl font-bold">{accessibleReports.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Critical</p>
                  <p className="text-2xl font-bold text-red-600">
                    {accessibleReports.filter(r => r.severity === 'Critical').length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <Clock className="w-8 h-8 text-orange-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {accessibleReports.filter(r => r.status === 'Under Review').length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
                  <p className="text-2xl font-bold text-green-600">
                    {accessibleReports.filter(r => r.status === 'Fixed').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Report Details or List View */}
          {selectedReport ? (
            /* Detailed Report View - Meeting Mode Features Integrated */
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{selectedReport.title}</h2>
                <button onClick={() => setSelectedReport(null)} className="btn bg-gray-100 hover:bg-gray-200 text-gray-700">
                  ← Back to Reports
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-blue-600">📋 Executive Summary</h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                    <p className="text-gray-800 dark:text-gray-200">
                      {getExecutiveSummary(selectedReport)}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="font-medium">Severity:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedReport.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                        selectedReport.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                        selectedReport.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {selectedReport.severity}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="font-medium">Status:</span>
                      <span className="font-medium">{selectedReport.status}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="font-medium">Submitted by:</span>
                      <span>{selectedReport.submittedBy} ({selectedReport.submittedByRole})</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="font-medium">Assigned to:</span>
                      <span>{selectedReport.assignedTo || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-600">🔧 Technical Details</h3>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedReport.technicalContent}
                    </p>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Affected Systems:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedReport.affectedSystems.map((system, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                          {system}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Next Action:</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {selectedReport.nextAction || 'No specific action defined'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Analytics & Charts Section - Moved to Top */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                  📊 Security Analytics Overview
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SecurityTrendsChart />
                  <ThreatCategoriesChart />
                </div>
              </div>

              {/* Compact Clickable Reports List */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    📄 Security Reports
                  </h3>
                  <span className="text-sm text-gray-500">
                    Click any report for details
                  </span>
                </div>
                <div className="space-y-2">
                  {accessibleReports.map((report) => (
                    <div 
                      key={report.id} 
                      className="group border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all"
                      onClick={() => setSelectedReport(report)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-medium text-sm">{report.id}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              report.severity === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              report.severity === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                              report.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                              {report.severity}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              report.status === 'Under Review' ? 'bg-orange-100 text-orange-800' :
                              report.status === 'Approved' ? 'bg-green-100 text-green-800' :
                              report.status === 'Fixed' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {report.status}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate group-hover:text-blue-600">
                              {report.title}
                            </h4>
                            <p className="text-xs text-gray-500 truncate">
                              {report.submittedBy} • {report.dateSubmitted} • {report.workflowStage}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-2">
                          View →
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* SOC Performance Dashboard Tab */}
      {tab === "SOC Performance" && (
        <section className="space-y-6">
          <SOCPerformanceDashboard />
        </section>
      )}

      {/* Asset & Risk Posture Tab */}
      {tab === "Asset & Risk Posture" && (
        <section className="space-y-6">
          <AssetRiskPostureDashboard />
        </section>
      )}

      {/* CEO Risk Summary Tab */}
      {tab === "CEO Risk Summary" && (
        <section className="space-y-6">
          <CEORiskSummary />
        </section>
      )}
    </div>
  );
}
