// Banking organizations with Islamic banking focus
export const organizations = ["Meezan Bank", "Al Baraka Bank", "Dubai Islamic Bank", "Bank Alfalah", "Faysal Bank"];

// Real-time data sources simulation
export interface DataSource {
  name: string;
  type: 'SIEM' | 'SOAR' | 'EDR' | 'Network' | 'Database' | 'API';
  status: 'Connected' | 'Degraded' | 'Offline';
  lastUpdate: string;
  recordsProcessed: number;
}

export const dataSources: DataSource[] = [
  { name: 'IBM QRadar SIEM', type: 'SIEM', status: 'Connected', lastUpdate: 'Just now', recordsProcessed: 45231 },
  { name: 'Splunk Enterprise', type: 'SIEM', status: 'Connected', lastUpdate: '2 min ago', recordsProcessed: 128904 },
  { name: 'CrowdStrike Falcon', type: 'EDR', status: 'Connected', lastUpdate: 'Just now', recordsProcessed: 8765 },
  { name: 'Core Banking API', type: 'API', status: 'Connected', lastUpdate: '1 min ago', recordsProcessed: 234156 },
  { name: 'ATM Network Monitor', type: 'Network', status: 'Connected', lastUpdate: 'Just now', recordsProcessed: 15432 },
  { name: 'Mobile Banking Logs', type: 'Database', status: 'Degraded', lastUpdate: '5 min ago', recordsProcessed: 67890 }
];

// Enhanced real-time activity generator
function generateRealtimeActivities(org: string): any[] {
  const currentTime = new Date();
  const activities = [];
  
  // Banking-specific departments and realistic activities
  const bankingActivities = [
    { dept: "SOC", owners: ["Ahmed Khan", "Sarah Ali", "Omar Sheikh"], activities: [
      "Monitoring ATM network for suspicious transactions",
      "Analyzing failed login attempts on mobile banking",
      "Investigating unusual wire transfer patterns",
      "Blocking suspicious IP addresses targeting online banking",
      "Reviewing fraud alerts from core banking system"
    ]},
    { dept: "Fraud Detection", owners: ["Fatima Ahmed", "Hassan Malik", "Ayesha Iqbal"], activities: [
      "Enhanced ML models for card fraud detection",
      "Investigating high-value transaction anomalies",
      "Blocked potential money laundering attempt",
      "Updated fraud rules for Ramadan season",
      "Analyzed cross-border payment patterns"
    ]},
    { dept: "Incident Response", owners: ["Bilal Raza", "Zainab Khan", "Ali Hassan"], activities: [
      "Contained phishing attack targeting customers",
      "Responding to ATM skimming incident",
      "Investigating unauthorized access attempt",
      "Coordinated response to DDoS attack",
      "Forensic analysis of compromised endpoint"
    ]},
    { dept: "Compliance", owners: ["Rabia Sheikh", "Muhammad Tariq", "Noor Fatima"], activities: [
      "SBP cybersecurity framework compliance audit",
      "PCI DSS quarterly assessment update",
      "Updated anti-money laundering procedures",
      "Regulatory reporting to State Bank of Pakistan",
      "Islamic banking compliance verification"
    ]},
    { dept: "Risk Management", owners: ["Imran Ali", "Sadia Malik", "Usman Khan"], activities: [
      "Updated enterprise risk register",
      "Assessed third-party vendor security",
      "Cyber risk quantification analysis",
      "Business continuity plan testing",
      "Threat intelligence briefing preparation"
    ]}
  ];

  // Generate activities for the last 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(currentTime.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const activitiesPerDay = dayOffset === 0 ? 8 : Math.floor(Math.random() * 6) + 3;
    
    for (let i = 0; i < activitiesPerDay; i++) {
      const deptData = bankingActivities[Math.floor(Math.random() * bankingActivities.length)];
      const activity = deptData.activities[Math.floor(Math.random() * deptData.activities.length)];
      const owner = deptData.owners[Math.floor(Math.random() * deptData.owners.length)];
      
      const timeOffset = Math.floor(Math.random() * 24 * 60); // Random time within the day
      const activityTime = new Date(date.getTime() + timeOffset * 60 * 1000);
      
      const statuses = dayOffset === 0 ? ["In Progress", "Done", "Pending"] : 
                      dayOffset === 1 ? ["Done", "Done", "Escalated"] : ["Done"];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      activities.push({
        id: `${dayOffset}-${i}`,
        department: deptData.dept,
        owner,
        activity,
        status,
        timestamp: formatTimestamp(activityTime, currentTime),
        priority: Math.random() > 0.7 ? "High" : Math.random() > 0.4 ? "Medium" : "Low",
        impact: Math.random() > 0.8 ? "Critical" : Math.random() > 0.5 ? "High" : "Medium"
      });
    }
  }
  
  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function formatTimestamp(activityTime: Date, currentTime: Date): string {
  const diffMs = currentTime.getTime() - activityTime.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return activityTime.toLocaleDateString();
}

// Enhanced KPI calculation with real-time trends
function calculateKPIs(org: string) {
  const seed = org.length * 7 + Date.now() / 100000; // Time-based seed for variation
  const rng = (n: number) => Math.abs(Math.sin(seed + n));
  
  return {
    overallRiskScore: Math.round(35 + rng(1) * 30), // Banking typically lower base risk
    openIncidents: Math.round(2 + rng(2) * 6),
    patchCompliance: Math.round(85 + rng(3) * 14), // Banks need higher compliance
    mttr: Math.round(2 + rng(4) * 8),
    fraudBlocked: Math.round(50 + rng(5) * 200),
    transactionsMonitored: Math.round(50000 + rng(6) * 100000),
    complianceScore: Math.round(90 + rng(7) * 9),
    systemAvailability: Math.round(99.5 + rng(8) * 0.49)
  };
}

// Generate threat intelligence data
function generateThreatIntel() {
  return [
    { 
      threat: "Banking Trojan Campaign", 
      severity: "High", 
      confidence: "85%", 
      affected: "Mobile Banking Apps",
      lastSeen: "2 hours ago",
      mitigation: "Enhanced app security implemented"
    },
    { 
      threat: "ATM Cash-out Gang", 
      severity: "Critical", 
      confidence: "92%", 
      affected: "ATM Network",
      lastSeen: "6 hours ago",
      mitigation: "Additional monitoring deployed"
    },
    { 
      threat: "Phishing Campaign", 
      severity: "Medium", 
      confidence: "78%", 
      affected: "Customer Email",
      lastSeen: "1 day ago",
      mitigation: "Email filters updated"
    }
  ];
}

export function demoData(org: string) {
  // Use a more stable seed that doesn't cause hydration issues
  const seed = org.length * 7;
  const rng = (n: number) => Math.abs(Math.sin(seed + n));
  
  // Real-time risk trend with more realistic banking data
  const riskTrend = Array.from({ length: 24 }, (_, i) => ({
    time: `${23 - i}:00`,
    risk: Math.round(25 + rng(i) * 35 + (i > 18 || i < 6 ? -10 : 0)), // Lower risk during off-hours
    incidents: Math.round(rng(i + 10) * 5),
    transactions: Math.round(1000 + rng(i + 20) * 5000)
  }));

  const kpis = calculateKPIs(org);
  const activities = generateRealtimeActivities(org);
  const threatIntel = generateThreatIntel();

  return { 
    riskTrend, 
    kpis, 
    activities,
    threatIntel,
    dataSources,
    lastUpdated: typeof window !== 'undefined' ? new Date().toLocaleTimeString() : '00:00:00'
  };
}
