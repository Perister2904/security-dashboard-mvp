import pool from '../config/database';
import logger from '../utils/logger';
import ldap from 'ldapjs';
import dotenv from 'dotenv';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { promises as dns } from 'dns';
import fs from 'fs';

dotenv.config();

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface ADComputer {
  Name: string;
  DNSHostName: string;
  IPv4Address: string | null;
  ReportedIPAddresses?: string[];
  OperatingSystem: string;
  DistinguishedName: string;
  Enabled: boolean;
  LastLogonDate: string;
}

interface PreferredSubnet {
  network: string;
  prefixLength: number;
}

export class ADSyncService {
  private dcIp: string;
  private domain: string;
  private username: string;
  private password: string;
  private vmName: string;
  private vmUsername: string;
  private vmPassword: string;
  private vboxManagePath: string;

  constructor() {
    this.dcIp = process.env.AD_DC_IP || '';
    this.domain = process.env.AD_DOMAIN || '';
    this.username = process.env.AD_USERNAME || '';
    this.password = process.env.AD_PASSWORD || '';
    this.vmName = process.env.AD_VM_NAME || 'AD-Server-Production';
    this.vmUsername = process.env.AD_VM_USERNAME || 'Administrator';
    this.vmPassword = process.env.AD_VM_PASSWORD || 'Password123';
    this.vboxManagePath = process.env.VBOXMANAGE_PATH || 'C:\\Program Files\\Oracle\\VirtualBox\\VBoxManage.exe';
  }

  /**
   * Sync computers from Active Directory using PowerShell
   */
  async syncFromAD(): Promise<{ success: boolean; assetsImported: number; errors: string[] }> {
    logger.info('Starting Active Directory sync...');
    
    const errors: string[] = [];
    let assetsImported = 0;

    try {
      if (!this.domain || !this.username || !this.password) {
        throw new Error('AD sync credentials not configured. Set AD_DOMAIN, AD_USERNAME, and AD_PASSWORD.');
      }
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

      await this.deactivateMissingAssets(computers.map((computer) => computer.Name));

      logger.info(`AD Sync complete. Imported ${assetsImported} assets`);
      return { success: true, assetsImported, errors };

    } catch (error: any) {
      logger.error('AD Sync failed:', error);
      errors.push(error.message);
      return { success: false, assetsImported: 0, errors };
    }
  }

  private async getComputersFromAD(): Promise<ADComputer[]> {
    try {
      return await this.getComputersFromADViaLDAP();
    } catch (ldapError: any) {
      logger.warn(`LDAP AD sync failed, falling back to direct VM query: ${ldapError.message}`);
    }

    try {
      return await this.getComputersFromADViaVirtualBox();
    } catch (vmError: any) {
      logger.warn(`VirtualBox AD sync failed, falling back to Python scanner: ${vmError.message}`);
    }

    return this.getComputersFromADViaPython();
  }

  private async getComputersFromADViaLDAP(): Promise<ADComputer[]> {
    const ldapUrl = this.getADSyncLdapUrl();
    const bindDN = process.env.LDAP_BIND_DN || this.buildBindIdentity();
    const bindPassword = process.env.LDAP_BIND_PASSWORD || this.password;
    const baseDN = process.env.LDAP_BASE_DN || this.buildBaseDN();

    if (!ldapUrl || !bindDN || !bindPassword || !baseDN) {
      throw new Error('Direct LDAP sync requires LDAP_URL, bind credentials, and base DN.');
    }

    logger.info(`Querying Active Directory over LDAP: ${ldapUrl}`);

    const client = ldap.createClient({
      url: ldapUrl,
      timeout: 10000,
      connectTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    });
    client.on('error', (err) => {
      logger.warn(`LDAP client error during AD sync: ${err.message}`);
    });

    const bindAsync = () =>
      new Promise<void>((resolve, reject) => {
        client.bind(bindDN, bindPassword, (err) => (err ? reject(err) : resolve()));
      });

    const searchAsync = () =>
      new Promise<any[]>((resolve, reject) => {
        const rows: any[] = [];
        client.search(
          baseDN,
          {
            filter: '(objectClass=computer)',
            scope: 'sub',
            paged: true,
            attributes: [
              'cn',
              'dNSHostName',
              'operatingSystem',
              'distinguishedName',
              'lastLogonTimestamp',
              'userAccountControl'
            ]
          },
          (err, res) => {
            if (err) {
              reject(err);
              return;
            }

            res.on('searchEntry', (entry) => {
              rows.push((entry as any).object || {});
            });
            res.on('error', reject);
            res.on('end', () => resolve(rows));
          }
        );
      });

    const unbindAsync = () =>
      new Promise<void>((resolve) => {
        client.unbind(() => resolve());
      });

    try {
      await bindAsync();
      const rows = await searchAsync();

      const computers = (
        await Promise.all(
          rows
            .filter((row) => row?.cn)
            .map(async (row) => {
              const hostname = row.cn as string;
              const dnsHostName = (row.dNSHostName as string) || `${hostname}.${this.domain}`;
              const adIdentity = await this.resolveAdIpIdentity(dnsHostName, hostname);

              return {
                Name: hostname,
                DNSHostName: dnsHostName,
                IPv4Address: adIdentity.primaryIp,
                ReportedIPAddresses: adIdentity.allIps,
                OperatingSystem: (row.operatingSystem as string) || 'Unknown',
                DistinguishedName:
                  (row.distinguishedName as string) || `CN=${hostname},CN=Computers,${baseDN}`,
                Enabled: this.isAccountEnabled(row.userAccountControl),
                LastLogonDate: this.fileTimeToISOString(row.lastLogonTimestamp)
              };
            })
        )
      ).filter((computer) => computer.Name);

      logger.info(`Direct LDAP query found ${computers.length} computers`);
      return computers;
    } finally {
      await unbindAsync();
    }
  }

  private async getComputersFromADViaVirtualBox(): Promise<ADComputer[]> {
    const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    const script =
      'Import-Module ActiveDirectory; ' +
      'Get-ADComputer -Filter * -Properties DNSHostName,IPv4Address,OperatingSystem,Enabled,LastLogonDate ' +
      '| Select-Object Name,DNSHostName,IPv4Address,OperatingSystem,Enabled,LastLogonDate ' +
      '| ConvertTo-Json -Compress';

    logger.info(`Querying Active Directory directly inside VM: ${this.vmName}`);

    const { stdout, stderr } = await execFileAsync(
      this.vboxManagePath,
      [
        'guestcontrol',
        this.vmName,
        'run',
        '--exe',
        powershellPath,
        '--username',
        this.vmUsername,
        '--password',
        this.vmPassword,
        '--',
        'powershell.exe',
        '-NoProfile',
        '-Command',
        script
      ],
      {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024
      }
    );

    if (stderr && stderr.trim()) {
      logger.warn(`VirtualBox AD query stderr: ${stderr.trim()}`);
    }

    const parsed = JSON.parse(stdout.trim());
    const rows = Array.isArray(parsed) ? parsed : [parsed];

    const computers = await Promise.all(
      rows
        .filter((row: any) => row?.Name)
        .map(async (row: any) => {
          const dnsHostName = row.DNSHostName || `${row.Name}.${this.domain}`;
          const adIdentity = await this.resolveAdIpIdentity(dnsHostName, row.Name, row.IPv4Address || null);

          return {
            Name: row.Name,
            DNSHostName: dnsHostName,
            IPv4Address: adIdentity.primaryIp,
            ReportedIPAddresses: adIdentity.allIps,
            OperatingSystem: row.OperatingSystem || 'Unknown',
            DistinguishedName: `CN=${row.Name},CN=Computers,DC=meezan,DC=local`,
            Enabled: row.Enabled !== false,
            LastLogonDate: row.LastLogonDate || new Date().toISOString()
          };
        })
    );

    logger.info(`VirtualBox AD query found ${computers.length} computers`);
    return computers;
  }

  private async getComputersFromADViaPython(): Promise<ADComputer[]> {
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
          ReportedIPAddresses: asset.ip_address ? [asset.ip_address] : [],
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

  private async deactivateMissingAssets(activeHostnames: string[]): Promise<void> {
    if (activeHostnames.length === 0) {
      return;
    }

    await pool.query(
      `UPDATE assets
       SET is_active = false,
           updated_at = NOW()
       WHERE is_active = true
         AND asset_type IN ('server', 'workstation')
         AND NOT (hostname = ANY($1::text[]))`,
      [activeHostnames]
    );

    logger.info(`Marked assets inactive if absent from AD sync`, { activeHostnames });
  }

  /**
   * Import a computer from AD into the database
   */
  private async importComputerToDatabase(computer: ADComputer): Promise<void> {
    const hostname = computer.Name || 'Unknown';
    const ipAddress = computer.IPv4Address || null;
    const osVersion = computer.OperatingSystem || 'Unknown';
    const isEnabled = computer.Enabled;
    const lastSeen = this.normalizeADTimestamp(computer.LastLogonDate);
    const reportedIpAddresses = this.normalizeIpList(computer.ReportedIPAddresses || [], ipAddress);

    const complianceStatus = this.deriveComplianceStatus(isEnabled, ipAddress, lastSeen);
    const assetType = /server/i.test(osVersion) ? 'server' : 'workstation';
    const criticality = /server/i.test(osVersion) ? 'critical' : 'medium';

    // Check if asset already exists
    const existingAsset = await pool.query(
      'SELECT id, raw_data FROM assets WHERE hostname = $1',
      [hostname]
    );
    const mergedRawData = this.buildAssetRawData(existingAsset.rows[0]?.raw_data, computer, reportedIpAddresses);

    if (existingAsset.rows.length > 0) {
      // Update existing asset
      await pool.query(
        `UPDATE assets 
         SET ip_address = $1,
             os_version = $2,
             compliance_status = $3,
             asset_type = $4,
             criticality = $5,
             last_seen = COALESCE($6::timestamp, last_seen),
             is_active = $7,
             raw_data = $8::jsonb,
             updated_at = NOW()
         WHERE hostname = $9`,
        [ipAddress, osVersion, complianceStatus, assetType, criticality, lastSeen, isEnabled, JSON.stringify(mergedRawData), hostname]
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
          raw_data,
          last_seen,
          first_discovered
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, NOW())`,
        [
          hostname,
          ipAddress,
          assetType,
          'IT',
          criticality,
          osVersion,
          'AD Imported',
          complianceStatus,
          'not_installed',
          'not_installed',
          'not_installed',
          isEnabled,
          JSON.stringify(mergedRawData),
          lastSeen
        ]
      );
      logger.debug(`Inserted new asset: ${hostname}`);
    }
  }

  private normalizeADTimestamp(value: string | null | undefined): string | null {
    if (!value || value === 'Never') {
      return null;
    }

    const windowsDateMatch = value.match(/^\/Date\((\d+)\)\/$/);
    if (windowsDateMatch) {
      const epochMs = Number(windowsDateMatch[1]);
      if (!Number.isNaN(epochMs)) {
        return new Date(epochMs).toISOString();
      }
    }

    const parsedTime = Date.parse(value);
    if (!Number.isNaN(parsedTime)) {
      return new Date(parsedTime).toISOString();
    }

    logger.warn(`Unable to parse AD timestamp, keeping previous last_seen value: ${value}`);
    return null;
  }

  private buildBaseDN(): string {
    if (!this.domain) {
      return '';
    }

    return this.domain
      .split('.')
      .filter(Boolean)
      .map((part) => `DC=${part}`)
      .join(',');
  }

  private buildBindIdentity(): string {
    if (!this.username) {
      return '';
    }

    if (this.username.includes('@') || this.username.includes('\\')) {
      return this.username;
    }

    return this.domain ? `${this.username}@${this.domain}` : this.username;
  }

  private getADSyncLdapUrl(): string {
    const syncSpecificUrl = process.env.AD_SYNC_LDAP_URL || '';
    const configuredUrl = process.env.LDAP_URL || '';

    if (syncSpecificUrl) {
      return syncSpecificUrl;
    }

    if (this.dcIp && this.isLoopbackLdapUrl(configuredUrl)) {
      return `ldap://${this.dcIp}:389`;
    }

    return configuredUrl || (this.dcIp ? `ldap://${this.dcIp}:389` : '');
  }

  private isLoopbackLdapUrl(url: string): boolean {
    if (!url) {
      return false;
    }

    return /ldap:\/\/(localhost|127\.0\.0\.1)/i.test(url);
  }

  private async resolveAdIpIdentity(
    dnsHostName: string,
    hostname: string,
    explicitIp?: string | null
  ): Promise<{ primaryIp: string | null; allIps: string[] }> {
    const candidates = [dnsHostName, `${hostname}.${this.domain}`, hostname].filter(Boolean);
    const preferredSubnet = await this.getPreferredSubnet();
    const discovered = new Set<string>(this.normalizeIpList([], explicitIp || null));

    for (const candidate of candidates) {
      try {
        const results = await this.resolveAdServerIpv4Addresses(candidate);
        this.normalizeIpList(results).forEach((address) => discovered.add(address));
      } catch {
        continue;
      }
    }

    const allIps = Array.from(discovered);
    const preferredMatch = preferredSubnet ? allIps.find((address) => this.isIpInSubnet(address, preferredSubnet)) : null;
    const routedMatch = allIps.find((address) => this.isPreferredRoutableIp(address));

    return {
      primaryIp: preferredMatch || routedMatch || allIps[0] || null,
      allIps
    };
  }

  private async resolveAdServerIpv4Addresses(name: string): Promise<string[]> {
    if (process.platform === 'win32' && this.dcIp) {
      try {
        const escapedName = name.replace(/'/g, "''");
        const { stdout } = await execFileAsync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            `Resolve-DnsName -Name '${escapedName}' -Type A -Server ${this.dcIp} -ErrorAction Stop | Select-Object -ExpandProperty IPAddress`
          ],
          { timeout: 6000, maxBuffer: 256 * 1024 }
        );

        const records = this.normalizeIpList(
          stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        );

        if (records.length > 0) {
          return records;
        }
      } catch {
        // Fall back to system DNS when direct AD DNS lookup is unavailable.
      }
    }

    try {
      return this.normalizeIpList(await dns.resolve4(name));
    } catch {
      return [];
    }
  }

  private normalizeIpList(addresses: string[], extraAddress?: string | null): string[] {
    const allAddresses = [...addresses, ...(extraAddress ? [extraAddress] : [])];
    return Array.from(
      new Set(
        allAddresses
          .map((address) => address?.trim())
          .filter((address): address is string => Boolean(address) && /^\d+\.\d+\.\d+\.\d+$/.test(address))
      )
    );
  }

  private buildAssetRawData(existingRawData: any, computer: ADComputer, reportedIpAddresses: string[]) {
    const baseRawData = existingRawData && typeof existingRawData === 'object' ? existingRawData : {};

    return {
      ...baseRawData,
      ad: {
        ...(baseRawData.ad || {}),
        dns_host_name: computer.DNSHostName || null,
        reported_ip_address: computer.IPv4Address || null,
        reported_ip_addresses: reportedIpAddresses,
        last_synced_at: new Date().toISOString()
      }
    };
  }

  private async getPreferredSubnet(): Promise<PreferredSubnet | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    try {
      const { stdout } = await execFileAsync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          "$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 | Sort-Object RouteMetric, InterfaceMetric | Select-Object -First 1; " +
          "if ($route) { " +
          "$ip = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 | " +
          "Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' } | " +
          "Select-Object -First 1 IPAddress, PrefixLength; if ($ip) { $ip | ConvertTo-Json -Compress } }"
        ],
        { timeout: 6000, maxBuffer: 256 * 1024 }
      );

      const output = stdout.trim();
      if (!output) {
        return null;
      }

      const parsed = JSON.parse(output) as { IPAddress?: string; PrefixLength?: number };
      if (!parsed.IPAddress || typeof parsed.PrefixLength !== 'number') {
        return null;
      }

      return {
        network: this.toNetworkAddress(parsed.IPAddress, parsed.PrefixLength),
        prefixLength: parsed.PrefixLength
      };
    } catch {
      return null;
    }
  }

  private isPreferredRoutableIp(ipAddress: string): boolean {
    return !(
      ipAddress.startsWith('127.') ||
      ipAddress.startsWith('169.254.') ||
      ipAddress.startsWith('192.168.56.') ||
      ipAddress.startsWith('172.20.')
    );
  }

  private isIpInSubnet(ipAddress: string, subnet: PreferredSubnet): boolean {
    const ip = this.ipToInt(ipAddress);
    const network = this.ipToInt(subnet.network);
    const mask = subnet.prefixLength === 0 ? 0 : (0xffffffff << (32 - subnet.prefixLength)) >>> 0;
    return (ip & mask) === (network & mask);
  }

  private toNetworkAddress(ipAddress: string, prefixLength: number): string {
    const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
    const ip = this.ipToInt(ipAddress);
    const network = (ip & mask) >>> 0;
    return [
      (network >>> 24) & 255,
      (network >>> 16) & 255,
      (network >>> 8) & 255,
      network & 255
    ].join('.');
  }

  private ipToInt(ipAddress: string): number {
    return ipAddress
      .split('.')
      .map((part) => Number(part))
      .reduce((acc, octet) => ((acc << 8) + octet) >>> 0, 0);
  }

  private isAccountEnabled(userAccountControl: unknown): boolean {
    const rawValue = Array.isArray(userAccountControl) ? userAccountControl[0] : userAccountControl;
    const parsed = Number(rawValue);

    if (Number.isNaN(parsed)) {
      return true;
    }

    return (parsed & 0x2) === 0;
  }

  private fileTimeToISOString(value: unknown): string {
    const rawValue = Array.isArray(value) ? value[0] : value;

    if (!rawValue) {
      return '';
    }

    try {
      const fileTime = BigInt(String(rawValue));
      if (fileTime <= 0n) {
        return '';
      }

      const unixEpochMs = Number((fileTime - 116444736000000000n) / 10000n);
      if (Number.isNaN(unixEpochMs) || unixEpochMs <= 0) {
        return '';
      }

      return new Date(unixEpochMs).toISOString();
    } catch (error) {
      return '';
    }
  }

  private deriveComplianceStatus(
    isEnabled: boolean,
    ipAddress: string | null,
    lastSeen: string | null
  ): 'compliant' | 'partially_compliant' | 'non_compliant' | 'unknown' {
    if (!isEnabled) {
      return 'non_compliant';
    }

    if (!lastSeen) {
      return ipAddress ? 'unknown' : 'non_compliant';
    }

    const ageInDays = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24);

    if (!ipAddress) {
      return ageInDays <= 30 ? 'partially_compliant' : 'non_compliant';
    }

    if (ageInDays <= 30) {
      return 'compliant';
    }

    if (ageInDays <= 90) {
      return 'partially_compliant';
    }

    return 'non_compliant';
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
