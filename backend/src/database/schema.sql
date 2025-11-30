-- Security Dashboard Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- NULL for AD-only users
  full_name VARCHAR(255),
  department VARCHAR(100),
  role VARCHAR(50) NOT NULL CHECK (role IN ('ceo', 'ciso', 'soc_analyst', 'auditor', 'admin')),
  is_active BOOLEAN DEFAULT true,
  is_ad_user BOOLEAN DEFAULT false,
  ad_dn TEXT, -- LDAP Distinguished Name
  last_login TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- =====================================================
-- INCIDENTS & ALERTS
-- =====================================================

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(255) UNIQUE, -- ID from source system
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'false_positive')),
  category VARCHAR(100), -- 'malware', 'phishing', 'unauthorized_access', etc
  source_tool VARCHAR(50) NOT NULL, -- 'splunk', 'crowdstrike', 'qradar', etc
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  detected_at TIMESTAMP,
  responded_at TIMESTAMP,
  contained_at TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Assignment
  assigned_to UUID REFERENCES users(id),
  assigned_at TIMESTAMP,
  
  -- Affected entities
  affected_assets TEXT[], -- Array of asset IDs
  affected_users TEXT[], -- Array of usernames
  source_ip INET,
  destination_ip INET,
  
  -- Metrics (auto-calculated)
  time_to_detect_minutes INTEGER,
  time_to_respond_minutes INTEGER,
  time_to_contain_minutes INTEGER,
  time_to_resolve_hours NUMERIC(10,2),
  
  -- Additional data
  tags TEXT[],
  evidence_links TEXT[],
  remediation_notes TEXT,
  raw_data JSONB, -- Full original data from source
  
  CONSTRAINT valid_timestamps CHECK (
    (responded_at IS NULL OR responded_at >= detected_at) AND
    (contained_at IS NULL OR contained_at >= responded_at) AND
    (resolved_at IS NULL OR resolved_at >= contained_at)
  )
);

CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX idx_incidents_detected_at ON incidents(detected_at DESC);
CREATE INDEX idx_incidents_assigned_to ON incidents(assigned_to);
CREATE INDEX idx_incidents_source_tool ON incidents(source_tool);
CREATE INDEX idx_incidents_external_id ON incidents(external_id);

-- =====================================================
-- ASSETS
-- =====================================================

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(255) UNIQUE, -- ID from CMDB
  hostname VARCHAR(255) NOT NULL,
  ip_address INET,
  mac_address MACADDR,
  
  -- Classification
  asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('server', 'workstation', 'laptop', 'network_device', 'mobile', 'iot')),
  os_type VARCHAR(50), -- 'windows', 'linux', 'macos', 'ios', 'android'
  os_version VARCHAR(100),
  department VARCHAR(100),
  location VARCHAR(255),
  criticality VARCHAR(20) NOT NULL CHECK (criticality IN ('critical', 'high', 'medium', 'low')),
  
  -- Ownership
  owner_email VARCHAR(255),
  owner_name VARCHAR(255),
  business_unit VARCHAR(100),
  
  -- Security tool coverage
  edr_status VARCHAR(20) DEFAULT 'not_installed' CHECK (edr_status IN ('protected', 'not_installed', 'offline', 'outdated')),
  edr_agent_version VARCHAR(50),
  edr_last_seen TIMESTAMP,
  
  dlp_status VARCHAR(20) DEFAULT 'not_installed' CHECK (dlp_status IN ('protected', 'not_installed', 'offline', 'outdated')),
  dlp_agent_version VARCHAR(50),
  dlp_last_seen TIMESTAMP,
  
  antivirus_status VARCHAR(20) DEFAULT 'not_installed' CHECK (antivirus_status IN ('protected', 'not_installed', 'offline', 'outdated')),
  antivirus_version VARCHAR(50),
  antivirus_last_scan TIMESTAMP,
  antivirus_last_update TIMESTAMP,
  
  -- Vulnerability data
  vulnerability_count INTEGER DEFAULT 0,
  critical_vuln_count INTEGER DEFAULT 0,
  high_vuln_count INTEGER DEFAULT 0,
  last_vulnerability_scan TIMESTAMP,
  
  -- Compliance
  compliance_status VARCHAR(30) CHECK (compliance_status IN ('compliant', 'partially_compliant', 'non_compliant', 'unknown')),
  compliance_frameworks TEXT[], -- ['PCI-DSS', 'SOC2', 'ISO27001']
  last_compliance_check TIMESTAMP,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP,
  first_discovered TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  raw_data JSONB
);

CREATE INDEX idx_assets_hostname ON assets(hostname);
CREATE INDEX idx_assets_ip ON assets(ip_address);
CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_department ON assets(department);
CREATE INDEX idx_assets_criticality ON assets(criticality);
CREATE INDEX idx_assets_edr_status ON assets(edr_status);
CREATE INDEX idx_assets_dlp_status ON assets(dlp_status);
CREATE INDEX idx_assets_av_status ON assets(antivirus_status);
CREATE INDEX idx_assets_active ON assets(is_active);

-- =====================================================
-- RISKS
-- =====================================================

CREATE TABLE risks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(255) UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  business_impact TEXT,
  
  -- Risk scoring
  likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 10),
  impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 10),
  risk_score INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED,
  
  -- Classification
  category VARCHAR(100), -- 'technical', 'operational', 'strategic', 'compliance'
  risk_type VARCHAR(100), -- 'vulnerability', 'threat', 'gap', 'misconfiguration'
  affected_assets TEXT[],
  affected_systems TEXT[],
  
  -- Status
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'mitigated', 'accepted', 'transferred', 'closed')),
  priority VARCHAR(20) CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  
  -- Mitigation
  mitigation_plan TEXT,
  mitigation_status VARCHAR(50),
  mitigation_cost NUMERIC(15,2),
  estimated_loss NUMERIC(15,2),
  
  -- Ownership
  owner VARCHAR(255),
  assigned_to UUID REFERENCES users(id),
  due_date DATE,
  
  -- Timestamps
  identified_date DATE DEFAULT CURRENT_DATE,
  last_assessment_date DATE,
  next_review_date DATE,
  closed_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  raw_data JSONB
);

CREATE INDEX idx_risks_status ON risks(status);
CREATE INDEX idx_risks_risk_score ON risks(risk_score DESC);
CREATE INDEX idx_risks_priority ON risks(priority);
CREATE INDEX idx_risks_assigned_to ON risks(assigned_to);
CREATE INDEX idx_risks_due_date ON risks(due_date);

-- =====================================================
-- METRICS HISTORY (Time-series data)
-- =====================================================

CREATE TABLE metrics_history (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC(15,4),
  metric_unit VARCHAR(20), -- 'minutes', 'hours', 'count', 'percentage', 'score'
  metric_category VARCHAR(50), -- 'soc', 'assets', 'risks', 'compliance'
  metadata JSONB,
  
  UNIQUE(timestamp, metric_name)
);

CREATE INDEX idx_metrics_timestamp ON metrics_history(timestamp DESC);
CREATE INDEX idx_metrics_name ON metrics_history(metric_name);
CREATE INDEX idx_metrics_category ON metrics_history(metric_category);
CREATE INDEX idx_metrics_name_timestamp ON metrics_history(metric_name, timestamp DESC);

-- =====================================================
-- AUDIT LOGS
-- =====================================================

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  username VARCHAR(255),
  action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'view_dashboard', 'export_report', 'update_incident'
  resource_type VARCHAR(50), -- 'incident', 'asset', 'risk', 'user', 'report'
  resource_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  request_method VARCHAR(10), -- 'GET', 'POST', 'PUT', 'DELETE'
  request_path VARCHAR(500),
  response_code INTEGER,
  duration_ms INTEGER,
  details JSONB
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_success ON audit_logs(success);

-- =====================================================
-- CONNECTOR CONFIGURATIONS
-- =====================================================

CREATE TABLE connector_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_name VARCHAR(100) UNIQUE NOT NULL,
  connector_type VARCHAR(50) NOT NULL, -- 'siem', 'edr', 'cmdb', 'vuln_scanner', 'ticketing'
  is_enabled BOOLEAN DEFAULT true,
  config JSONB NOT NULL, -- Connection details, credentials (encrypted)
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(50), -- 'success', 'failed', 'partial'
  last_sync_error TEXT,
  sync_interval_ms INTEGER DEFAULT 300000, -- 5 minutes default
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_connector_type ON connector_configs(connector_type);
CREATE INDEX idx_connector_enabled ON connector_configs(is_enabled);

-- =====================================================
-- SYNC LOGS
-- =====================================================

CREATE TABLE sync_logs (
  id BIGSERIAL PRIMARY KEY,
  connector_id UUID REFERENCES connector_configs(id),
  connector_name VARCHAR(100) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) NOT NULL, -- 'running', 'success', 'failed', 'partial'
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  details JSONB
);

CREATE INDEX idx_sync_logs_connector ON sync_logs(connector_id);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);

-- =====================================================
-- TASKS (for incident response workflow)
-- =====================================================

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  task_type VARCHAR(50), -- 'investigation', 'containment', 'remediation', 'documentation'
  priority VARCHAR(20) CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')),
  
  assigned_to UUID REFERENCES users(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP,
  
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  estimated_hours NUMERIC(10,2),
  actual_hours NUMERIC(10,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  notes TEXT,
  attachments TEXT[]
);

CREATE INDEX idx_tasks_incident ON tasks(incident_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATES
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_risks_updated_at BEFORE UPDATE ON risks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate incident metrics
CREATE OR REPLACE FUNCTION calculate_incident_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Time to detect (from created to detected)
  IF NEW.detected_at IS NOT NULL AND NEW.created_at IS NOT NULL THEN
    NEW.time_to_detect_minutes = EXTRACT(EPOCH FROM (NEW.detected_at - NEW.created_at)) / 60;
  END IF;
  
  -- Time to respond (from detected to responded)
  IF NEW.responded_at IS NOT NULL AND NEW.detected_at IS NOT NULL THEN
    NEW.time_to_respond_minutes = EXTRACT(EPOCH FROM (NEW.responded_at - NEW.detected_at)) / 60;
  END IF;
  
  -- Time to contain (from responded to contained)
  IF NEW.contained_at IS NOT NULL AND NEW.responded_at IS NOT NULL THEN
    NEW.time_to_contain_minutes = EXTRACT(EPOCH FROM (NEW.contained_at - NEW.responded_at)) / 60;
  END IF;
  
  -- Time to resolve (from contained to resolved)
  IF NEW.resolved_at IS NOT NULL AND NEW.contained_at IS NOT NULL THEN
    NEW.time_to_resolve_hours = EXTRACT(EPOCH FROM (NEW.resolved_at - NEW.contained_at)) / 3600;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_incident_metrics_trigger 
BEFORE INSERT OR UPDATE ON incidents 
FOR EACH ROW EXECUTE FUNCTION calculate_incident_metrics();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Active incidents summary
CREATE OR REPLACE VIEW active_incidents_summary AS
SELECT 
  COUNT(*) as total_incidents,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
  COUNT(*) FILTER (WHERE severity = 'high') as high_count,
  COUNT(*) FILTER (WHERE severity = 'medium') as medium_count,
  COUNT(*) FILTER (WHERE severity = 'low') as low_count,
  COUNT(*) FILTER (WHERE status = 'open') as open_count,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h_count
FROM incidents
WHERE status NOT IN ('closed', 'false_positive');

-- Asset coverage summary
CREATE OR REPLACE VIEW asset_coverage_summary AS
SELECT 
  COUNT(*) as total_assets,
  COUNT(*) FILTER (WHERE edr_status = 'protected') as edr_protected,
  COUNT(*) FILTER (WHERE dlp_status = 'protected') as dlp_protected,
  COUNT(*) FILTER (WHERE antivirus_status = 'protected') as av_protected,
  COUNT(*) FILTER (WHERE compliance_status = 'compliant') as compliant_assets,
  COUNT(*) FILTER (WHERE criticality = 'critical') as critical_assets,
  ROUND(COUNT(*) FILTER (WHERE edr_status = 'protected')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as edr_coverage_pct,
  ROUND(COUNT(*) FILTER (WHERE dlp_status = 'protected')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as dlp_coverage_pct,
  ROUND(COUNT(*) FILTER (WHERE antivirus_status = 'protected')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as av_coverage_pct
FROM assets
WHERE is_active = true;

-- Current SOC metrics
CREATE OR REPLACE VIEW current_soc_metrics AS
SELECT 
  ROUND(AVG(time_to_detect_minutes), 1) as mean_time_to_detect,
  ROUND(AVG(time_to_respond_minutes), 1) as mean_time_to_respond,
  ROUND(AVG(time_to_contain_minutes), 1) as mean_time_to_contain,
  ROUND(AVG(time_to_resolve_hours), 1) as mean_time_to_resolve,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as incidents_created_24h,
  COUNT(*) FILTER (WHERE resolved_at >= NOW() - INTERVAL '24 hours') as incidents_resolved_24h,
  COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as active_incidents
FROM incidents
WHERE detected_at >= NOW() - INTERVAL '30 days';

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Create default admin user (password: Admin@123)
INSERT INTO users (email, username, password_hash, full_name, department, role, is_active, is_ad_user)
VALUES (
  'admin@company.local',
  'admin',
  '$2b$10$K7ZFTl3vx4kO.YoMvz3g8.TFGKhG9X5dX9nQzCvC7VJH6aM.XhzQC', -- Admin@123
  'System Administrator',
  'IT Security',
  'admin',
  true,
  false
);

-- Create sample connector config (disabled by default)
INSERT INTO connector_configs (connector_name, connector_type, is_enabled, config)
VALUES (
  'splunk_primary',
  'siem',
  false,
  '{"url": "https://splunk.company.local:8089", "verify_ssl": false, "index": "security"}'::jsonb
);
