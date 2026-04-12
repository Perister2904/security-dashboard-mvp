import pool from '../config/database';
import { cacheGet, cacheSet, cacheInvalidatePattern } from '../config/redis';
import logger from '../utils/logger';

interface SOCMetrics {
  activeIncidents: number;
  criticalIncidents: number;
  mttr: number; // Mean Time to Resolution (hours)
  mtd: number; // Mean Time to Detection (hours)
  mtr: number; // Mean Time to Response (hours)
  mtc: number; // Mean Time to Containment (hours)
  alertVolume: number;
  falsePositiveRate: number;
  coverageScore: number;
  avgSeverity: number;
}

interface IncidentFilters {
  status?: string;
  severity?: string;
  analyst?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export const socService = {
  async getCurrentMetrics(): Promise<SOCMetrics> {
    const cacheKey = 'soc:metrics:current';
    const cached = await cacheGet<SOCMetrics>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as active_incidents,
        COUNT(*) FILTER (WHERE severity = 'critical' AND status IN ('open', 'in_progress')) as critical_incidents,
        ROUND(AVG(time_to_resolve_hours) FILTER (WHERE time_to_resolve_hours IS NOT NULL), 2) as mttr,
        ROUND(AVG(time_to_detect_minutes) FILTER (WHERE time_to_detect_minutes IS NOT NULL), 2) as mtd,
        ROUND(AVG(time_to_respond_minutes) FILTER (WHERE time_to_respond_minutes IS NOT NULL), 2) as mtr,
        ROUND(AVG(time_to_contain_minutes) FILTER (WHERE time_to_contain_minutes IS NOT NULL), 2) as mtc,
        COUNT(*) FILTER (WHERE detected_at >= NOW() - INTERVAL '24 hours') as alerts_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as incidents_created,
        COUNT(*) FILTER (WHERE resolved_at >= NOW() - INTERVAL '30 days') as incidents_resolved,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'false_positive')::numeric / NULLIF(COUNT(*), 0) * 100,
          2
        ) as false_positive_rate,
        ROUND(
          COUNT(*) FILTER (WHERE severity = 'critical')::numeric / NULLIF(COUNT(*), 0) * 100,
          2
        ) as escalation_rate
      FROM incidents
      WHERE detected_at >= NOW() - INTERVAL '30 days'
    `);

    const metrics = result.rows[0] || {
      active_incidents: 0,
      critical_incidents: 0,
      mttr: 0,
      mtd: 0,
      mtr: 0,
      mtc: 0,
      alerts_24h: 0,
      incidents_created: 0,
      incidents_resolved: 0,
      false_positive_rate: 0,
      escalation_rate: 0
    };

    await cacheSet(cacheKey, metrics, 60); // Cache for 1 minute
    return metrics;
  },

  async getMetricsHistory(days: number = 7): Promise<any[]> {
    const cacheKey = `soc:metrics:history:${days}`;
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(
      `SELECT 
        timestamp,
        metric_name,
        metric_value,
        metric_unit,
        metric_category,
        metadata
      FROM metrics_history
      WHERE timestamp >= NOW() - INTERVAL '1 day' * $1
      AND metric_name IN ('mttr', 'mtd', 'mtr', 'mtc', 'alerts_24h', 'false_positive_rate')
      ORDER BY timestamp DESC`,
      [days]
    );

    await cacheSet(cacheKey, result.rows, 300); // Cache for 5 minutes
    return result.rows;
  },

  async getIncidents(filters: IncidentFilters): Promise<{ incidents: any[]; total: number; limit: number; offset: number }> {
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.severity) {
      whereConditions.push(`severity = $${paramIndex++}`);
      params.push(filters.severity);
    }

    if (filters.analyst) {
      whereConditions.push(`assigned_to = $${paramIndex++}`);
      params.push(filters.analyst);
    }

    if (filters.fromDate) {
      whereConditions.push(`detected_at >= $${paramIndex++}`);
      params.push(filters.fromDate);
    }

    if (filters.toDate) {
      whereConditions.push(`detected_at <= $${paramIndex++}`);
      params.push(filters.toDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM incidents ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT 
        id,
        title,
        description,
        severity,
        status,
        source_tool,
        external_id,
        assigned_to,
        detected_at,
        responded_at,
        contained_at,
        resolved_at,
        time_to_detect_minutes,
        time_to_respond_minutes,
        time_to_contain_minutes,
        time_to_resolve_hours,
        affected_assets,
        raw_data,
        created_at,
        updated_at
      FROM incidents
      ${whereClause}
      ORDER BY detected_at DESC NULLS LAST
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return {
      incidents: dataResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
      limit,
      offset
    };
  },

  async getIncidentById(id: string): Promise<any | null> {
    const cacheKey = `soc:incident:${id}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(
      `SELECT 
        i.*,
        u.username as analyst_name,
        u.email as analyst_email,
        (SELECT json_agg(json_build_object(
          'id', t.id,
          'title', t.title,
          'status', t.status,
          'assigned_to', t.assigned_to,
          'completed_at', t.completed_at
        )) FROM tasks t WHERE t.incident_id = i.id) as tasks
      FROM incidents i
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE i.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    await cacheSet(cacheKey, result.rows[0], 120); // Cache for 2 minutes
    return result.rows[0];
  },

  async updateIncident(id: string, updates: any): Promise<any> {
    const allowedFields = ['status', 'assigned_to', 'responded_at', 'contained_at', 'resolved_at'];
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
      `UPDATE incidents 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *`,
      values
    );

    // Invalidate cache
    await cacheInvalidatePattern('soc:*');
    
    logger.info(`Incident ${id} updated`, { updates });

    return result.rows[0];
  },

  async getRecentEvents(limit: number = 50): Promise<any[]> {
    const cacheKey = `soc:events:recent:${limit}`;
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(
      `SELECT 
        id,
        title,
        severity,
        status,
        source_tool,
        detected_at,
        assigned_to
      FROM incidents
      ORDER BY detected_at DESC
      LIMIT $1`,
      [limit]
    );

    await cacheSet(cacheKey, result.rows, 30); // Cache for 30 seconds
    return result.rows;
  },

  async getAnalystPerformance(): Promise<any[]> {
    const cacheKey = 'soc:analysts:performance';
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(`
      SELECT 
        u.username,
        u.email,
        COUNT(i.id) as total_incidents,
        COUNT(CASE WHEN i.status = 'resolved' THEN 1 END) as resolved_incidents,
        ROUND(AVG(i.time_to_resolve_hours), 2) as avg_mttr,
        ROUND(AVG(i.time_to_respond_minutes), 2) as avg_mtr,
        COUNT(CASE WHEN i.severity = 'critical' THEN 1 END) as critical_handled
      FROM users u
      LEFT JOIN incidents i ON i.assigned_to = u.id
      WHERE u.role = 'soc_analyst'
      GROUP BY u.id, u.username, u.email
      ORDER BY resolved_incidents DESC
    `);

    await cacheSet(cacheKey, result.rows, 300); // Cache for 5 minutes
    return result.rows;
  },

  async getTasks(incidentId?: string): Promise<any[]> {
    const cacheKey = incidentId ? `soc:tasks:incident:${incidentId}` : 'soc:tasks:all';
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const query = incidentId
      ? `SELECT 
          t.*,
          i.title as incident_title,
          u.username as assigned_to_name
        FROM tasks t
        LEFT JOIN incidents i ON t.incident_id = i.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.incident_id = $1
        ORDER BY t.due_date ASC`
      : `SELECT 
          t.*,
          i.title as incident_title,
          u.username as assigned_to_name
        FROM tasks t
        LEFT JOIN incidents i ON t.incident_id = i.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.status != 'completed'
        ORDER BY t.due_date ASC
        LIMIT 100`;

    const result = incidentId 
      ? await pool.query(query, [incidentId])
      : await pool.query(query);

    await cacheSet(cacheKey, result.rows, 120); // Cache for 2 minutes
    return result.rows;
  }
};
