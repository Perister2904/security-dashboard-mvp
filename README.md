# 🏦 AI Security Dashboard (Executive-Friendly)

A comprehensive security dashboard designed specifically for executive meetings and C-level briefings. This system provides both technical details for security teams and executive summaries for leadership.

## 🎯 **Key Features**

### **📋 Reports Dashboard**
- **Clickable Reports**: Click any report to see detailed executive + technical views
- **Role-Based Access**: Different views for CEOs, CISOs, Security Analysts, and Penetration Testers
- **Executive Summaries**: AI-generated plain English summaries for leadership
- **Technical Details**: Full technical information for security teams

### **📝 Submit Report**
- **Report Types**: Vulnerability, Security Fix, Incident Report, Audit Finding
- **Chain Management**: Create new chains or link reports to existing ones
- **Form Validation**: Comprehensive validation for data quality
- **Real-time Updates**: Automatic workflow progression

### **📊 Workflow Audit**
- **Dynamic Journey Tracking**: Shows who actually did what and when
- **Real People**: Displays actual names and roles from report data
- **Executive Visibility**: Clear audit trails for management oversight
- **Department Coordination**: Track work across security teams

### **🛡️ Pentest Verification**
- **Automated Testing**: AI-powered penetration testing verification
- **80% Success Rate**: Realistic vulnerability fix verification
- **Multiple Scanners**: OWASP ZAP, Nuclei, Trivy integration simulation
- **Real-time Results**: Live progress tracking with detailed findings

## 🚀 **Quick Start**

```bash
# Clone the repository
git clone [repository-url]

# Navigate to project directory
cd security-dashboard-mvp-exec-friendly

# Install dependencies
npm install

# Start development server
npm run dev
```

**Access the Application**: Open http://localhost:3000

## 👥 **User Roles & Access**

### **Executive Level (CEO, CISO)**
- ✅ View all reports with executive summaries
- ✅ Access workflow audit for department oversight
- ✅ Approve critical decisions
- ✅ Meeting-friendly detailed report views

### **Management Level (Security Architect)**
- ✅ Review technical reports and provide solutions
- ✅ Submit fix recommendations
- ✅ Approve operational changes

### **Operational Level (SOC, Penetration Testers)**
- ✅ Submit findings and vulnerability reports
- ✅ View assigned tasks and reports
- ✅ Update workflow status
- ✅ Run automated verification tests

## 🛠️ **Technology Stack**

- **Framework**: Next.js 14.2.5 with TypeScript
- **Styling**: Tailwind CSS with dark mode support
- **Icons**: Lucide React
- **State Management**: React Hooks
- **Real-time Updates**: Custom RealTimeManager class
- **Authentication**: Role-based session management

## 🔧 **Key Components**

### **Dynamic Audit Trail**
- Shows actual people who performed actions
- Real timeline based on report submission dates
- Executive-friendly "who did what" format

### **Chain Management**
- Create new report chains for related issues
- Link reports to existing chains for better organization

### **Pentest Verification**
- Realistic 80% success rate for vulnerability fixes
- Multiple security scanner simulation
- Live progress tracking with completion status

---

**Built for Final Year Project - Cybersecurity Management Dashboard**  
*Focused on executive communication and operational efficiency in enterprise security*
