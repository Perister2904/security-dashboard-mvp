import pool from '../config/database';
import { cacheGet, cacheSet, cacheInvalidatePattern } from '../config/redis';
import logger from '../utils/logger';

interface RiskFilters {
  status?: string;
  priority?: string;
}

export const riskService = {
  async getRisks(filters: RiskFilters): Promise<any[]> {
    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.priority) {
      whereConditions.push(`priority = $${paramIndex++}`);
      params.push(filters.priority);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT 
        id,
        title,
        description,
        category,
        priority,
        likelihood,
        impact,
        risk_score,
        status,
        owner,
        mitigation_plan,
        residual_risk,
        review_date,
        created_by,
        created_at,
        updated_at
      FROM risks
      ${whereClause}
      ORDER BY risk_score DESC, priority DESC`,
      params
    );

    return result.rows;
  },

  async getRiskById(id: string): Promise<any | null> {
    const cacheKey = `risk:${id}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(
      `SELECT 
        r.*,
        u1.username as owner_name,
        u2.username as created_by_name
      FROM risks r
      LEFT JOIN users u1 ON r.owner = u1.id
      LEFT JOIN users u2 ON r.created_by = u2.id
      WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    await cacheSet(cacheKey, result.rows[0], 300); // Cache for 5 minutes
    return result.rows[0];
  },

  async createRisk(riskData: any, userId: string): Promise<any> {
    const {
      title,
      description,
      category,
      priority,
      likelihood,
      impact,
      owner,
      mitigation_plan,
      residual_risk,
      review_date
    } = riskData;

    const result = await pool.query(
      `INSERT INTO risks (
        title,
        description,
        category,
        priority,
        likelihood,
        impact,
        owner,
        mitigation_plan,
        residual_risk,
        review_date,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        title,
        description,
        category,
        priority,
        likelihood,
        impact,
        owner,
        mitigation_plan,
        residual_risk,
        review_date,
        userId
      ]
    );

    // Invalidate cache
    await cacheInvalidatePattern('risk:*');
    
    logger.info('Risk created', { riskId: result.rows[0].id, userId });

    return result.rows[0];
  },

  async updateRisk(id: string, updates: any): Promise<any> {
    const allowedFields = [
      'title', 'description', 'category', 'priority', 'likelihood', 'impact',
      'status', 'owner', 'mitigation_plan', 'residual_risk', 'review_date'
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
      `UPDATE risks 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Risk not found');
    }

    // Invalidate cache
    await cacheInvalidatePattern('risk:*');
    
    logger.info(`Risk ${id} updated`, { updates });

    return result.rows[0];
  },

  async deleteRisk(id: string): Promise<void> {
    const result = await pool.query(
      'DELETE FROM risks WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Risk not found');
    }

    // Invalidate cache
    await cacheInvalidatePattern('risk:*');
    
    logger.info(`Risk ${id} deleted`);
  }
};
