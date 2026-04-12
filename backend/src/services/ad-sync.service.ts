import pool from '../config/database';
import logger from '../utils/logger';
import ldap from 'ldapjs';
import dotenv from 'dotenv';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as dns } from 'dns';
import net from 'net';
import { assetBusinessLogicService } from './asset-business-logic.service';

dotenv.config();

const execFileAsync = promisify(execFile);

interface ADComputer {
  Name: string;
  DNSHostName: string;
  IPv4Address: string | null;
  ReportedIPAddresses: string[];
  OperatingSystem: string;
  DistinguishedName: string;
  Enabled: boolean;
  LastLogonDate: string;
  LastLogonTimestamp?: string | null;
  LastLogon?: string | null;
  WhenChanged?: string | null;
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

  constructor() {
    this.dcIp = process.env.AD_DC_IP || '';
    this.domain = process.env.AD_DOMAIN || '';
    this.username = process.env.AD_USERNAME || '';
    this.password = process.env.AD_PASSWORD || '';
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
      await assetBusinessLogicService.recalculateAssets();

      logger.info(`AD Sync complete. Imported ${assetsImported} assets`);
      return { success: true, assetsImported, errors };

    } catch (error: any) {
      logger.error('AD Sync failed:', error);
      errors.push(error.message);
      return { success: false, assetsImported: 0, errors };
    }
  }

  private async getComputersFromAD(): Promise<ADComputer[]> {
    return this.getComputersFromADViaLDAP();
  }

  private async getComputersFromADViaLDAP(): Promise<ADComputer[]> {
    const bindDN = process.env.LDAP_BIND_DN || this.buildBindIdentity();
    const bindPassword = process.env.LDAP_BIND_PASSWORD || this.password;
    const baseDN = process.env.LDAP_BASE_DN || this.buildBaseDN();
    const ldapUrls = this.getADSyncLdapUrls();

    if (ldapUrls.length === 0 || !bindDN || !bindPassword || !baseDN) {
      throw new Error('Direct LDAP sync requires LDAP_URL, bind credentials, and base DN.');
    }

    let lastError: Error | null = null;

    for (const ldapUrl of ldapUrls) {
      const reachable = await this.canReachLdapEndpoint(ldapUrl);
      if (!reachable) {
        lastError = new Error(`Cannot reach Active Directory LDAP endpoint: ${ldapUrl}`);
        logger.warn(lastError.message);
        continue;
      }

      logger.info(`Querying Active Directory over LDAP: ${ldapUrl}`);

      const client = ldap.createClient({
        url: ldapUrl,
        timeout: 15000,
        connectTimeout: 15000,
        tlsOptions: { rejectUnauthorized: false }
      });
      client.on('error', (err) => {
        logger.warn(`LDAP client error during AD sync via ${ldapUrl}: ${err.message}`);
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
              filter: '(&(objectCategory=computer)(objectClass=computer))',
                scope: 'sub',
                paged: true,
                attributes: [
                  'cn',
                  'dNSHostName',
                  'operatingSystem',
                  'distinguishedName',
                  'lastLogon',
                  'lastLogonTimestamp',
                  'whenChanged',
                  'userAccountControl'
                ]
              },
            (err, res) => {
              if (err) {
                reject(err);
                return;
              }

              res.on('searchEntry', (entry) => {
                rows.push(this.normalizeLdapEntry(entry as any));
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

        const computers: ADComputer[] = [];
        for (const row of rows.filter((entry) => entry?.cn)) {
          const hostname = this.getLdapAttribute(row, 'cn') || this.getLdapAttribute(row, 'name');
          if (!hostname || !this.isComputerAccountRow(row)) {
            continue;
          }

          const dnsHostName =
            this.getLdapAttribute(row, 'dnshostname') ||
            this.getLdapAttribute(row, 'dnshostname'.toLowerCase()) ||
            `${hostname}.${this.domain}`;
          const adDnsIdentity = await this.resolveAdIpIdentityWithTimeout(dnsHostName, hostname, 1500);
          const lastLogonTimestamp = this.fileTimeToISOString(this.getLdapAttribute(row, 'lastlogontimestamp'));
          const lastLogon = this.fileTimeToISOString(this.getLdapAttribute(row, 'lastlogon'));
          const whenChanged = this.generalizedTimeToISOString(this.getLdapAttribute(row, 'whenchanged'));

          computers.push({
            Name: hostname,
            DNSHostName: dnsHostName,
            IPv4Address: adDnsIdentity.primaryIp,
            ReportedIPAddresses: adDnsIdentity.allIps,
            OperatingSystem: this.getLdapAttribute(row, 'operatingsystem') || 'Unknown',
            DistinguishedName:
              this.getLdapAttribute(row, 'distinguishedname') || `CN=${hostname},CN=Computers,${baseDN}`,
            Enabled: this.isAccountEnabled(this.getLdapAttribute(row, 'useraccountcontrol')),
            LastLogonTimestamp: lastLogonTimestamp || null,
            LastLogon: lastLogon || null,
            WhenChanged: whenChanged || null,
            LastLogonDate: lastLogonTimestamp || lastLogon || whenChanged || ''
          });
        }

        logger.info(`Direct LDAP query found ${computers.length} computers`);
        return computers;
      } catch (error: any) {
        lastError = error;
        logger.warn(`LDAP sync attempt failed via ${ldapUrl}: ${error.message}`);
      } finally {
        await unbindAsync();
      }
    }

    throw lastError || new Error('All LDAP sync attempts failed.');
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

    const assetType = /server/i.test(osVersion) ? 'server' : 'workstation';

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
         SET ip_address = COALESCE($1::inet, ip_address),
             os_version = $2,
             asset_type = $3,
             last_seen = COALESCE($4::timestamp, last_seen),
             is_active = $5,
             raw_data = $6::jsonb,
             updated_at = NOW()
         WHERE hostname = $7`,
        [ipAddress, osVersion, assetType, lastSeen, isEnabled, JSON.stringify(mergedRawData), hostname]
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
          'medium',
          osVersion,
          'AD Imported',
          'unknown',
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

  private getADSyncLdapUrls(): string[] {
    const syncSpecificUrl = process.env.AD_SYNC_LDAP_URL || '';
    const configuredUrl = process.env.LDAP_URL || '';
    const directDcUrl = this.dcIp ? `ldap://${this.dcIp}:389` : '';
    const candidates = [syncSpecificUrl, configuredUrl, directDcUrl].filter(Boolean);
    const ordered = candidates.sort((left, right) => {
      const leftLoopback = this.isLoopbackLdapUrl(left);
      const rightLoopback = this.isLoopbackLdapUrl(right);
      if (leftLoopback === rightLoopback) {
        return 0;
      }
      return leftLoopback ? 1 : -1;
    });

    return Array.from(new Set(ordered));
  }

  private async canReachLdapEndpoint(ldapUrl: string): Promise<boolean> {
    try {
      const parsed = new URL(ldapUrl);
      const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'ldaps:' ? 636 : 389;

      return await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        const finish = (result: boolean) => {
          if (settled) {
            return;
          }
          settled = true;
          socket.destroy();
          resolve(result);
        };

        socket.setTimeout(3000);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        socket.connect(port, parsed.hostname);
      });
    } catch {
      return false;
    }
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
    const candidates = Array.from(new Set([dnsHostName, `${hostname}.${this.domain}`, hostname].filter(Boolean)));
    const preferredSubnet = await this.getPreferredSubnet();
    const discovered = new Set<string>(this.normalizeIpList([], explicitIp || null));

    for (const candidate of candidates) {
      if (discovered.size > 0) {
        break;
      }

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

  private async resolveAdIpIdentityWithTimeout(
    dnsHostName: string,
    hostname: string,
    timeoutMs: number,
    explicitIp?: string | null
  ): Promise<{ primaryIp: string | null; allIps: string[] }> {
    try {
      return await Promise.race([
        this.resolveAdIpIdentity(dnsHostName, hostname, explicitIp),
        new Promise<{ primaryIp: string | null; allIps: string[] }>((resolve) =>
          setTimeout(() => resolve({ primaryIp: explicitIp || null, allIps: this.normalizeIpList([], explicitIp || null) }), timeoutMs)
        )
      ]);
    } catch {
      return { primaryIp: explicitIp || null, allIps: this.normalizeIpList([], explicitIp || null) };
    }
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
            { timeout: 2000, maxBuffer: 256 * 1024 }
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
      return this.normalizeIpList(
        await Promise.race([
          dns.resolve4(name),
          new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('dns timeout')), 1500))
        ])
      );
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

  private normalizeLdapEntry(entry: any): Record<string, any> {
    const normalized: Record<string, any> = {};
    const attributes = Array.isArray(entry?.attributes)
      ? entry.attributes
      : Array.isArray(entry?.pojo?.attributes)
        ? entry.pojo.attributes
        : [];

    for (const attribute of attributes) {
      const key = String(attribute?.type || attribute?.name || '').toLowerCase();
      if (!key) {
        continue;
      }

      const rawValues = Array.isArray(attribute?.values)
        ? attribute.values
        : Array.isArray(attribute?.vals)
          ? attribute.vals
          : attribute?.value !== undefined
            ? [attribute.value]
            : [];

      const values = rawValues
        .map((value: unknown) => String(value))
        .filter((value: string) => value.length > 0);

      normalized[key] = values.length <= 1 ? values[0] || '' : values;
    }

    if (entry?.objectName) {
      normalized.distinguishedname = String(entry.objectName);
    } else if (entry?.pojo?.objectName) {
      normalized.distinguishedname = String(entry.pojo.objectName);
    }

    return normalized;
  }

  private getLdapAttribute(row: Record<string, any>, key: string): string {
    const value = row[key.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0] ? String(value[0]) : '';
    }

    return value ? String(value) : '';
  }

  private buildAssetRawData(existingRawData: any, computer: ADComputer, reportedIpAddresses: string[]) {
      const baseRawData = existingRawData && typeof existingRawData === 'object' ? existingRawData : {};
      const existingAd = baseRawData.ad || {};
      const existingIpEvidence = baseRawData.ip_evidence || {};
      const adPrimaryIp = computer.IPv4Address || reportedIpAddresses[0] || null;

      return {
        ...baseRawData,
        ad: {
        ...existingAd,
        dns_host_name: computer.DNSHostName || null,
        distinguished_name: computer.DistinguishedName || null,
        operating_system: computer.OperatingSystem || null,
        enabled: computer.Enabled,
        last_logon_timestamp: computer.LastLogonTimestamp || existingAd.last_logon_timestamp || null,
        last_logon: computer.LastLogon || existingAd.last_logon || null,
        last_logon_date: computer.LastLogonDate || existingAd.last_logon_date || null,
        when_changed: computer.WhenChanged || existingAd.when_changed || null,
          reported_ip_address: computer.IPv4Address || null,
          reported_ip_addresses: reportedIpAddresses,
          last_synced_at: new Date().toISOString()
        },
        ip_evidence: adPrimaryIp
          ? {
              ...existingIpEvidence,
              ip_address: adPrimaryIp,
              source: 'ad_dns',
              last_seen_at: new Date().toISOString(),
            }
          : existingIpEvidence
      };
    }

  private isComputerAccountRow(row: Record<string, any>): boolean {
    const distinguishedName = this.getLdapAttribute(row, 'distinguishedname').toLowerCase();
    if (distinguishedName.includes('cn=topology,') || distinguishedName.includes('cn=dfsr-globalsettings,')) {
      return false;
    }

    return Boolean(
      this.getLdapAttribute(row, 'useraccountcontrol') ||
      this.getLdapAttribute(row, 'dnshostname') ||
      this.getLdapAttribute(row, 'operatingsystem')
    );
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

  private generalizedTimeToISOString(value: unknown): string {
    const rawValue = Array.isArray(value) ? value[0] : value;

    if (!rawValue) {
      return '';
    }

    const parsedTime = Date.parse(String(rawValue));
    if (Number.isNaN(parsedTime)) {
      return '';
    }

    return new Date(parsedTime).toISOString();
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
