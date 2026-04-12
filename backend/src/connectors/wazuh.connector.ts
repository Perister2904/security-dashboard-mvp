import { promises as fs } from 'fs';
import path from 'path';
import pool from '../config/database';
import { cacheInvalidatePattern } from '../config/redis';
import { BaseConnector, ConnectorConfig, SyncResult } from './base.connector';
import logger from '../utils/logger';
import { assetBusinessLogicService } from '../services/asset-business-logic.service';

type AssetStatus = 'protected' | 'not_installed' | 'offline' | 'outdated' | 'unknown';
type ControlKey = 'av' | 'edr' | 'dlp';

interface WazuhEvent {
  timestamp?: string;
  agent?: {
    id?: string;
    name?: string;
    ip?: string;
  };
  rule?: {
    id?: string | number;
    level?: number;
    description?: string;
    groups?: string[];
  };
  decoder?: {
    name?: string;
  };
  data?: Record<string, any>;
  location?: string;
}

interface DerivedSignal {
  status: AssetStatus;
  observedAt: string;
  ruleId: string;
  description: string;
  version: string | null;
}

interface AggregatedTelemetry {
  hostname: string | null;
  ipAddress: string | null;
  agentId: string | null;
  latestSeenAt: string | null;
  controls: Partial<Record<ControlKey, DerivedSignal>>;
  matchedEvents: number;
}

interface AssetRow {
  id: string;
  hostname: string;
  ip_address: string | null;
  raw_data: any;
  edr_status: AssetStatus;
  dlp_status: AssetStatus;
  antivirus_status: AssetStatus;
}

const ACTIVE_KEYWORDS = ['active', 'enabled', 'running', 'healthy', 'protected', 'monitoring'];
const OFFLINE_KEYWORDS = ['offline', 'disconnected', 'unreachable'];
const OUTDATED_KEYWORDS = ['outdated', 'stale', 'expired'];
const MISSING_KEYWORDS = ['not installed', 'not_installed', 'missing', 'uninstalled', 'disabled', 'stopped', 'absent'];

export class WazuhConnector extends BaseConnector {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  async testConnection(): Promise<boolean> {
    try {
      await fs.access(this.getSampleFilePath());
      return true;
    } catch (error: any) {
      logger.error('Wazuh sample connection test failed', { error: error.message });
      return false;
    }
  }

  async syncIncidents(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [],
      duration: 0,
    };

    result.duration = Date.now() - startTime;
    return result;
  }

  async syncAssets(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [],
      duration: 0,
    };

    try {
      await this.ensureUnknownStatusSupported();

      const events = await this.readSampleEvents();
      const telemetryByAsset = this.aggregateTelemetry(events);
      const assets = await this.getAssets();
      const updatedAssetIds = new Set<string>();

      result.itemsProcessed = events.length;

      for (const telemetry of telemetryByAsset.values()) {
        const matchedAsset = this.matchAsset(assets, telemetry);
        if (!matchedAsset) {
          result.errors.push(
            `No asset matched Wazuh telemetry for ${telemetry.hostname || telemetry.ipAddress || telemetry.agentId || 'unknown agent'}`
          );
          continue;
        }

        const nextEdrStatus = telemetry.controls.edr?.status || matchedAsset.edr_status;
        const nextDlpStatus: AssetStatus = telemetry.controls.dlp ? 'protected' : 'unknown';
        const nextAntivirusStatus = telemetry.controls.av?.status || matchedAsset.antivirus_status;
        const nextEdrVersion = telemetry.controls.edr?.version || null;
        const nextDlpVersion = telemetry.controls.dlp?.version || null;
        const nextAntivirusVersion = telemetry.controls.av?.version || null;
        const nextEdrLastSeen = telemetry.controls.edr?.observedAt || telemetry.latestSeenAt;
        const nextDlpLastSeen = telemetry.controls.dlp?.observedAt || null;
        const nextAntivirusLastScan = telemetry.controls.av?.observedAt || telemetry.latestSeenAt;

        await pool.query(
          `UPDATE assets
           SET edr_status = $1,
               dlp_status = $2,
               antivirus_status = $3,
               edr_agent_version = $4,
               edr_last_seen = $5::timestamp,
               dlp_agent_version = $6,
               dlp_last_seen = $7::timestamp,
               antivirus_version = $8,
               antivirus_last_scan = $9::timestamp,
               last_seen = COALESCE($10::timestamp, last_seen),
               raw_data = COALESCE(raw_data, '{}'::jsonb) || jsonb_build_object('wazuh', $11::jsonb) || jsonb_build_object('ip_evidence', $12::jsonb),
               updated_at = NOW()
           WHERE id = $13`,
          [
            nextEdrStatus,
            nextDlpStatus,
            nextAntivirusStatus,
            nextEdrVersion,
            nextEdrLastSeen,
            nextDlpVersion,
            nextDlpLastSeen,
            nextAntivirusVersion,
            nextAntivirusLastScan,
            telemetry.latestSeenAt,
            JSON.stringify(this.buildRawDataPayload(telemetry)),
            JSON.stringify(this.buildIpEvidencePayload(telemetry)),
            matchedAsset.id,
          ]
        );

        updatedAssetIds.add(matchedAsset.id);
        result.itemsUpdated++;
      }

      if (updatedAssetIds.size > 0) {
        await assetBusinessLogicService.recalculateAssets(Array.from(updatedAssetIds));
      }

      await cacheInvalidatePattern('asset:*');
      await cacheInvalidatePattern('assets:*');

      logger.info('Wazuh sample asset sync completed', {
        itemsProcessed: result.itemsProcessed,
        itemsUpdated: result.itemsUpdated,
        errors: result.errors.length,
      });
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Wazuh asset sync failed: ${error.message}`);
      logger.error('Wazuh asset sync failed', { error: error.message });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  private getSampleFilePath(): string {
    const configuredPath = this.config.config?.sample_file_path;
    if (configuredPath) {
      return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.join(process.cwd(), configuredPath);
    }

    return path.join(process.cwd(), 'sample-data', 'wazuh', 'alerts.ndjson');
  }

  private async ensureUnknownStatusSupported(): Promise<void> {
    await pool.query(`
      ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_edr_status_check;
      ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_dlp_status_check;
      ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_antivirus_status_check;

      ALTER TABLE assets
        ADD CONSTRAINT assets_edr_status_check
        CHECK (edr_status IN ('protected', 'not_installed', 'offline', 'outdated', 'unknown'));

      ALTER TABLE assets
        ADD CONSTRAINT assets_dlp_status_check
        CHECK (dlp_status IN ('protected', 'not_installed', 'offline', 'outdated', 'unknown'));

      ALTER TABLE assets
        ADD CONSTRAINT assets_antivirus_status_check
        CHECK (antivirus_status IN ('protected', 'not_installed', 'offline', 'outdated', 'unknown'));
    `);
  }

  private async readSampleEvents(): Promise<WazuhEvent[]> {
    const fileContents = await fs.readFile(this.getSampleFilePath(), 'utf8');
    const lines = fileContents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((line, index) => {
      try {
        return JSON.parse(line) as WazuhEvent;
      } catch (error: any) {
        throw new Error(`Invalid Wazuh sample event on line ${index + 1}: ${error.message}`);
      }
    });
  }

  private aggregateTelemetry(events: WazuhEvent[]): Map<string, AggregatedTelemetry> {
    const telemetryByAsset = new Map<string, AggregatedTelemetry>();

    for (const event of events) {
      const hostname = this.normalizeHostname(event.agent?.name);
      const ipAddress = this.normalizeIpAddress(event.agent?.ip);
      const groupingKey = hostname || ipAddress || String(event.agent?.id || '');

      if (!groupingKey) {
        continue;
      }

      if (!telemetryByAsset.has(groupingKey)) {
        telemetryByAsset.set(groupingKey, {
          hostname: hostname || null,
          ipAddress: ipAddress || null,
          agentId: event.agent?.id || null,
          latestSeenAt: null,
          controls: {},
          matchedEvents: 0,
        });
      }

      const aggregate = telemetryByAsset.get(groupingKey)!;
      aggregate.matchedEvents += 1;

      const observedAt = this.normalizeTimestamp(event.timestamp);
      if (observedAt && (!aggregate.latestSeenAt || observedAt > aggregate.latestSeenAt)) {
        aggregate.latestSeenAt = observedAt;
      }

      const control = this.identifyControl(event);
      if (!control || !observedAt) {
        continue;
      }

        const signal: DerivedSignal = {
          status: this.identifyStatus(event),
          observedAt,
          ruleId: String(event.rule?.id || ''),
          description: event.rule?.description || '',
          version: this.extractVersion(event),
        };

      const existingSignal = aggregate.controls[control];
      if (!existingSignal || signal.observedAt >= existingSignal.observedAt) {
        aggregate.controls[control] = signal;
      }
    }

    return telemetryByAsset;
  }

  private async getAssets(): Promise<AssetRow[]> {
    const result = await pool.query(
      `SELECT id, hostname, ip_address::text, raw_data, edr_status, dlp_status, antivirus_status
       FROM assets
       WHERE is_active = true`
    );

    return result.rows;
  }

  private matchAsset(assets: AssetRow[], telemetry: AggregatedTelemetry): AssetRow | undefined {
    const hostname = telemetry.hostname || '';
    const ipAddress = telemetry.ipAddress || '';

    return assets.find((asset) => {
      if (hostname && this.normalizeHostname(asset.hostname) === hostname) {
        return true;
      }

      const assetIp = this.normalizeIpAddress(asset.ip_address);
      if (ipAddress && assetIp === ipAddress) {
        return true;
      }

      const reportedIps = Array.isArray(asset.raw_data?.ad?.reported_ip_addresses)
        ? asset.raw_data.ad.reported_ip_addresses.map((value: string) => this.normalizeIpAddress(value))
        : [];

      return ipAddress ? reportedIps.includes(ipAddress) : false;
    });
  }

  private buildRawDataPayload(telemetry: AggregatedTelemetry) {
    return {
      source: 'sample_file',
      sample_file_path: this.getSampleFilePath(),
      agent: {
        id: telemetry.agentId,
        name: telemetry.hostname,
        ip: telemetry.ipAddress,
      },
      last_seen_at: telemetry.latestSeenAt,
      matched_events: telemetry.matchedEvents,
      controls: {
        antivirus: telemetry.controls.av || null,
        edr: telemetry.controls.edr || null,
        dlp: telemetry.controls.dlp || null,
      },
      synced_at: new Date().toISOString(),
    };
  }

  private buildIpEvidencePayload(telemetry: AggregatedTelemetry) {
    return {
      ip_address: telemetry.ipAddress,
      source: telemetry.ipAddress ? 'wazuh' : 'unknown',
      last_seen_at: telemetry.latestSeenAt,
    };
  }

  private identifyControl(event: WazuhEvent): ControlKey | null {
    const control = String(event.data?.control || '').toLowerCase();
    if (control === 'antivirus' || control === 'av') {
      return 'av';
    }
    if (control === 'edr') {
      return 'edr';
    }
    if (control === 'dlp') {
      return 'dlp';
    }

    const groups = (event.rule?.groups || []).map((group) => group.toLowerCase());
    const combined = `${groups.join(' ')} ${String(event.rule?.description || '').toLowerCase()} ${String(event.decoder?.name || '').toLowerCase()}`;

    if (this.containsAny(combined, ['antivirus', 'defender', 'malware', 'av'])) {
      return 'av';
    }

    if (this.containsAny(combined, ['edr', 'endpoint', 'sysmon', 'telemetry', 'agent'])) {
      return 'edr';
    }

    if (this.containsAny(combined, ['dlp', 'data_loss_prevention', 'removable_storage', 'usb', 'file_integrity', 'data_protection'])) {
      return 'dlp';
    }

    return null;
  }

  private identifyStatus(event: WazuhEvent): AssetStatus {
    const statusText = [
      event.data?.state,
      event.rule?.description,
      event.location,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (this.containsAny(statusText, OUTDATED_KEYWORDS)) {
      return 'outdated';
    }

    if (this.containsAny(statusText, OFFLINE_KEYWORDS)) {
      return 'offline';
    }

    if (this.containsAny(statusText, MISSING_KEYWORDS)) {
      return 'not_installed';
    }

    if (this.containsAny(statusText, ACTIVE_KEYWORDS)) {
      return 'protected';
    }

    return 'protected';
  }

  private extractVersion(event: WazuhEvent): string | null {
    const candidates = [
      event.data?.version,
      event.data?.agent_version,
      event.data?.product_version,
      event.data?.engine_version,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }

  private containsAny(value: string, keywords: string[]): boolean {
    return keywords.some((keyword) => value.includes(keyword));
  }

  private normalizeHostname(value?: string | null): string {
    return String(value || '')
      .split('.')[0]
      .trim()
      .toLowerCase();
  }

  private normalizeIpAddress(value?: string | null): string {
    return String(value || '')
      .split('/')[0]
      .trim();
  }

  private normalizeTimestamp(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return new Date(parsed).toISOString();
  }
}
