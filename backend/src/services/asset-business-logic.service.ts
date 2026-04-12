import pool from '../config/database';
import { cacheInvalidatePattern } from '../config/redis';

type AssetCriticality = 'critical' | 'high' | 'medium' | 'low';
type ComplianceStatus = 'compliant' | 'partially_compliant' | 'non_compliant' | 'unknown';
type ControlStatus = 'protected' | 'not_installed' | 'offline' | 'outdated' | 'unknown';

interface AssetBusinessRow {
  id: string;
  hostname: string;
  asset_type: string;
  os_version: string | null;
  department: string | null;
  owner_name: string | null;
  ip_address: string | null;
  is_active: boolean;
  last_seen: string | null;
  edr_status: ControlStatus;
  dlp_status: ControlStatus;
  antivirus_status: ControlStatus;
  raw_data: any;
}

interface ObservationTimestamps {
  adLastSeen: string | null;
  wazuhLastSeen: string | null;
  networkLastSeen: string | null;
  lastObservedAt: string | null;
}

const CRITICAL_ROLE_KEYWORDS = [
  'domain controller',
  'active directory',
  'ldap',
  'dns',
  'sql',
  'database',
  'db',
  'exchange',
  'mail',
  'backup',
  'hyper-v',
  'virtualization',
  'firewall',
  'proxy',
  'production',
  'prod',
  'core',
];

const HIGH_ROLE_KEYWORDS = [
  'server',
  'application',
  'app',
  'web',
  'api',
  'file',
  'print',
  'security',
  'admin',
  'finance',
  'hr',
  'executive',
];

export const assetBusinessLogicService = {
  async recalculateAssets(assetIds?: string[]): Promise<void> {
    const assets = await this.getAssets(assetIds);

    for (const asset of assets) {
      const criticality = this.deriveCriticality(asset);
      const complianceStatus = this.deriveComplianceStatus(asset);
      const businessLogicPayload = this.buildBusinessLogicPayload(asset, criticality, complianceStatus);

      await pool.query(
        `UPDATE assets
         SET criticality = $1,
             compliance_status = $2,
             raw_data = COALESCE(raw_data, '{}'::jsonb) || jsonb_build_object('business_logic', $3::jsonb),
             updated_at = NOW()
         WHERE id = $4`,
        [criticality, complianceStatus, JSON.stringify(businessLogicPayload), asset.id]
      );
    }

    await cacheInvalidatePattern('asset:*');
    await cacheInvalidatePattern('assets:*');
  },

  async getAssets(assetIds?: string[]): Promise<AssetBusinessRow[]> {
    if (assetIds?.length) {
      const result = await pool.query(
        `SELECT id, hostname, asset_type, os_version, department, owner_name, ip_address::text, is_active, last_seen,
                edr_status, dlp_status, antivirus_status, raw_data
         FROM assets
         WHERE id = ANY($1::uuid[])`,
        [assetIds]
      );
      return result.rows;
    }

    const result = await pool.query(
      `SELECT id, hostname, asset_type, os_version, department, owner_name, ip_address::text, is_active, last_seen,
              edr_status, dlp_status, antivirus_status, raw_data
       FROM assets`
    );
    return result.rows;
  },

  deriveCriticality(asset: AssetBusinessRow): AssetCriticality {
    const context = [
      asset.hostname,
      asset.os_version || '',
      asset.department || '',
      asset.owner_name || '',
      asset.raw_data?.ad?.dns_host_name || '',
      asset.raw_data?.ad?.distinguished_name || '',
    ]
      .join(' ')
      .toLowerCase();

    if (asset.asset_type === 'server' && CRITICAL_ROLE_KEYWORDS.some((keyword) => context.includes(keyword))) {
      return 'critical';
    }

    if (asset.asset_type === 'server') {
      return 'high';
    }

    if (['workstation', 'laptop'].includes(asset.asset_type)) {
      if (['it security', 'security', 'finance', 'executive'].some((keyword) => context.includes(keyword))) {
        return 'high';
      }

      return 'medium';
    }

    return 'low';
  },

  deriveComplianceStatus(asset: AssetBusinessRow): ComplianceStatus {
    if (!asset.is_active) {
      return 'non_compliant';
    }

    const effectiveIpAddress = this.getEffectiveIpAddress(asset);
    if (!effectiveIpAddress) {
      return 'non_compliant';
    }

    const observations = this.getObservationTimestamps(asset);
    const ageInDays = observations.lastObservedAt
      ? (Date.now() - new Date(observations.lastObservedAt).getTime()) / (1000 * 60 * 60 * 24)
      : Number.POSITIVE_INFINITY;

    const coreTelemetryHealthy = asset.edr_status === 'protected' && asset.antivirus_status === 'protected';
    const dlpProtected = asset.dlp_status === 'protected';
    const dlpUnknown = asset.dlp_status === 'unknown';
    const hasFreshEvidence = ageInDays <= 30;
    const hasRecentEvidence = ageInDays <= 90;

    if (hasFreshEvidence && coreTelemetryHealthy && dlpProtected) {
      return 'compliant';
    }

    if (hasFreshEvidence && coreTelemetryHealthy && dlpUnknown) {
      return 'partially_compliant';
    }

    if (hasRecentEvidence && coreTelemetryHealthy && (dlpProtected || dlpUnknown)) {
      return 'partially_compliant';
    }

    if (!observations.lastObservedAt) {
      return 'unknown';
    }

    return 'non_compliant';
  },

  buildBusinessLogicPayload(
    asset: AssetBusinessRow,
    criticality: AssetCriticality,
    complianceStatus: ComplianceStatus
  ) {
    const observations = this.getObservationTimestamps(asset);
    const ageInDays = observations.lastObservedAt
      ? Math.round(((Date.now() - new Date(observations.lastObservedAt).getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10
      : null;

    return {
      evaluated_at: new Date().toISOString(),
      criticality: {
        value: criticality,
        reason:
          asset.asset_type === 'server'
            ? criticality === 'critical'
              ? 'Classified as critical because server role keywords indicate core infrastructure.'
              : 'Classified as high because it is a server without confirmed core-infrastructure indicators.'
            : criticality === 'high'
              ? 'Classified as high because department and asset type suggest elevated business impact.'
              : 'Classified as medium because it is an end-user endpoint without core-infrastructure indicators.',
      },
      compliance: {
        value: complianceStatus,
        reason: `Derived from active status, IP visibility, AV/EDR/DLP telemetry, and the freshest AD, network, or Wazuh evidence.`,
        last_observed_age_days: ageInDays,
        effective_ip_address: this.getEffectiveIpAddress(asset),
        controls: {
          edr_status: asset.edr_status,
          dlp_status: asset.dlp_status,
          antivirus_status: asset.antivirus_status,
        },
        observations,
      },
    };
  },

  getObservationTimestamps(asset: AssetBusinessRow): ObservationTimestamps {
    const adLastSeen = this.normalizeTimestamp(asset.raw_data?.ad?.last_logon_date);
    const wazuhLastSeen = this.normalizeTimestamp(asset.raw_data?.wazuh?.last_seen_at);
    const networkLastSeen = this.normalizeTimestamp(asset.raw_data?.network?.last_seen_at);
    const lastObservedAt = this.getLatestTimestamp([wazuhLastSeen, networkLastSeen, adLastSeen, this.normalizeTimestamp(asset.last_seen)]);

    return {
      adLastSeen,
      wazuhLastSeen,
      networkLastSeen,
      lastObservedAt,
    };
  },

  getEffectiveIpAddress(asset: AssetBusinessRow): string | null {
    const candidates = [
      asset.ip_address,
      asset.raw_data?.wazuh?.agent?.ip,
      asset.raw_data?.network?.observed_ip_address,
      asset.raw_data?.ad?.reported_ip_address,
      ...(Array.isArray(asset.raw_data?.ad?.reported_ip_addresses) ? asset.raw_data.ad.reported_ip_addresses : []),
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.split('/')[0].trim();
      }
    }

    return null;
  },

  normalizeTimestamp(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    const parsedTime = Date.parse(value);
    if (Number.isNaN(parsedTime)) {
      return null;
    }

    return new Date(parsedTime).toISOString();
  },

  getLatestTimestamp(values: Array<string | null | undefined>): string | null {
    const timestamps = values
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .sort((left, right) => Date.parse(right) - Date.parse(left));

    return timestamps[0] || null;
  },
};
