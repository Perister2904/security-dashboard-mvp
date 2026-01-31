import pool from '../config/database';
import logger from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

interface ADComputer {
  Name: string;
  DNSHostName: string;
  IPv4Address: string;
  OperatingSystem: string;
  DistinguishedName: string;
  Enabled: boolean;
  LastLogonDate: string;
}

export class ADSyncService {
  private dcIp: string = '192.168.18.100';
  private domain: string = 'meezan.local';
  private username: string = 'Administrator';
  private password: string = 'Password123';

  /**
   * Sync computers from Active Directory using PowerShell
   */
  async syncFromAD(): Promise<{ success: boolean; assetsImported: number; errors: string[] }> {
    logger.info('Starting Active Directory sync...');
    
    const errors: string[] = [];
    let assetsImported = 0;

    try {
      // Get computers from AD using PowerShell
      const computers = await this.getComputersFromAD();
      
      if (computers.length === 0) {
        errors.push('No computers found in Active Directory');
        return { success: false, assetsImported: 0, errors };
      }

      logger.info(`Found ${computers.length} computers in Active Directory`);

      // Import each computer into database
      for (const computer of computers) {
        try {
          await this.importComputerToDatabase(computer);
          assetsImported++;
          logger.info(`Imported asset: ${computer.Name}`);
        } catch (err: any) {
          const error = `Failed to import ${computer.Name}: ${err.message}`;
          logger.error(error);
          errors.push(error);
        }
      }

      logger.info(`AD Sync complete. Imported ${assetsImported} assets`);
      return { success: true, assetsImported, errors };

    } catch (error: any) {
      logger.error('AD Sync failed:', error);
      errors.push(error.message);
      return { success: false, assetsImported: 0, errors };
    }
  }

  /**
   * Get computers from Active Directory using Python Asset Scanner
   */
  private async getComputersFromAD(): Promise<ADComputer[]> {
    const assetPopulationDir = path.resolve(__dirname, '../../../asset-population');
    const pythonScript = path.join(assetPopulationDir, 'Asset_Scanner.py');
    const outputFile = path.join(assetPopulationDir, 'ad_sync_output.json');
    
    const command = `python "${pythonScript}" --domain ${this.domain} --dc-ip ${this.dcIp} --username "${this.username}" --password "${this.password}" --output "${outputFile}"`;

    try {
      logger.info(`Running Python AD scanner from: ${pythonScript}`);
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
        cwd: assetPopulationDir
      });

      logger.info('Python scanner completed');
      if (stdout) logger.debug('Scanner stdout:', stdout);
      if (stderr && !stderr.includes('INFO')) {
        logger.warn('Scanner stderr:', stderr);
      }

      // Read the output file
      const fs = await import('fs/promises');
      
      try {
        const outputData = await fs.readFile(outputFile, 'utf8');
        const scanResults = JSON.parse(outputData);
        
        // Handle both array and single object
        const resultsArray = Array.isArray(scanResults) ? scanResults : [scanResults];
        
        // Convert scan results to ADComputer format
        const computers: ADComputer[] = resultsArray.map((asset: any) => ({
          Name: asset.asset_name,
          DNSHostName: asset.asset_name + '.meezan.local',
          IPv4Address: asset.ip_address,
          OperatingSystem: asset.details?.operating_system || 'Unknown',
          DistinguishedName: `CN=${asset.asset_name},CN=Computers,DC=meezan,DC=local`,
          Enabled: true,
          LastLogonDate: new Date().toISOString()
        }));

        logger.info(`Python scanner found ${computers.length} computers`);
        return computers;
      } catch (readError: any) {
        logger.error('Failed to read scanner output file:', readError.message);
        throw new Error(`Failed to read scanner output: ${readError.message}`);
      }
    } catch (error: any) {
      logger.error('Failed to run Python AD scanner:', error.message);
      if (error.stdout) logger.info('Scanner stdout:', error.stdout);
      if (error.stderr) logger.error('Scanner stderr:', error.stderr);
      throw new Error(`AD Scanner failed: ${error.message}`);
    }
  }

  /**
   * Import a computer from AD into the database
   */
  private async importComputerToDatabase(computer: ADComputer): Promise<void> {
    const hostname = computer.Name || 'Unknown';
    const ipAddress = computer.IPv4Address || null;
    const osVersion = computer.OperatingSystem || 'Unknown';
    const isEnabled = computer.Enabled;
    const lastSeen = computer.LastLogonDate !== 'Never' ? computer.LastLogonDate : null;

    // Determine compliance status (basic logic)
    const complianceStatus = isEnabled ? 'unknown' : 'non_compliant';

    // Check if asset already exists
    const existingAsset = await pool.query(
      'SELECT id FROM assets WHERE hostname = $1',
      [hostname]
    );

    if (existingAsset.rows.length > 0) {
      // Update existing asset
      await pool.query(
        `UPDATE assets 
         SET ip_address = $1,
             os_version = $2,
             compliance_status = $3,
             last_seen = COALESCE($4::timestamp, last_seen),
             is_active = $5,
             updated_at = NOW()
         WHERE hostname = $6`,
        [ipAddress, osVersion, complianceStatus, lastSeen, isEnabled, hostname]
      );
      logger.debug(`Updated existing asset: ${hostname}`);
    } else {
      // Insert new asset
      await pool.query(
        `INSERT INTO assets (
          hostname,
          ip_address,
          asset_type,
          department,
          criticality,
          os_version,
          owner_name,
          compliance_status,
          antivirus_status,
          edr_status,
          dlp_status,
          is_active,
          last_seen,
          first_discovered
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
        [
          hostname,
          ipAddress,
          'workstation',
          'IT',
          'medium',
          osVersion,
          'AD Imported',
          complianceStatus,
          'not_installed',
          'not_installed',
          'not_installed',
          isEnabled,
          lastSeen
        ]
      );
      logger.debug(`Inserted new asset: ${hostname}`);
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<any> {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(*) FILTER (WHERE is_active = true) as active_assets,
        COUNT(*) FILTER (WHERE compliance_status = 'compliant') as compliant_assets,
        MAX(updated_at) as last_sync
      FROM assets
    `);

    return result.rows[0];
  }
}

export const adSyncService = new ADSyncService();
