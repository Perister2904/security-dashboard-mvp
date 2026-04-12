import pool from '../config/database';
import { cacheGet, cacheSet, cacheInvalidatePattern } from '../config/redis';
import logger from '../utils/logger';

interface AssetFilters {
  department?: string;
  criticality?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsedTime = Date.parse(value);
  if (Number.isNaN(parsedTime)) {
    return null;
  }

  return new Date(parsedTime).toISOString();
}

function getLatestTimestamp(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort((left, right) => Date.parse(right) - Date.parse(left));

  return timestamps[0] || null;
}

function decorateAssetObservationFields(asset: any): any {
  const adLastSeen = normalizeTimestamp(asset?.raw_data?.ad?.last_logon_date);
  const wazuhLastSeen = normalizeTimestamp(asset?.raw_data?.wazuh?.last_seen_at) || normalizeTimestamp(asset?.edr_last_seen);
  const networkLastSeen = normalizeTimestamp(asset?.raw_data?.network?.last_seen_at);
  const legacyLastSeen = normalizeTimestamp(asset?.last_seen);
  const lastObservedAt = getLatestTimestamp([wazuhLastSeen, networkLastSeen, adLastSeen, legacyLastSeen]);
  const adDnsIpAddresses = Array.isArray(asset?.raw_data?.ad?.reported_ip_addresses)
    ? asset.raw_data.ad.reported_ip_addresses
    : [];
  const adPrimaryIp =
    asset?.raw_data?.ad?.reported_ip_address ||
    (adDnsIpAddresses.length > 0 ? adDnsIpAddresses[0] : null) ||
    null;
  const ipEvidenceSource = typeof asset?.raw_data?.ip_evidence?.source === 'string' ? asset.raw_data.ip_evidence.source : null;
  const ipEvidenceLastSeen = normalizeTimestamp(asset?.raw_data?.ip_evidence?.last_seen_at);
  const ipEvidenceAddress = typeof asset?.raw_data?.ip_evidence?.ip_address === 'string' ? asset.raw_data.ip_evidence.ip_address : null;
  const effectiveIpAddress =
    asset?.ip_address?.split?.('/')?.[0] ||
    ipEvidenceAddress?.split?.('/')?.[0] ||
    asset?.raw_data?.wazuh?.agent?.ip ||
    asset?.raw_data?.network?.observed_ip_address?.split?.('/')?.[0] ||
    adPrimaryIp ||
    null;
  const derivedIpSource =
    ipEvidenceSource ||
    (asset?.ip_address ? 'manual' : null) ||
    (asset?.raw_data?.wazuh?.agent?.ip ? 'wazuh' : null) ||
    (asset?.raw_data?.network?.observed_ip_address ? 'network_scan' : null) ||
    (adPrimaryIp ? 'ad_dns' : 'unknown');
  const derivedIpLastSeen =
    ipEvidenceLastSeen ||
    normalizeTimestamp(asset?.raw_data?.wazuh?.last_seen_at) ||
    normalizeTimestamp(asset?.raw_data?.network?.last_seen_at) ||
    normalizeTimestamp(asset?.raw_data?.ad?.last_synced_at);

  return {
    ...asset,
    ad_primary_ip: adPrimaryIp,
    ad_dns_ip_addresses: adDnsIpAddresses,
    effective_ip_address: effectiveIpAddress,
    ip_source: derivedIpSource,
    ip_last_seen: derivedIpLastSeen,
    ad_last_seen: adLastSeen,
    wazuh_last_seen: wazuhLastSeen,
    network_last_seen: networkLastSeen,
    last_observed_at: lastObservedAt,
  };
}

export const assetService = {
  async getAssets(filters: AssetFilters): Promise<{ assets: any[]; total: number; page: number; limit: number }> {
    const limit = filters.limit || 50;
    const offset = filters.offset !== undefined ? filters.offset : ((filters.page || 1) - 1) * limit;
    const page = Math.floor(offset / limit) + 1;

    let whereConditions = ['is_active = true'];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.department) {
      whereConditions.push(`department = $${paramIndex++}`);
      params.push(filters.department);
    }

    if (filters.criticality) {
      whereConditions.push(`criticality = $${paramIndex++}`);
      params.push(filters.criticality);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM assets ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT 
        id,
        hostname,
        asset_type,
        department,
        criticality,
        ip_address,
        os_version,
        owner_name,
        last_seen,
        edr_agent_version,
        edr_last_seen,
        dlp_agent_version,
        dlp_last_seen,
        antivirus_version,
        antivirus_last_scan,
        vulnerability_count,
        critical_vuln_count,
        high_vuln_count,
        antivirus_status,
        compliance_status,
        edr_status,
        dlp_status,
        raw_data,
        created_at,
        updated_at
      FROM assets
      ${whereClause}
      ORDER BY vulnerability_count DESC, criticality DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return {
      assets: dataResult.rows.map(decorateAssetObservationFields),
      total: parseInt(countResult.rows[0].total),
      page,
      limit
    };
  },

  async getAssetById(id: string): Promise<any | null> {
    const cacheKey = `asset:${id}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(
      `SELECT 
        a.*,
        (SELECT json_agg(json_build_object(
          'id', i.id,
          'title', i.title,
          'severity', i.severity,
          'status', i.status,
          'detected_at', i.detected_at
        )) FROM incidents i 
        WHERE a.id = ANY(i.affected_assets) 
        AND i.status != 'resolved'
        ORDER BY i.detected_at DESC
        LIMIT 10) as related_incidents
      FROM assets a
      WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const decoratedAsset = decorateAssetObservationFields(result.rows[0]);
    await cacheSet(cacheKey, decoratedAsset, 300); // Cache for 5 minutes
    return decoratedAsset;
  },

  async getCoverageStats(): Promise<any> {
    const cacheKey = 'assets:coverage:stats';
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(*) FILTER (WHERE edr_status = 'protected') as edr_protected,
        COUNT(*) FILTER (WHERE dlp_status = 'protected') as dlp_protected,
        COUNT(*) FILTER (WHERE antivirus_status = 'protected') as av_protected,
        COUNT(*) FILTER (WHERE compliance_status = 'compliant') as compliant_assets
      FROM assets
      WHERE is_active = true
    `);

    const stats = result.rows[0] || {
      total_assets: 0,
      edr_protected: 0,
      dlp_protected: 0,
      av_protected: 0,
      compliant_assets: 0
    };

    const total = parseInt(stats.total_assets, 10) || 0;
    const pct = (num: number) => total > 0 ? Math.round((num / total) * 100) : 0;

    const departmentBreakdown = await pool.query(`
      SELECT 
        department,
        COUNT(*) as total,
        ROUND(COUNT(*) FILTER (WHERE edr_status = 'protected')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as edr_pct,
        ROUND(COUNT(*) FILTER (WHERE dlp_status = 'protected')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as dlp_pct,
        ROUND(COUNT(*) FILTER (WHERE antivirus_status = 'protected')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as av_pct,
        ROUND(COUNT(*) FILTER (WHERE compliance_status = 'compliant')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as compliance_pct
      FROM assets
      WHERE is_active = true
      GROUP BY department
      ORDER BY total DESC
    `);

    const response = {
      total_assets: total,
      edr_coverage_pct: pct(parseInt(stats.edr_protected, 10) || 0),
      dlp_coverage_pct: pct(parseInt(stats.dlp_protected, 10) || 0),
      av_coverage_pct: pct(parseInt(stats.av_protected, 10) || 0),
      compliance_pct: pct(parseInt(stats.compliant_assets, 10) || 0),
      departmentBreakdown: departmentBreakdown.rows
    };

    await cacheSet(cacheKey, response, 300); // Cache for 5 minutes
    return response;
  },

  async getRiskPosture(): Promise<any> {
    const cacheKey = 'assets:risk:posture';
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const assetsResult = await pool.query(`
      SELECT 
        id,
        hostname,
        asset_type,
        department,
        criticality,
        vulnerability_count,
        critical_vuln_count,
        high_vuln_count,
        compliance_status,
        edr_status,
        dlp_status,
        antivirus_status
      FROM assets
      WHERE is_active = true
    `);

    const criticalityWeight: Record<string, number> = {
      critical: 30,
      high: 20,
      medium: 10,
      low: 0
    };

    const withScores = assetsResult.rows.map((asset: any) => {
      const critical = parseInt(asset.critical_vuln_count, 10) || 0;
      const high = parseInt(asset.high_vuln_count, 10) || 0;
      const total = parseInt(asset.vulnerability_count, 10) || 0;
      const remaining = Math.max(total - critical - high, 0);
      const baseScore = (critical * 20) + (high * 10) + (remaining * 2);
      const telemetryPenalty =
        (asset.edr_status !== 'protected' ? 10 : 0) +
        (asset.dlp_status !== 'protected' ? 10 : 0) +
        (asset.antivirus_status !== 'protected' ? 10 : 0);
      const compliancePenalty =
        asset.compliance_status === 'non_compliant' ? 20 :
        asset.compliance_status === 'partially_compliant' ? 10 :
        asset.compliance_status === 'unknown' ? 5 : 0;
      const riskScore = Math.min(
        100,
        baseScore + (criticalityWeight[asset.criticality] || 0) + telemetryPenalty + compliancePenalty
      );
      return { ...asset, risk_score: riskScore };
    });

    const byCriticality = ['critical', 'high', 'medium', 'low'].map((level) => {
      const items = withScores.filter(a => a.criticality === level);
      const avg = items.length ? (items.reduce((sum, a) => sum + a.risk_score, 0) / items.length) : 0;
      return { criticality: level, count: items.length, avg_risk_score: Math.round(avg * 100) / 100 };
    });

    const riskDistribution = ['critical', 'high', 'medium', 'low'].map((level) => {
      const count = withScores.filter(a => {
        if (level === 'critical') return a.risk_score >= 80;
        if (level === 'high') return a.risk_score >= 60 && a.risk_score < 80;
        if (level === 'medium') return a.risk_score >= 40 && a.risk_score < 60;
        return a.risk_score < 40;
      }).length;
      return { risk_level: level, count };
    });

    const topVulnerableAssets = [...withScores]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 10)
      .map(a => ({
        id: a.id,
        hostname: a.hostname,
        asset_type: a.asset_type,
        department: a.department,
        criticality: a.criticality,
        risk_score: a.risk_score,
        compliance_status: a.compliance_status,
        edr_status: a.edr_status,
        dlp_status: a.dlp_status,
        antivirus_status: a.antivirus_status
      }));

    const averageRiskScore = withScores.length
      ? withScores.reduce((sum, asset) => sum + asset.risk_score, 0) / withScores.length
      : 0;

    const posture = {
      overallScore: Math.max(0, Math.min(100, Math.round(100 - averageRiskScore))),
      averageRiskScore: Math.round(averageRiskScore * 100) / 100,
      byCriticality,
      riskDistribution,
      topVulnerableAssets
    };

    await cacheSet(cacheKey, posture, 300); // Cache for 5 minutes
    return posture;
  },

  async getCoverageGaps(): Promise<any[]> {
    const cacheKey = 'assets:coverage:gaps';
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(`
      SELECT 
        id,
        hostname,
        asset_type,
        department,
        criticality,
        edr_status,
        dlp_status,
        antivirus_status,
        compliance_status,
        last_vulnerability_scan,
        vulnerability_count,
        critical_vuln_count,
        high_vuln_count
      FROM assets
      WHERE is_active = true AND (
        edr_status != 'protected'
        OR dlp_status != 'protected'
        OR antivirus_status != 'protected'
        OR compliance_status != 'compliant'
        OR last_vulnerability_scan < NOW() - INTERVAL '30 days'
        OR critical_vuln_count > 0
      )
      ORDER BY 
        CASE criticality
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        critical_vuln_count DESC,
        high_vuln_count DESC
      LIMIT 100
    `);

    const gaps = result.rows.map((row: any) => {
      const gapList = [];
      if (row.edr_status !== 'protected') gapList.push('EDR Not Reporting');
      if (row.dlp_status !== 'protected') gapList.push('DLP Not Reporting');
      if (row.antivirus_status !== 'protected') gapList.push('AV Not Reporting');
      if (row.compliance_status === 'non_compliant') gapList.push('Non-Compliant');
      if (row.compliance_status === 'partially_compliant') gapList.push('Partially Compliant');
      if (row.compliance_status === 'unknown') gapList.push('Compliance Unverified');
      if (row.last_vulnerability_scan && new Date(row.last_vulnerability_scan) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        gapList.push('Stale Vulnerability Scan');
      }
      if ((parseInt(row.critical_vuln_count, 10) || 0) > 0) gapList.push('Critical Vulnerabilities');
      return { ...row, gaps: gapList };
    });

    await cacheSet(cacheKey, gaps, 300); // Cache for 5 minutes
    return gaps;
  },

  async updateAsset(id: string, updates: any): Promise<any> {
    const allowedFields = [
      'hostname', 'asset_type', 'department', 'criticality', 'owner_name',
      'owner_email', 'edr_status', 'dlp_status', 'antivirus_status',
      'compliance_status', 'os_version', 'ip_address', 'is_active'
    ];
    
    const updateFields = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE assets 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *`,
      values
    );

    // Invalidate cache
    await cacheInvalidatePattern('asset:*');
    await cacheInvalidatePattern('assets:*');
    
    logger.info(`Asset ${id} updated`, { updates });

    return result.rows[0];
  }
};
