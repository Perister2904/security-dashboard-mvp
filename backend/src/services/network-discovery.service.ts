import { execFile } from 'child_process';
import { promises as dns } from 'dns';
import net from 'net';
import os from 'os';
import { promisify } from 'util';
import pool from '../config/database';
import logger from '../utils/logger';
import { assetBusinessLogicService } from './asset-business-logic.service';

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
  last_seen: string | null;
  raw_data: any;
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

type MatchField = 'hostname' | 'ip' | 'mac';
type MatchStrength = 'strong' | 'medium' | 'weak';

interface AssetCorrelationMatch {
  asset: AuthenticatedAsset;
  host: NetworkHost;
  match_fields: MatchField[];
  match_score: number;
  match_strength: MatchStrength;
  match_reason: string;
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

const AUTHENTICATED_ASSET_PROBE_PORTS = [53, 88, 135, 139, 389, 445, 3389, 5985];

export interface NetworkDiscoveryResult {
  scan_range: string;
  scanner: 'nmap';
  nmap_available: boolean;
  scan_status: 'completed' | 'unavailable' | 'failed';
  scanned_at: string;
  authenticated_assets: Array<AuthenticatedAsset & {
    seen_on_network: boolean;
    match_fields: MatchField[];
    match_score: number;
    match_strength: MatchStrength | null;
    match_reason: string | null;
  }>;
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
    'C:\\Program Files (x86)\\Nmap\\nmap.exe',
    'C:\\Program Files\\Nmap\\nmap.exe'
  ];

  async scanNetwork(): Promise<NetworkDiscoveryResult> {
    const scanRange = await this.getScanRange();
    const authenticatedAssets = await this.reconcileAuthenticatedAssets(await this.getAuthenticatedAssets(), scanRange);
    const scannedAt = new Date().toISOString();

    try {
      const nmapHosts = await this.enrichDiscoveredHosts(await this.runNmapScan(scanRange));
      const reachableAuthenticatedHosts = await this.findReachableAuthenticatedAssets(authenticatedAssets, nmapHosts);
      const hosts = this.mergeDiscoveredHosts(nmapHosts, reachableAuthenticatedHosts);
      const comparison = await this.compareAgainstAuthenticatedAssets(authenticatedAssets, hosts, scannedAt);

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
          seen_on_network: false,
          match_fields: [],
          match_score: 0,
          match_strength: null,
          match_reason: null
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
      `SELECT id, hostname, ip_address::text, mac_address::text, asset_type, criticality, department, raw_data, last_seen::text
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
      department: row.department,
      last_seen: row.last_seen,
      raw_data: row.raw_data
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
      ['-n', '-sn', '-PE', '-PS53,88,135,139,389,445,3389,5985', '-PA53,88,135,139,389,445,3389,5985', '-oX', '-', scanRange],
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

  private async findReachableAuthenticatedAssets(
    authenticatedAssets: AuthenticatedAsset[],
    discoveredHosts: NetworkHost[]
  ): Promise<NetworkHost[]> {
    const discoveredIps = new Set(discoveredHosts.map((host) => this.normalizeIpAddress(host.ip_address)));
    const reachableHosts: Array<NetworkHost | null> = await Promise.all(
      authenticatedAssets.map(async (asset) => {
        const assetIp = asset.ip_address ? this.normalizeIpAddress(asset.ip_address) : '';
        if (!assetIp || discoveredIps.has(assetIp)) {
          return null;
        }

        const reachable = await this.isAssetReachable(assetIp);
        if (!reachable) {
          return null;
        }

        const reachableHost: NetworkHost = {
          ip_address: assetIp,
          hostname: this.normalizeHostname(asset.hostname),
          mac_address: asset.mac_address || null,
          vendor: null
        };

        return reachableHost;
      })
    );

    return reachableHosts.filter((host): host is NetworkHost => host !== null);
  }

  private mergeDiscoveredHosts(primaryHosts: NetworkHost[], fallbackHosts: NetworkHost[]): NetworkHost[] {
    const merged = new Map<string, NetworkHost>();

    for (const host of [...primaryHosts, ...fallbackHosts]) {
      const key = this.normalizeIpAddress(host.ip_address);
      if (!merged.has(key)) {
        merged.set(key, host);
        continue;
      }

      const current = merged.get(key)!;
      merged.set(key, {
        ip_address: current.ip_address,
        hostname: current.hostname || host.hostname,
        mac_address: current.mac_address || host.mac_address,
        vendor: current.vendor || host.vendor
      });
    }

    return Array.from(merged.values());
  }

  private async isAssetReachable(ipAddress: string): Promise<boolean> {
    if (await this.canPingHost(ipAddress)) {
      return true;
    }

    for (const port of AUTHENTICATED_ASSET_PROBE_PORTS) {
      if (await this.canConnectTcp(ipAddress, port, 1500)) {
        return true;
      }
    }

    return false;
  }

  private async canPingHost(ipAddress: string): Promise<boolean> {
    const command = process.platform === 'win32' ? 'ping' : 'ping';
    const args = process.platform === 'win32'
      ? ['-n', '1', '-w', '1200', ipAddress]
      : ['-c', '1', '-W', '1', ipAddress];

    try {
      await execFileAsync(
        command,
        args,
        { timeout: 3000, maxBuffer: 128 * 1024 }
      );
      return true;
    } catch {
      return false;
    }
  }

  private async canConnectTcp(ipAddress: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
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

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(port, ipAddress);
    });
  }

  private async compareAgainstAuthenticatedAssets(
    authenticatedAssets: AuthenticatedAsset[],
    discoveredHosts: NetworkHost[],
    scannedAt: string
  ) {
    const observedAssetUpdates = new Map<string, ObservedAssetUpdate>();
    const hostCandidates = discoveredHosts
      .map((host) => ({
        host,
        matches: authenticatedAssets
          .map((asset) => this.evaluateAssetCorrelation(asset, host))
          .filter((match): match is AssetCorrelationMatch => match !== null)
          .sort((left, right) => this.compareCorrelationMatches(left, right))
      }))
      .sort((left, right) => {
        const leftTop = left.matches[0];
        const rightTop = right.matches[0];

        if (!leftTop && !rightTop) return 0;
        if (!leftTop) return 1;
        if (!rightTop) return -1;

        return this.compareCorrelationMatches(leftTop, rightTop);
      });

    const assignedMatches = new Map<string, AssetCorrelationMatch>();
    const seenAssetIds = new Set<string>();
    const unauthorizedAssets: Array<NetworkHost & { reason: string }> = [];

    for (const { host, matches } of hostCandidates) {
      const matchedCorrelation = matches.find(
        (match) => match.match_strength === 'strong' && !assignedMatches.has(match.asset.id)
      );

      if (matchedCorrelation) {
        const normalizedMac = host.mac_address ? this.normalizeMacAddress(host.mac_address) : '';
        assignedMatches.set(matchedCorrelation.asset.id, matchedCorrelation);
        seenAssetIds.add(matchedCorrelation.asset.id);
        observedAssetUpdates.set(matchedCorrelation.asset.id, {
          ip_address: this.normalizeIpAddress(host.ip_address),
          mac_address: normalizedMac || matchedCorrelation.asset.mac_address
        });

        continue;
      }

      unauthorizedAssets.push({
        ...host,
        reason: this.buildUnauthorizedReason(matches[0] || null)
      });
    }

    const authenticatedWithPresence = authenticatedAssets.map((asset) => ({
      ...asset,
      ip_address: observedAssetUpdates.get(asset.id)?.ip_address || asset.ip_address,
      mac_address: observedAssetUpdates.get(asset.id)?.mac_address || asset.mac_address,
      seen_on_network: seenAssetIds.has(asset.id),
      match_fields: assignedMatches.get(asset.id)?.match_fields || [],
      match_score: assignedMatches.get(asset.id)?.match_score || 0,
      match_strength: assignedMatches.get(asset.id)?.match_strength || null,
      match_reason: assignedMatches.get(asset.id)?.match_reason || null
    }));

    await this.persistObservedAssetUpdates(observedAssetUpdates, scannedAt);

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
    const wazuhIp = typeof rawData?.wazuh?.agent?.ip === 'string' ? rawData.wazuh.agent.ip : null;
    const networkObservedIp = typeof rawData?.network?.observed_ip_address === 'string'
      ? rawData.network.observed_ip_address
      : null;
    const ipEvidenceIp = typeof rawData?.ip_evidence?.ip_address === 'string' ? rawData.ip_evidence.ip_address : null;

    return Array.from(
      new Set(
        [normalizedPrimary, adPrimary, wazuhIp, networkObservedIp, ipEvidenceIp, ...adReportedIps]
          .filter((value): value is string => Boolean(value))
          .map((value) => this.normalizeIpAddress(value))
      )
    );
  }

  private evaluateAssetCorrelation(asset: AuthenticatedAsset, host: NetworkHost): AssetCorrelationMatch | null {
    const matchFields: MatchField[] = [];
    const normalizedHostIp = this.normalizeIpAddress(host.ip_address);
    const normalizedHostMac = host.mac_address ? this.normalizeMacAddress(host.mac_address) : null;
    const normalizedHostHostname = host.hostname ? this.normalizeHostname(host.hostname) : null;
    const knownHostnames = this.getKnownHostnames(asset);
    const knownMacAddresses = this.getKnownMacAddresses(asset);

    if (normalizedHostHostname && knownHostnames.has(normalizedHostHostname)) {
      matchFields.push('hostname');
    }

    if (asset.known_ip_addresses.some((ipAddress) => this.normalizeIpAddress(ipAddress) === normalizedHostIp)) {
      matchFields.push('ip');
    }

    if (normalizedHostMac && knownMacAddresses.has(normalizedHostMac)) {
      matchFields.push('mac');
    }

    if (matchFields.length === 0) {
      return null;
    }

    const recencyBonus = this.getRecencyBonus(asset);
    const matchScore = matchFields.length + recencyBonus;
    const matchStrength = this.deriveMatchStrength(matchFields, recencyBonus);

    return {
      asset,
      host,
      match_fields: matchFields,
      match_score: matchScore,
      match_strength: matchStrength,
      match_reason: this.buildMatchReason(matchFields, matchStrength, recencyBonus)
    };
  }

  private compareCorrelationMatches(left: AssetCorrelationMatch, right: AssetCorrelationMatch): number {
    const strengthRank: Record<MatchStrength, number> = {
      strong: 3,
      medium: 2,
      weak: 1
    };

    if (strengthRank[left.match_strength] !== strengthRank[right.match_strength]) {
      return strengthRank[right.match_strength] - strengthRank[left.match_strength];
    }

    if (left.match_score !== right.match_score) {
      return right.match_score - left.match_score;
    }

    return right.match_fields.length - left.match_fields.length;
  }

  private getKnownHostnames(asset: AuthenticatedAsset): Set<string> {
    const candidates = [
      asset.hostname,
      asset.raw_data?.ad?.dns_host_name,
      asset.raw_data?.wazuh?.agent?.name
    ];

    return new Set(
      candidates
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => this.normalizeHostname(value))
    );
  }

  private getKnownMacAddresses(asset: AuthenticatedAsset): Set<string> {
    const candidates = [
      asset.mac_address,
      asset.raw_data?.network?.observed_mac_address
    ];

    return new Set(
      candidates
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => this.normalizeMacAddress(value))
    );
  }

  private getRecencyBonus(asset: AuthenticatedAsset): number {
    const latestSeen = assetBusinessLogicService.getObservationTimestamps(asset as any).lastObservedAt;
    if (!latestSeen) {
      return 0;
    }

    const ageInDays = (Date.now() - new Date(latestSeen).getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays <= 30 ? 1 : 0;
  }

  private deriveMatchStrength(matchFields: MatchField[], recencyBonus: number): MatchStrength {
    if (matchFields.length >= 3) {
      return 'strong';
    }

    if (matchFields.length >= 2 && recencyBonus > 0) {
      return 'strong';
    }

    if (matchFields.length >= 2) {
      return 'medium';
    }

    return 'weak';
  }

  private buildMatchReason(matchFields: MatchField[], matchStrength: MatchStrength, recencyBonus: number): string {
    const fieldsText = matchFields.join(' + ');
    const recencyText = recencyBonus > 0 ? ' with recent corroborating evidence' : '';

    if (matchStrength === 'strong') {
      return `Strong correlation via ${fieldsText}${recencyText}.`;
    }

    if (matchStrength === 'medium') {
      return `Two signals matched via ${fieldsText}, but supporting evidence is not recent enough to trust automatically.`;
    }

    return `Only one corroborating field matched via ${fieldsText}.`;
  }

  private buildUnauthorizedReason(bestMatch: AssetCorrelationMatch | null): string {
    if (!bestMatch) {
      return 'Present on network scan but no corroborating AD asset evidence was found.';
    }

    return `${bestMatch.match_reason} Unauthorized until a strong multi-signal match is established.`;
  }

  private async persistObservedAssetUpdates(
    observedAssetUpdates: Map<string, ObservedAssetUpdate>,
    observedAt: string
  ): Promise<void> {
    for (const [assetId, update] of observedAssetUpdates.entries()) {
      try {
        await pool.query(
          `UPDATE assets
             SET ip_address = COALESCE($1::inet, ip_address),
                 mac_address = COALESCE($2::macaddr, mac_address),
                 raw_data = COALESCE(raw_data, '{}'::jsonb) || jsonb_build_object(
                   'network',
                   jsonb_build_object(
                     'last_seen_at', $3::text,
                     'observed_ip_address', $1::text,
                     'observed_mac_address', $2::text
                   )
                 ) || jsonb_build_object(
                   'ip_evidence',
                   jsonb_build_object(
                     'ip_address', $1::text,
                     'source', 'network_scan',
                     'last_seen_at', $3::text
                   )
                 ),
                 last_seen = NOW(),
                 updated_at = NOW()
             WHERE id = $4`,
            [update.ip_address, update.mac_address, observedAt, assetId]
          );
        } catch (error: any) {
          logger.warn(`Failed to store observed asset identity for ${assetId}: ${error.message}`);
        }
      }

    if (observedAssetUpdates.size > 0) {
      await assetBusinessLogicService.recalculateAssets(Array.from(observedAssetUpdates.keys()));
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
