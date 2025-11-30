import pool from '../config/database';
import { cacheGet, cacheSet } from '../config/redis';
import logger from '../utils/logger';

export const ceoService = {
  async getExecutiveSummary(): Promise<any> {
    const cacheKey = 'ceo:summary:executive';
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    // Get SOC metrics
    const socMetrics = await pool.query(`
      SELECT 
        active_incidents,
        critical_incidents,
        mttr,
        alert_volume
      FROM current_soc_metrics
    `);

    // Get asset stats
    const assetStats = await pool.query(`
      SELECT 
        total_assets,
        avg_coverage
      FROM asset_coverage_summary
    `);

    // Get risk summary
    const riskSummary = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE priority = 'critical') as critical_risks,
        COUNT(*) FILTER (WHERE priority = 'high') as high_risks,
        COUNT(*) FILTER (WHERE status = 'open') as open_risks,
        ROUND(AVG(risk_score), 2) as avg_risk_score
      FROM risks
    `);

    // Get trend data (30 days)
    const trendData = await pool.query(`
      SELECT 
        DATE(metric_date) as date,
        AVG(CASE WHEN metric_name = 'mttr' THEN metric_value END) as avg_mttr,
        SUM(CASE WHEN metric_name = 'alert_volume' THEN metric_value END) as total_alerts
      FROM metrics_history
      WHERE metric_date >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(metric_date)
      ORDER BY date DESC
      LIMIT 30
    `);

    const summary = {
      security: {
        activeIncidents: socMetrics.rows[0]?.active_incidents || 0,
        criticalIncidents: socMetrics.rows[0]?.critical_incidents || 0,
        mttr: socMetrics.rows[0]?.mttr || 0,
        alertVolume: socMetrics.rows[0]?.alert_volume || 0
      },
      assets: {
        total: assetStats.rows[0]?.total_assets || 0,
        coverage: assetStats.rows[0]?.avg_coverage || 0
      },
      risks: {
        critical: riskSummary.rows[0]?.critical_risks || 0,
        high: riskSummary.rows[0]?.high_risks || 0,
        open: riskSummary.rows[0]?.open_risks || 0,
        avgScore: riskSummary.rows[0]?.avg_risk_score || 0
      },
      trends: trendData.rows
    };

    await cacheSet(cacheKey, summary, 900); // Cache for 15 minutes
    return summary;
  },

  async getFinancialImpact(days: number = 30): Promise<any> {
    const cacheKey = `ceo:financial:impact:${days}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    // Calculate incident costs (based on severity and resolution time)
    const incidentCosts = await pool.query(
      `SELECT 
        severity,
        COUNT(*) as incident_count,
        ROUND(AVG(mttr), 2) as avg_resolution_hours,
        CASE severity
          WHEN 'critical' THEN COUNT(*) * 50000  -- $50k per critical incident
          WHEN 'high' THEN COUNT(*) * 20000      -- $20k per high incident
          WHEN 'medium' THEN COUNT(*) * 5000     -- $5k per medium incident
          WHEN 'low' THEN COUNT(*) * 1000        -- $1k per low incident
        END as estimated_cost
      FROM incidents
      WHERE detected_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY severity`,
      [days]
    );

    // Calculate downtime costs
    const downtimeCosts = await pool.query(
      `SELECT 
        SUM(
          EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600 * 10000
        ) as total_downtime_cost
      FROM incidents
      WHERE 
        detected_at >= NOW() - INTERVAL '1 day' * $1
        AND resolved_at IS NOT NULL
        AND severity IN ('critical', 'high')`,
      [days]
    );

    // Calculate vulnerability remediation costs
    const vulnCosts = await pool.query(
      `SELECT 
        SUM(
          (vulnerabilities->>'critical')::int * 500 +
          (vulnerabilities->>'high')::int * 200 +
          (vulnerabilities->>'medium')::int * 50
        ) as estimated_remediation_cost
      FROM assets
      WHERE last_scan >= NOW() - INTERVAL '1 day' * $1`,
      [days]
    );

    const totalCost = 
      (incidentCosts.rows.reduce((sum: number, row: any) => sum + (parseInt(row.estimated_cost) || 0), 0)) +
      (parseFloat(downtimeCosts.rows[0]?.total_downtime_cost) || 0) +
      (parseFloat(vulnCosts.rows[0]?.estimated_remediation_cost) || 0);

    const impact = {
      totalEstimatedCost: Math.round(totalCost),
      incidentBreakdown: incidentCosts.rows,
      downtimeCost: Math.round(parseFloat(downtimeCosts.rows[0]?.total_downtime_cost) || 0),
      remediationCost: Math.round(parseFloat(vulnCosts.rows[0]?.estimated_remediation_cost) || 0),
      period: `${days} days`
    };

    await cacheSet(cacheKey, impact, 900); // Cache for 15 minutes
    return impact;
  },

  async getTopRisks(limit: number = 10): Promise<any[]> {
    const cacheKey = `ceo:risks:top:${limit}`;
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;

    const result = await pool.query(
      `SELECT 
        id,
        title,
        description,
        category,
        priority,
        risk_score,
        status,
        mitigation_plan,
        owner,
        review_date
      FROM risks
      WHERE status IN ('open', 'in-progress')
      ORDER BY risk_score DESC, priority DESC
      LIMIT $1`,
      [limit]
    );

    await cacheSet(cacheKey, result.rows, 900); // Cache for 15 minutes
    return result.rows;
  },

  async getCompliancePosture(): Promise<any> {
    const cacheKey = 'ceo:compliance:posture';
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    // Get compliance status by department
    const deptCompliance = await pool.query(`
      SELECT 
        department,
        COUNT(*) as total_assets,
        COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END) as compliant_count,
        ROUND(
          COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 
          2
        ) as compliance_rate
      FROM assets
      GROUP BY department
      ORDER BY compliance_rate ASC
    `);

    // Get overall compliance rate
    const overallCompliance = await pool.query(`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END) as compliant_count,
        ROUND(
          COUNT(CASE WHEN compliance_status = 'compliant' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 
          2
        ) as overall_rate
      FROM assets
    `);

    // Get non-compliant assets by criticality
    const nonCompliantCritical = await pool.query(`
      SELECT 
        id,
        name,
        type,
        department,
        criticality,
        compliance_status
      FROM assets
      WHERE 
        compliance_status != 'compliant'
        AND criticality IN ('critical', 'high')
      ORDER BY criticality DESC, risk_score DESC
      LIMIT 20
    `);

    const posture = {
      overallRate: overallCompliance.rows[0]?.overall_rate || 0,
      totalAssets: overallCompliance.rows[0]?.total_assets || 0,
      compliantCount: overallCompliance.rows[0]?.compliant_count || 0,
      departmentBreakdown: deptCompliance.rows,
      criticalNonCompliant: nonCompliantCritical.rows
    };

    await cacheSet(cacheKey, posture, 900); // Cache for 15 minutes
    return posture;
  },

  async sendExecutiveReport(email: string, reportType: string): Promise<void> {
    // This is a placeholder for email functionality
    // In production, integrate with your email service (SendGrid, SES, etc.)
    
    logger.info('Executive report requested', { email, reportType });

    // Generate report data based on type
    let reportData;
    switch (reportType) {
      case 'weekly':
        reportData = await this.getExecutiveSummary();
        break;
      case 'monthly':
        reportData = {
          summary: await this.getExecutiveSummary(),
          financial: await this.getFinancialImpact(30),
          risks: await this.getTopRisks(20),
          compliance: await this.getCompliancePosture()
        };
        break;
      case 'financial':
        reportData = await this.getFinancialImpact(30);
        break;
      default:
        throw new Error('Invalid report type');
    }

    // TODO: Integrate with email service
    // await emailService.sendReport(email, reportType, reportData);

    logger.info('Executive report generated', { email, reportType, dataSize: JSON.stringify(reportData).length });
  }
};
