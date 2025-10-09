"use client";
/* eslint-disable react/no-unescaped-entities */
import { useEffect, useState, useCallback } from "react";
import { Moon, Sun, ShieldCheck, FileText, Download, Users, AlertTriangle, CheckCircle, Clock, Play, Loader, Eye, EyeOff, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { sampleReports, getDashboardData, Report } from "@/lib/reports";
import { SessionManager, User, users } from "@/lib/auth";
import { RealTimeManager, PentestVerificationManager, PentestVerification } from "@/lib/realtime";

type Tab = "Reports Dashboard" | "Submit Report" | "Workflow Audit" | "Pentest Verification";

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
  const [tab, setTab] = useState<Tab>("Reports Dashboard");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>(sampleReports);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pentestVerifications, setPentestVerifications] = useState<Map<string, PentestVerification>>(new Map());
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
    
    // Simulate authentication delay for better UX
    await new Promise(resolve => setTimeout(resolve, 1000));

    const user = SessionManager.login(loginEmail, loginPassword);
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
    
    setIsLoading(false);
  };





  const startPentestVerification = (reportId: string) => {
    PentestVerificationManager.startVerification(reportId, (verification) => {
      setPentestVerifications(prev => new Map(prev.set(reportId, verification)));
    });
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
      // Full access for executives
      if (currentUser.role === 'CEO' || currentUser.role === 'CISO') {
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
            setTab("Submit Report");
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
            <ShieldCheck className="mx-auto h-12 w-12 text-blue-600" />
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
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Demo Accounts:</h3>
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <div>• CEO/CISO (Full Access): sarah.khan@meezanbank.com</div>
                <div>• SOC Analyst (Limited): ali.raza@meezanbank.com</div>
                <div>• Penetration Tester: omar.sheikh@meezanbank.com</div>
                <div className="mt-2 font-medium">Password for all: demo123</div>
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
    
    // Full access for executives
    if (currentUser.role === 'CEO' || currentUser.role === 'CISO') {
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
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Security Reports & Workflow Management
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Report-based workflow • Executive meetings • Department coordination
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
        {(currentUser?.role === 'CEO' || currentUser?.role === 'CISO' ? 
          ["Reports Dashboard","Submit Report","Workflow Audit","Pentest Verification"] :
          ["Reports Dashboard","Submit Report"]
        ).map((t) => (
          <button key={t} className={`tab ${tab === t ? "tab-active" : ""}`} onClick={() => {
            setTab(t as Tab);
            setSelectedReport(null); // Reset selected report when switching tabs
          }}>
            {t === "Reports Dashboard" && <FileText className="w-4 h-4 mr-1" />}
            {t === "Submit Report" && <FileText className="w-4 h-4 mr-1" />}
            {t === "Workflow Audit" && <CheckCircle className="w-4 h-4 mr-1" />}
            {t === "Pentest Verification" && <ShieldCheck className="w-4 h-4 mr-1" />}
            {t}
          </button>
        ))}
      </nav>

            {tab === "Reports Dashboard" && (
        <section className="space-y-6">
          {/* KPI Cards - Role-based Access */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentUser?.role === 'CEO' || currentUser?.role === 'CISO' ? 'Total Reports' : 'My Reports'}
                  </p>
                  <p className="text-2xl font-bold">{accessibleReports.length}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Critical Issues</p>
                  <p className="text-2xl font-bold text-red-600">
                    {accessibleReports.filter(r => r.severity === 'Critical').length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending Reviews</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {accessibleReports.filter(r => r.status === 'Under Review').length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Your Role</p>
                  <p className="text-lg font-bold">{currentUser?.role || 'Not Set'}</p>
                </div>
                <Users className="w-8 h-8 text-green-600" />
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
            /* Clickable Reports List */
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4">
                📄 Security Reports Dashboard
                <span className="text-sm font-normal text-gray-500 ml-2">(Click any report below to view executive & technical details)</span>
              </h2>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  🔍 <strong>Reports Dashboard:</strong> Click any report to see detailed executive summary + technical details
                </p>
              </div>
              <div className="space-y-4">
                {accessibleReports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                       onClick={() => setSelectedReport(report)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{report.id}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          report.severity === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          report.severity === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          report.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                          {report.severity}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          report.status === 'Under Review' ? 'bg-orange-100 text-orange-800' :
                          report.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {report.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{report.dateSubmitted}</span>
                        <span>👆 Click to view</span>
                      </div>
                    </div>
                    <h3 className="font-medium mb-1">{report.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {report.submittedBy} ({report.submittedByRole}) → {report.assignedTo || 'Unassigned'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Workflow: {report.workflowStage}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "Submit Report" && (
        <section className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Submit New Security Report</h2>
            <ReportSubmissionForm 
              currentUser={currentUser} 
              existingReports={reports}
              onSubmit={(newReport) => {
                RealTimeManager.addReport(newReport);
                setReports(RealTimeManager.getReports());
                showNotification('success', `Report ${newReport.id} submitted successfully!`);
                setTab("Reports Dashboard");
              }} 
            />
          </div>
        </section>
      )}



      {tab === "Workflow Audit" && (
        <section className="space-y-6">
          {/* Executive Summary Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {accessibleReports.filter(r => r.severity === 'Critical' && r.status !== 'Fixed').length}
                  </div>
                  <div className="text-xs text-gray-600">Critical Issues Active</div>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {accessibleReports.filter(r => r.workflowStage === 'Development' || r.workflowStage === 'Testing').length}
                  </div>
                  <div className="text-xs text-gray-600">In Progress</div>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {accessibleReports.filter(r => r.workflowStage === 'Closed' || r.status === 'Fixed').length}
                  </div>
                  <div className="text-xs text-gray-600">Resolved This Month</div>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(accessibleReports.filter(r => r.status === 'Under Review' && 
                      Math.floor((Date.now() - new Date(r.dateSubmitted).getTime()) / (1000 * 60 * 60 * 24)) > 3).length)}
                  </div>
                  <div className="text-xs text-gray-600">Overdue Items</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Executive Audit Trail - Vulnerability Lifecycle Tracking</h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                📋 <strong>Workflow Audit:</strong> This shows the journey of each vulnerability (who did what, when). 
                These cards are not clickable - they show the full audit trail directly.
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Track how each vulnerability is being identified, assigned, worked on, and resolved across departments
            </p>
            
            <div className="space-y-6">
              {accessibleReports.map((report) => {
                const daysSinceSubmission = Math.floor((Date.now() - new Date(report.dateSubmitted).getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysSinceSubmission > 3 && report.status === 'Under Review';
                const workflowJourney = getActualWorkflowJourney(report);
                
                return (
                  <div key={report.id} className={`border rounded-lg p-6 ${isOverdue ? 'border-red-300 bg-red-50/50' : 'bg-white dark:bg-gray-800'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{report.id}: {report.title}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-500">
                            Submitted {daysSinceSubmission} days ago • Currently: {report.workflowStage}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            report.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                            report.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                            report.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {report.severity} Risk
                          </span>
                          {isOverdue && (
                            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium animate-pulse">
                              ⚠️ OVERDUE
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                          {report.status}
                        </div>
                        <div className="text-xs text-gray-500">Current Status</div>
                      </div>
                    </div>

                    {/* Affected Systems */}
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                      <div className="text-sm font-medium mb-1">Affected Systems:</div>
                      <div className="flex flex-wrap gap-2">
                        {report.affectedSystems.map((system, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                            {system}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Clear Action Timeline */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-4">
                        � Who's Doing What:
                      </h4>
                      {workflowJourney.map((step, index) => (
                        <div key={index} className={`p-4 rounded-lg border-l-4 ${
                          step.status === 'completed' ? 'bg-green-50 border-green-400 dark:bg-green-900/20' :
                          step.status === 'in-progress' ? 'bg-blue-50 border-blue-400 dark:bg-blue-900/20' :
                          'bg-gray-50 border-gray-300 dark:bg-gray-800'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                step.status === 'completed' ? 'bg-green-500' :
                                step.status === 'in-progress' ? 'bg-blue-500' :
                                'bg-gray-400'
                              }`}>
                                {step.status === 'completed' ? '✓' : step.status === 'in-progress' ? '⏳' : index + 1}
                              </span>
                              <div>
                                <div className="font-semibold text-gray-800 dark:text-gray-200">
                                  {step.whoDidIt}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {step.role} • {step.department}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded border">
                              {step.when}
                            </span>
                          </div>
                          
                          <div className="ml-7">
                            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-1">
                              {step.step}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {step.description}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Next Action Alert */}
                      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-600 dark:text-yellow-400">⚡</span>
                          <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                            Next Action Required:
                          </span>
                        </div>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">
                          {report.assignedTo ? `Assigned to: ${report.assignedTo}` : 'Awaiting assignment'}
                          {report.workflowStage && ` • Current Stage: ${report.workflowStage}`}
                        </div>
                      </div>
                    </div>

                    {/* Current Bottleneck or Next Action */}
                    {report.nextAction && (
                      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <span className="font-medium text-yellow-800 dark:text-yellow-200">Action Required:</span>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          {report.nextAction}
                        </p>
                      </div>
                    )}

                    {/* Executive Actions */}
                    {(currentUser?.role === 'CISO' || currentUser?.role === 'CEO') && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex gap-2 flex-wrap">
                          <button 
                            onClick={() => {
                              RealTimeManager.updateReportStatus(report.id, 'Approved', 'Development Team');
                              setReports(RealTimeManager.getReports());
                              showNotification('success', `${report.id} fast-tracked for immediate resolution`);
                            }}
                            className="btn btn-primary text-xs"
                            disabled={report.status === 'Approved'}
                          >
                            🚀 Fast-Track Resolution
                          </button>
                          <button 
                            onClick={() => {
                              const priority = confirm('Mark this as business-critical priority?');
                              if (priority) {
                                showNotification('success', `${report.id} marked as business-critical - all teams notified`);
                              }
                            }}
                            className="btn text-xs bg-red-50 hover:bg-red-100 text-red-700"
                          >
                            🔥 Mark Critical
                          </button>
                          <button 
                            onClick={() => {
                              const message = prompt('Add executive note:');
                              if (message) {
                                showNotification('success', `Executive note added to ${report.id}`);
                              }
                            }}
                            className="btn text-xs"
                          >
                            📝 Add Executive Note
                          </button>
                          <button 
                            onClick={() => {
                              showNotification('success', `Detailed progress report for ${report.id} sent to your email`);
                            }}
                            className="btn text-xs"
                          >
                            📊 Request Detailed Report
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {tab === "Pentest Verification" && (
        <section className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Pentest AI - Vulnerability Verification</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Test if reported vulnerabilities have been properly fixed
            </p>
            
            <div className="space-y-4">
              {reports.filter(r => r.type === 'vulnerability' || r.type === 'fix').map((report) => (
                <div key={report.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{report.title}</span>
                    <button 
                      onClick={() => startPentestVerification(report.id)}
                      className="btn btn-primary text-sm"
                      disabled={pentestVerifications.get(report.id)?.status === 'scanning'}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {pentestVerifications.get(report.id)?.status === 'scanning' ? 'Testing...' : 'Test Vulnerability'}
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Affected Systems: {report.affectedSystems.join(', ')}
                  </div>
                  
                  {/* Pentest Verification Progress */}
                  {pentestVerifications.get(report.id) && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        {pentestVerifications.get(report.id)?.status === 'complete' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Loader className="w-4 h-4 animate-spin" />
                        )}
                        <span className="text-sm font-medium">
                          {pentestVerifications.get(report.id)?.currentStep}
                        </span>
                      </div>
                      
                      {pentestVerifications.get(report.id)?.status !== 'complete' && (
                        <>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${pentestVerifications.get(report.id)?.progress || 0}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {pentestVerifications.get(report.id)?.progress}% complete
                          </div>
                        </>
                      )}
                      
                      {pentestVerifications.get(report.id)?.results && (
                        <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded border">
                          <div className="flex items-center gap-2 mb-1">
                            {pentestVerifications.get(report.id)?.results?.vulnerabilityFixed ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium">
                              {pentestVerifications.get(report.id)?.results?.vulnerabilityFixed ? 'Fixed' : 'Still Vulnerable'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {pentestVerifications.get(report.id)?.results?.details}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {report.id === 'RPT-001' && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">Vulnerability Still Exists</span>
                      </div>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        SQL injection still exploitable on /api/auth/login endpoint
                      </p>
                    </div>
                  )}
                  
                  {report.id === 'RPT-002' && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">Fix In Progress</span>
                      </div>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Development team implementing parameterized queries
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}



      

      {false && (
        <section className="space-y-6">
          {/* <ThreatIntelPanel data={data.threatIntel} /> */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Threat Landscape</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Banking Sector Threats</span>
                  <span className="text-red-600 font-bold">High Activity</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>APT Groups Targeting Banks</span>
                  <span className="text-orange-600 font-bold">3 Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Zero-day Vulnerabilities</span>
                  <span className="text-yellow-600 font-bold">2 Disclosed</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Phishing Campaigns</span>
                  <span className="text-red-600 font-bold">15 Active</span>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Defensive Measures</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>AI Threat Detection</span>
                  <span className="text-green-600 font-bold">99.2% Accuracy</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Automated Response</span>
                  <span className="text-green-600 font-bold">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Threat Intelligence Feeds</span>
                  <span className="text-green-600 font-bold">12 Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Executive Briefings</span>
                  <span className="text-green-600 font-bold">Daily</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
