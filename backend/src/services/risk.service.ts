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
        risk_type,
        priority,
        likelihood,
        impact,
        risk_score,
        status,
        owner,
        mitigation_plan,
        mitigation_status,
        estimated_loss,
        due_date,
        next_review_date,
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
        u.username as assigned_to_name
      FROM risks r
      LEFT JOIN users u ON r.assigned_to = u.id
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
      risk_type,
      priority,
      likelihood,
      impact,
      owner,
      assigned_to,
      mitigation_plan,
      mitigation_status,
      estimated_loss,
      due_date,
      next_review_date
    } = riskData;

    const result = await pool.query(
      `INSERT INTO risks (
        title,
        description,
        category,
        risk_type,
        priority,
        likelihood,
        impact,
        owner,
        assigned_to,
        mitigation_plan,
        mitigation_status,
        estimated_loss,
        due_date,
        next_review_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        title,
        description,
        category,
        risk_type,
        priority,
        likelihood,
        impact,
        owner,
        assigned_to || null,
        mitigation_plan,
        mitigation_status,
        estimated_loss,
        due_date,
        next_review_date
      ]
    );

    // Invalidate cache
    await cacheInvalidatePattern('risk:*');
    
    logger.info('Risk created', { riskId: result.rows[0].id, userId });

    return result.rows[0];
  },

  async updateRisk(id: string, updates: any): Promise<any> {
    const allowedFields = [
      'title',
      'description',
      'category',
      'risk_type',
      'priority',
      'likelihood',
      'impact',
      'status',
      'owner',
      'assigned_to',
      'mitigation_plan',
      'mitigation_status',
      'estimated_loss',
      'due_date',
      'next_review_date'
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
