import pool from '../config/database';
import { cacheGet, cacheSet, cacheInvalidatePattern } from '../config/redis';
import logger from '../utils/logger';

interface AssetFilters {
  department?: string;
  criticality?: string;
  page?: number;
  limit?: number;
}

export const assetService = {
  async getAssets(filters: AssetFilters): Promise<{ assets: any[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let whereConditions = [];
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
        name,
        type,
        department,
        criticality,
        ip_address,
        hostname,
        os,
        owner,
        last_scan,
        vulnerabilities,
        risk_score,
        edr_installed,
        av_installed,
        patch_status,
        compliance_status,
        tags,
        created_at,
        updated_at
      FROM assets
      ${whereClause}
      ORDER BY risk_score DESC, criticality DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return {
      assets: dataResult.rows,
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

    await cacheSet(cacheKey, result.rows[0], 300); // Cache for 5 minutes
    return result.rows[0];
  },

  async getCoverageStats(): Promise<any> {
    const cacheKey = 'assets:coverage:stats';
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(`
      SELECT 
        total_assets,
        edr_coverage,
        av_coverage,
        backup_coverage,
        patch_coverage,
        vulnerability_scan_coverage,
        avg_coverage
      FROM asset_coverage_summary
    `);

    const stats = result.rows[0] || {
      total_assets: 0,
      edr_coverage: 0,
      av_coverage: 0,
      backup_coverage: 0,
      patch_coverage: 0,
      vulnerability_scan_coverage: 0,
      avg_coverage: 0
    };

    // Get department breakdown
    const deptResult = await pool.query(`
      SELECT 
        department,
        COUNT(*) as total,
        COUNT(CASE WHEN edr_installed THEN 1 END)::float / COUNT(*) * 100 as edr_pct,
        COUNT(CASE WHEN av_installed THEN 1 END)::float / COUNT(*) * 100 as av_pct,
        COUNT(CASE WHEN patch_status = 'up-to-date' THEN 1 END)::float / COUNT(*) * 100 as patch_pct
      FROM assets
      GROUP BY department
      ORDER BY total DESC
    `);

    stats.departmentBreakdown = deptResult.rows;

    await cacheSet(cacheKey, stats, 300); // Cache for 5 minutes
    return stats;
  },

  async getRiskPosture(): Promise<any> {
    const cacheKey = 'assets:risk:posture';
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(`
      SELECT 
        criticality,
        COUNT(*) as count,
        ROUND(AVG(risk_score), 2) as avg_risk_score,
        ROUND(AVG(vulnerabilities->>'critical')::numeric, 2) as avg_critical_vulns,
        ROUND(AVG(vulnerabilities->>'high')::numeric, 2) as avg_high_vulns
      FROM assets
      GROUP BY criticality
      ORDER BY 
        CASE criticality
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `);

    // Get overall risk distribution
    const distResult = await pool.query(`
      SELECT 
        CASE 
          WHEN risk_score >= 80 THEN 'critical'
          WHEN risk_score >= 60 THEN 'high'
          WHEN risk_score >= 40 THEN 'medium'
          ELSE 'low'
        END as risk_level,
        COUNT(*) as count
      FROM assets
      GROUP BY risk_level
      ORDER BY 
        CASE risk_level
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `);

    // Get top vulnerable assets
    const topVulnResult = await pool.query(`
      SELECT 
        id,
        name,
        type,
        department,
        criticality,
        risk_score,
        vulnerabilities
      FROM assets
      ORDER BY risk_score DESC
      LIMIT 10
    `);

    const posture = {
      byCriticality: result.rows,
      riskDistribution: distResult.rows,
      topVulnerableAssets: topVulnResult.rows
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
        name,
        type,
        department,
        criticality,
        edr_installed,
        av_installed,
        patch_status,
        last_scan,
        risk_score,
        ARRAY[
          CASE WHEN NOT edr_installed THEN 'No EDR' END,
          CASE WHEN NOT av_installed THEN 'No Antivirus' END,
          CASE WHEN patch_status != 'up-to-date' THEN 'Outdated Patches' END,
          CASE WHEN last_scan < NOW() - INTERVAL '30 days' THEN 'Stale Scan Data' END,
          CASE WHEN (vulnerabilities->>'critical')::int > 0 THEN 'Critical Vulnerabilities' END
        ]::text[] as gaps
      FROM assets
      WHERE 
        NOT edr_installed 
        OR NOT av_installed 
        OR patch_status != 'up-to-date'
        OR last_scan < NOW() - INTERVAL '30 days'
        OR (vulnerabilities->>'critical')::int > 0
      ORDER BY 
        criticality DESC,
        risk_score DESC
      LIMIT 100
    `);

    // Remove NULL values from gaps array
    const gaps = result.rows.map((row: any) => ({
      ...row,
      gaps: row.gaps.filter((g: any) => g !== null)
    }));

    await cacheSet(cacheKey, gaps, 300); // Cache for 5 minutes
    return gaps;
  },

  async updateAsset(id: string, updates: any): Promise<any> {
    const allowedFields = [
      'name', 'type', 'department', 'criticality', 'owner', 
      'edr_installed', 'av_installed', 'patch_status', 
      'compliance_status', 'tags'
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
