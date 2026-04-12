import { getAuthToken } from './api';

// Simple API helper to fetch real assets from backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export interface RealAsset {
  id: string;
  hostname: string;
  ip_address: string;
  effective_ip_address?: string | null;
  ad_primary_ip?: string | null;
  ad_dns_ip_addresses?: string[];
  ip_source?: string | null;
  ip_last_seen?: string | null;
  asset_type: string;
  department: string;
  criticality: string;
  os_version: string;
  owner_name: string;
  compliance_status: string;
  antivirus_status: string;
  edr_status: string;
  dlp_status: string;
  edr_agent_version?: string | null;
  edr_last_seen?: string | null;
  dlp_agent_version?: string | null;
  dlp_last_seen?: string | null;
  antivirus_version?: string | null;
  antivirus_last_scan?: string | null;
  ad_last_seen?: string | null;
  wazuh_last_seen?: string | null;
  network_last_seen?: string | null;
  last_observed_at?: string | null;
  raw_data?: any;
  vulnerability_count: number;
  last_seen: string;
}

export interface ADSyncResult {
  success: boolean;
  message: string;
  data: {
    assetsImported: number;
    errors: string[];
  };
}

/**
 * Trigger Active Directory sync
 */
export async function syncFromActiveDirectory(): Promise<ADSyncResult> {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_URL}/ad/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
    });

    if (!response.ok) {
      console.error('AD sync failed:', response.statusText);
      return {
        success: false,
        message: 'Failed to sync from Active Directory',
        data: { assetsImported: 0, errors: [response.statusText] }
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error syncing from AD:', error);
    return {
      success: false,
      message: 'Network error during AD sync',
      data: { assetsImported: 0, errors: [String(error)] }
    };
  }
}

export async function fetchRealAssets(): Promise<RealAsset[]> {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_URL}/assets?limit=200`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('Failed to fetch real assets:', response.statusText);
      return [];
    }

    const data = await response.json();
    return data.data?.assets || data.data?.items || data.data || [];
  } catch (error) {
    console.error('Error fetching real assets:', error);
    return [];
  }
}

export function convertToInventoryFormat(realAssets: RealAsset[]) {
  return realAssets.map(asset => ({
    name: asset.hostname,
    type: asset.asset_type === 'workstation' ? '💻 Workstation' : '🖥️ Server',
    department: asset.department,
    ip: asset.ip_address,
    edrStatus: asset.edr_status === 'protected' ? '✅' : asset.edr_status === 'offline' ? '⚠️' : '❌',
    dlpStatus: asset.dlp_status === 'protected' ? '✅' : asset.dlp_status === 'offline' ? '⚠️' : '❌',
    avStatus: asset.antivirus_status === 'protected' ? '✅' : asset.antivirus_status === 'not_installed' ? '❌' : '⚠️',
    complianceStatus: asset.compliance_status === 'compliant' ? '✅ OK' : 
                     asset.compliance_status === 'partially_compliant' ? '⚠️ Partial' :
                     asset.compliance_status === 'non_compliant' ? '❌ Non' : '⚠️ Unknown'
  }));
}
