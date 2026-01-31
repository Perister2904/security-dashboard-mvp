-- Add test computers to simulate multiple assets
-- Run this to add UBUNTU-CLIENT and WINDOWS-CLIENT-2 to dashboard

INSERT INTO assets (hostname, ip_address, os_type, os_version, domain, last_seen, risk_score, compliance_status, department, owner, asset_type, criticality)
VALUES
  ('UBUNTU-CLIENT', '192.168.56.101', 'Linux', 'Ubuntu 22.04 LTS', 'meezan.local', NOW(), 35, 'compliant', 'IT', 'Muhammad Haris', 'workstation', 'medium'),
  ('WINDOWS-CLIENT-2', '192.168.18.105', 'Windows', 'Windows 11 Pro', 'meezan.local', NOW(), 28, 'compliant', 'HR', 'Test User', 'workstation', 'low')
ON CONFLICT (hostname) DO UPDATE SET
  last_seen = NOW(),
  ip_address = EXCLUDED.ip_address,
  os_type = EXCLUDED.os_type,
  os_version = EXCLUDED.os_version;

-- Verify assets
SELECT hostname, ip_address, os_type, department, risk_score, compliance_status FROM assets ORDER BY hostname;
