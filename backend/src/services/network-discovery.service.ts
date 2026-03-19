import { execFile } from 'child_process';
import { promises as dns } from 'dns';
import os from 'os';
import { promisify } from 'util';
import pool from '../config/database';
import logger from '../utils/logger';

const execFileAsync = promisify(execFile);

interface AuthenticatedAsset {
  id: string;
  hostname: string;
  ip_address: string | null;
  mac_address: string | null;
  known_ip_addresses: string[];
  asset_type: string;
  criticality: string;
  department: string;
}

interface NetworkHost {
  ip_address: string;
  hostname: string | null;
  mac_address: string | null;
  vendor: string | null;
}

interface ObservedAssetUpdate {
  ip_address: string | null;
  mac_address: string | null;
}

interface ParsedCidr {
  network: string;
  prefixLength: number;
}

interface DetectedNetworkRange {
  cidr: string;
  interface_name: string;
  ip_address: string;
}

export interface NetworkDiscoveryResult {
  scan_range: string;
  scanner: 'nmap';
  nmap_available: boolean;
  scan_status: 'completed' | 'unavailable' | 'failed';
  scanned_at: string;
  authenticated_assets: Array<AuthenticatedAsset & { seen_on_network: boolean }>;
  unauthorized_assets: Array<NetworkHost & { reason: string }>;
  summary: {
    authenticated_total: number;
    authenticated_seen_on_network: number;
    unauthorized_total: number;
  };
  error?: string;
}

export class NetworkDiscoveryService {
  private readonly defaultNmapPaths = [
    'nmap',
    `${process.env.LOCALAPPDATA || 'C:\\Users\\haryp\\AppData\\Local'}\\Nmap\\nmap.exe`,
    'C:\\Program Files (x86)\\Nmap\\nmap.exe',
    'C:\\Program Files\\Nmap\\nmap.exe'
  ];

  async scanNetwork(): Promise<NetworkDiscoveryResult> {
    const scanRange = await this.getScanRange();
    const authenticatedAssets = await this.reconcileAuthenticatedAssets(await this.getAuthenticatedAssets(), scanRange);
    const scannedAt = new Date().toISOString();

    try {
      const hosts = await this.enrichDiscoveredHosts(await this.runNmapScan(scanRange));
      const comparison = await this.compareAgainstAuthenticatedAssets(authenticatedAssets, hosts);

      return {
        scan_range: scanRange,
        scanner: 'nmap',
        nmap_available: true,
        scan_status: 'completed',
        scanned_at: scannedAt,
        authenticated_assets: comparison.authenticatedAssets,
        unauthorized_assets: comparison.unauthorizedAssets,
        summary: {
          authenticated_total: comparison.authenticatedAssets.length,
          authenticated_seen_on_network: comparison.authenticatedAssets.filter((asset) => asset.seen_on_network).length,
          unauthorized_total: comparison.unauthorizedAssets.length
        }
      };
    } catch (error: any) {
      logger.warn(`Network discovery failed: ${error.message}`);

      return {
        scan_range: scanRange,
        scanner: 'nmap',
        nmap_available: !/nmap executable not found/i.test(error.message),
        scan_status: /nmap executable not found/i.test(error.message) ? 'unavailable' : 'failed',
        scanned_at: scannedAt,
        authenticated_assets: authenticatedAssets.map((asset) => ({
          ...asset,
          seen_on_network: false
        })),
        unauthorized_assets: [],
        summary: {
          authenticated_total: authenticatedAssets.length,
          authenticated_seen_on_network: 0,
          unauthorized_total: 0
        },
        error: error.message
      };
    }
  }

  private async getAuthenticatedAssets(): Promise<AuthenticatedAsset[]> {
    const result = await pool.query(
      `SELECT id, hostname, ip_address::text, mac_address::text, asset_type, criticality, department, raw_data
       FROM assets
       WHERE is_active = true
       ORDER BY hostname ASC`
    );

    return result.rows.map((row) => ({
      id: row.id,
      hostname: row.hostname,
      ip_address: row.ip_address,
      mac_address: row.mac_address,
      known_ip_addresses: this.extractKnownIpAddresses(row.ip_address, row.raw_data),
      asset_type: row.asset_type,
      criticality: row.criticality,
      department: row.department
    }));
  }

  private async reconcileAuthenticatedAssets(authenticatedAssets: AuthenticatedAsset[], scanRange: string): Promise<AuthenticatedAsset[]> {
    const parsedScanRange = this.parseCidr(scanRange);
    const assetUpdates = new Map<string, string>();

    const reconciledAssets = await Promise.all(
      authenticatedAssets.map(async (asset) => {
        const currentIp = asset.ip_address ? this.normalizeIpAddress(asset.ip_address) : null;
        if (currentIp && this.isIpInCidr(currentIp, parsedScanRange)) {
          return asset;
        }

        const knownIpInRange = asset.known_ip_addresses.find((ipAddress) => this.isIpInCidr(this.normalizeIpAddress(ipAddress), parsedScanRange));
        if (knownIpInRange) {
          assetUpdates.set(asset.id, this.normalizeIpAddress(knownIpInRange));
          return {
            ...asset,
            ip_address: this.normalizeIpAddress(knownIpInRange)
          };
        }

        if (asset.known_ip_addresses.length > 0 || currentIp) {
          return asset;
        }

        const resolvedIp = await this.resolveBestAssetIp(asset.hostname, parsedScanRange);
        if (!resolvedIp) {
          return asset;
        }

        assetUpdates.set(asset.id, resolvedIp);
        return {
          ...asset,
          ip_address: resolvedIp,
          known_ip_addresses: Array.from(new Set([...asset.known_ip_addresses, resolvedIp]))
        };
      })
    );

    await this.persistReconciledAssetIps(assetUpdates);
    return reconciledAssets;
  }

  private async getScanRange(): Promise<string> {
    const configuredRange = process.env.NETWORK_SCAN_RANGE || '';
    if (configuredRange) {
      return configuredRange;
    }

    const detectedRange = await this.detectConnectedNetworkRange();
    if (detectedRange) {
      logger.info(`Auto-detected scan range ${detectedRange.cidr} from ${detectedRange.interface_name} (${detectedRange.ip_address})`);
      return detectedRange.cidr;
    }

    const dcIp = process.env.AD_DC_IP || '';
    const match = dcIp.match(/^(\d+\.\d+\.\d+)\.\d+$/);
    if (match) {
      return `${match[1]}.0/24`;
    }

    throw new Error('Unable to determine a connected IPv4 network to scan. Set NETWORK_SCAN_RANGE to override detection.');
  }

  private async runNmapScan(scanRange: string): Promise<NetworkHost[]> {
    const nmapPath = await this.findNmapExecutable();
    logger.info(`Running nmap discovery on ${scanRange} using ${nmapPath}`);

    const { stdout, stderr } = await execFileAsync(
      nmapPath,
      ['-sn', '-oX', '-', scanRange],
      {
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024
      }
    );

    if (stderr && stderr.trim()) {
      logger.warn(`nmap stderr: ${stderr.trim()}`);
    }

    return this.parseNmapXml(stdout);
  }

  private async findNmapExecutable(): Promise<string> {
    const configuredPath = process.env.NMAP_PATH?.trim();
    const candidates = [...new Set([configuredPath, ...this.defaultNmapPaths].filter(Boolean) as string[])];

    for (const candidate of candidates) {
      try {
        await execFileAsync(candidate, ['--version'], { timeout: 5000, maxBuffer: 1024 * 1024 });
        return candidate;
      } catch (error: any) {
        if (candidate.toLowerCase() === 'nmap' && !['ENOENT', undefined].includes(error?.code)) {
          return candidate;
        }
      }
    }

    throw new Error('nmap executable not found. Install Nmap or set NMAP_PATH/adjust PATH on the server.');
  }

  private parseNmapXml(xml: string): NetworkHost[] {
    const hosts: NetworkHost[] = [];
    const hostBlocks = xml.match(/<host[\s\S]*?<\/host>/g) || [];

    for (const block of hostBlocks) {
      if (!/state="up"/.test(block)) {
        continue;
      }

      const ipv4Match = block.match(/<address addr="([^"]+)" addrtype="ipv4"/);
      if (!ipv4Match) {
        continue;
      }

      const hostnameMatch = block.match(/<hostname name="([^"]+)"/);
      const macMatch = block.match(/<address addr="([^"]+)" addrtype="mac"(?: vendor="([^"]+)")?/);

      hosts.push({
        ip_address: ipv4Match[1],
        hostname: hostnameMatch?.[1] || null,
        mac_address: macMatch?.[1] || null,
        vendor: macMatch?.[2] || null
      });
    }

    return hosts;
  }

  private async enrichDiscoveredHosts(discoveredHosts: NetworkHost[]): Promise<NetworkHost[]> {
    return Promise.all(
      discoveredHosts.map(async (host) => {
        if (host.hostname) {
          return {
            ...host,
            hostname: this.normalizeHostname(host.hostname)
          };
        }

        const resolvedHostname =
          (await this.reverseLookupHostname(host.ip_address)) ||
          (await this.pingLookupHostname(host.ip_address)) ||
          (await this.netbiosLookupHostname(host.ip_address));

        return {
          ...host,
          hostname: resolvedHostname ? this.normalizeHostname(resolvedHostname) : null
        };
      })
    );
  }

  private async compareAgainstAuthenticatedAssets(authenticatedAssets: AuthenticatedAsset[], discoveredHosts: NetworkHost[]) {
    const ipIndex = new Map<string, AuthenticatedAsset>();
    const macIndex = new Map<string, AuthenticatedAsset>();
    const hostnameIndex = new Map<string, AuthenticatedAsset>();
    const observedAssetUpdates = new Map<string, ObservedAssetUpdate>();

    authenticatedAssets.forEach((asset) => {
      asset.known_ip_addresses.forEach((ipAddress) => {
        ipIndex.set(this.normalizeIpAddress(ipAddress), asset);
      });

      if (asset.mac_address) {
        macIndex.set(this.normalizeMacAddress(asset.mac_address), asset);
      }

      const normalizedHostname = asset.hostname?.toLowerCase();
      if (normalizedHostname) {
        hostnameIndex.set(normalizedHostname, asset);
        hostnameIndex.set(this.normalizeHostname(normalizedHostname), asset);
      }
    });

    const seenAssetIds = new Set<string>();
    const unauthorizedAssets: Array<NetworkHost & { reason: string }> = [];

    for (const host of discoveredHosts) {
      const normalizedHostname = host.hostname?.split('.')[0]?.toLowerCase() || '';
      const normalizedMac = host.mac_address ? this.normalizeMacAddress(host.mac_address) : '';
      const matchedAsset =
        (normalizedMac ? macIndex.get(normalizedMac) : undefined) ||
        (normalizedHostname ? hostnameIndex.get(normalizedHostname) : undefined) ||
        ipIndex.get(this.normalizeIpAddress(host.ip_address));

      if (matchedAsset) {
        seenAssetIds.add(matchedAsset.id);
        observedAssetUpdates.set(matchedAsset.id, {
          ip_address: this.normalizeIpAddress(host.ip_address),
          mac_address: normalizedMac || matchedAsset.mac_address
        });

        continue;
      }

      unauthorizedAssets.push({
        ...host,
        reason: 'Present on network scan but not found in authenticated AD asset inventory'
      });
    }

    const authenticatedWithPresence = authenticatedAssets.map((asset) => ({
      ...asset,
      ip_address: observedAssetUpdates.get(asset.id)?.ip_address || asset.ip_address,
      mac_address: observedAssetUpdates.get(asset.id)?.mac_address || asset.mac_address,
      seen_on_network: seenAssetIds.has(asset.id)
    }));

    await this.persistObservedAssetUpdates(observedAssetUpdates);

    return {
      authenticatedAssets: authenticatedWithPresence,
      unauthorizedAssets
    };
  }

  private normalizeIpAddress(ipAddress: string): string {
    return ipAddress.split('/')[0].trim();
  }

  private normalizeHostname(hostname: string): string {
    return hostname.split('.')[0].trim().toLowerCase();
  }

  private normalizeMacAddress(macAddress: string): string {
    return macAddress.replace(/-/g, ':').trim().toUpperCase();
  }

  private extractKnownIpAddresses(primaryIpAddress: string | null, rawData: any): string[] {
    const normalizedPrimary = primaryIpAddress ? this.normalizeIpAddress(primaryIpAddress) : null;
    const adReportedIps = Array.isArray(rawData?.ad?.reported_ip_addresses)
      ? rawData.ad.reported_ip_addresses
      : [];
    const adPrimary = typeof rawData?.ad?.reported_ip_address === 'string' ? rawData.ad.reported_ip_address : null;

    return Array.from(
      new Set(
        [normalizedPrimary, adPrimary, ...adReportedIps]
          .filter((value): value is string => Boolean(value))
          .map((value) => this.normalizeIpAddress(value))
      )
    );
  }

  private async persistObservedAssetUpdates(observedAssetUpdates: Map<string, ObservedAssetUpdate>): Promise<void> {
    for (const [assetId, update] of observedAssetUpdates.entries()) {
      try {
        await pool.query(
          `UPDATE assets
           SET ip_address = COALESCE($1::inet, ip_address),
               mac_address = COALESCE($2::macaddr, mac_address),
               last_seen = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [update.ip_address, update.mac_address, assetId]
        );
      } catch (error: any) {
        logger.warn(`Failed to store observed asset identity for ${assetId}: ${error.message}`);
      }
    }
  }

  private async reverseLookupHostname(ipAddress: string): Promise<string | null> {
    try {
      const results = await dns.reverse(ipAddress);
      return results[0] || null;
    } catch {
      return null;
    }
  }

  private async netbiosLookupHostname(ipAddress: string): Promise<string | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    try {
      const { stdout } = await execFileAsync(
        'nbtstat',
        ['-A', ipAddress],
        { timeout: 4000, maxBuffer: 256 * 1024 }
      );

      const match =
        stdout.match(/^\s*([A-Z0-9\-_.$]+)\s+<20>\s+UNIQUE\s+Registered/m) ||
        stdout.match(/^\s*([A-Z0-9\-_.$]+)\s+<00>\s+UNIQUE\s+Registered/m);
      return match?.[1] || null;
    } catch {
      return null;
    }
  }

  private async pingLookupHostname(ipAddress: string): Promise<string | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    try {
      const { stdout } = await execFileAsync(
        'ping',
        ['-a', '-n', '1', '-w', '1200', ipAddress],
        { timeout: 4000, maxBuffer: 256 * 1024 }
      );

      const match = stdout.match(/Pinging\s+([^\s[]+)\s+\[/i);
      if (!match?.[1]) {
        return null;
      }

      const candidate = match[1].trim();
      return /^\d+\.\d+\.\d+\.\d+$/.test(candidate) ? null : candidate;
    } catch {
      return null;
    }
  }

  private async resolveBestAssetIp(hostname: string, targetRange: ParsedCidr): Promise<string | null> {
    const candidates = await this.resolveCandidateIps(hostname);
    const inRange = candidates.find((candidate) => this.isIpInCidr(candidate, targetRange));
    return inRange || null;
  }

  private async resolveCandidateIps(hostname: string): Promise<string[]> {
    const names = [hostname, `${hostname}.${process.env.AD_DOMAIN || ''}`]
      .map((value) => value.trim())
      .filter(Boolean);

    const discovered = new Set<string>();

    for (const name of names) {
      try {
        const records = await dns.resolve4(name);
        records.filter((record) => this.isScannableIpv4(record)).forEach((record) => discovered.add(record));
      } catch {
        continue;
      }
    }

    if (discovered.size > 0) {
      return Array.from(discovered);
    }

    if (process.platform !== 'win32') {
      return [];
    }

    for (const name of names) {
      try {
        const { stdout } = await execFileAsync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            `Resolve-DnsName -Name '${name}' -Type A -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IPAddress`
          ],
          { timeout: 5000, maxBuffer: 256 * 1024 }
        );

        stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && this.isScannableIpv4(line))
          .forEach((line) => discovered.add(line));
      } catch {
        continue;
      }
    }

    return Array.from(discovered);
  }

  private async persistReconciledAssetIps(assetUpdates: Map<string, string>): Promise<void> {
    for (const [assetId, ipAddress] of assetUpdates.entries()) {
      try {
        await pool.query(
          `UPDATE assets
           SET ip_address = $1::inet,
               updated_at = NOW()
           WHERE id = $2`,
          [ipAddress, assetId]
        );
      } catch (error: any) {
        logger.warn(`Failed to persist reconciled IP for asset ${assetId}: ${error.message}`);
      }
    }
  }

  private parseCidr(cidr: string): ParsedCidr {
    const [network, prefix] = cidr.split('/');
    return {
      network,
      prefixLength: Number(prefix)
    };
  }

  private isIpInCidr(ipAddress: string, cidr: ParsedCidr): boolean {
    const ip = this.ipToInt(ipAddress);
    const network = this.ipToInt(cidr.network);
    const mask = cidr.prefixLength === 0 ? 0 : (0xffffffff << (32 - cidr.prefixLength)) >>> 0;

    return (ip & mask) === (network & mask);
  }

  private ipToInt(ipAddress: string): number {
    return ipAddress
      .split('.')
      .map((part) => Number(part))
      .reduce((acc, octet) => ((acc << 8) + octet) >>> 0, 0);
  }

  private async detectConnectedNetworkRange(): Promise<DetectedNetworkRange | null> {
    const fromDefaultRoute = await this.detectNetworkRangeFromDefaultRoute();
    if (fromDefaultRoute) {
      return fromDefaultRoute;
    }

    return this.detectNetworkRangeFromInterfaces();
  }

  private async detectNetworkRangeFromDefaultRoute(): Promise<DetectedNetworkRange | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    const script =
      "$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 " +
      "| Sort-Object RouteMetric, InterfaceMetric " +
      "| Select-Object -First 1; " +
      "if ($route) { " +
      "$ip = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 " +
      "| Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' } " +
      "| Select-Object -First 1 IPAddress, PrefixLength, InterfaceAlias; " +
      "if ($ip) { $ip | ConvertTo-Json -Compress } }";

    try {
      const { stdout } = await execFileAsync(
        powershellPath,
        ['-NoProfile', '-Command', script],
        { timeout: 10000, maxBuffer: 1024 * 1024 }
      );

      const output = stdout.trim();
      if (!output) {
        return null;
      }

      const parsed = JSON.parse(output) as { IPAddress?: string; PrefixLength?: number; InterfaceAlias?: string };
      if (!parsed.IPAddress || typeof parsed.PrefixLength !== 'number') {
        return null;
      }

      return {
        cidr: this.toCidr(parsed.IPAddress, parsed.PrefixLength),
        interface_name: parsed.InterfaceAlias || 'default-route',
        ip_address: parsed.IPAddress
      };
    } catch (error: any) {
      logger.warn(`Default-route network detection failed: ${error.message}`);
      return null;
    }
  }

  private detectNetworkRangeFromInterfaces(): DetectedNetworkRange | null {
    const interfaces = os.networkInterfaces();
    const candidates: Array<DetectedNetworkRange & { score: number }> = [];

    Object.entries(interfaces).forEach(([interfaceName, addresses]) => {
      (addresses || []).forEach((address) => {
        if (address.family !== 'IPv4' || address.internal) {
          return;
        }

        if (!this.isScannableIpv4(address.address) || !address.netmask) {
          return;
        }

        const prefixLength = this.netmaskToPrefixLength(address.netmask);
        let score = 0;

        if (this.isPrivateIpv4(address.address)) score += 100;
        if (!/virtual|vmware|vbox|virtualbox|hyper-v|docker|loopback/i.test(interfaceName)) score += 50;
        if (!address.cidr?.endsWith('/32')) score += 10;

        candidates.push({
          cidr: this.toCidr(address.address, prefixLength),
          interface_name: interfaceName,
          ip_address: address.address,
          score
        });
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    if (!best) {
      return null;
    }

    return {
      cidr: best.cidr,
      interface_name: best.interface_name,
      ip_address: best.ip_address
    };
  }

  private toCidr(ipAddress: string, prefixLength: number): string {
    const ipOctets = ipAddress.split('.').map((part) => Number(part));
    const maskOctets = this.prefixLengthToMask(prefixLength);
    const networkOctets = ipOctets.map((octet, index) => octet & maskOctets[index]);

    return `${networkOctets.join('.')}/${prefixLength}`;
  }

  private prefixLengthToMask(prefixLength: number): number[] {
    const octets: number[] = [];
    let remainingBits = prefixLength;

    for (let i = 0; i < 4; i += 1) {
      const bits = Math.max(0, Math.min(8, remainingBits));
      octets.push(bits === 0 ? 0 : (0xff << (8 - bits)) & 0xff);
      remainingBits -= bits;
    }

    return octets;
  }

  private netmaskToPrefixLength(netmask: string): number {
    return netmask
      .split('.')
      .map((part) => Number(part).toString(2))
      .map((binary) => binary.padStart(8, '0'))
      .join('')
      .split('')
      .filter((bit) => bit === '1').length;
  }

  private isScannableIpv4(ipAddress: string): boolean {
    return ipAddress !== '127.0.0.1' && !ipAddress.startsWith('169.254.');
  }

  private isPrivateIpv4(ipAddress: string): boolean {
    return (
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipAddress)
    );
  }
}

export const networkDiscoveryService = new NetworkDiscoveryService();
