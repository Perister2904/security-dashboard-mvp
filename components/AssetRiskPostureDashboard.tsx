"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Laptop,
  Network,
  RefreshCw,
  Server,
  Shield,
  XCircle,
} from "lucide-react";
import { assetsAPI } from "@/lib/api";
import { fetchRealAssets, syncFromActiveDirectory, type RealAsset } from "@/lib/real-api";
import { type Asset } from "@/lib/soc-data";

type CoverageStats = {
  total_assets: number;
  edr_coverage_pct: number;
  dlp_coverage_pct: number;
  av_coverage_pct: number;
  compliance_pct: number;
};

type AuthenticatedDiscoveryAsset = {
  id: string;
  hostname: string;
  ip_address: string | null;
  asset_type: string;
  criticality: string;
  department: string;
  seen_on_network: boolean;
  match_fields: Array<"hostname" | "ip" | "mac">;
  match_score: number;
  match_strength: "strong" | "medium" | "weak" | null;
  match_reason: string | null;
};

type UnauthorizedDiscoveryAsset = {
  ip_address: string;
  hostname: string | null;
  mac_address: string | null;
  vendor: string | null;
  reason: string;
};

type NetworkDiscoveryResponse = {
  scan_range: string;
  scanner: "nmap";
  nmap_available: boolean;
  scan_status: "completed" | "unavailable" | "failed";
  scanned_at: string;
  authenticated_assets: AuthenticatedDiscoveryAsset[];
  unauthorized_assets: UnauthorizedDiscoveryAsset[];
  summary: {
    authenticated_total: number;
    authenticated_seen_on_network: number;
    unauthorized_total: number;
  };
  error?: string;
};

type DisplayAsset = Asset & {
  seenOnNetwork: boolean;
  telemetrySource?: string;
  ipSource?: string;
  ipLastSeen?: string;
  adLastSeen?: string;
  wazuhLastSeen?: string;
  networkLastSeen?: string;
  lastObservedAt?: string;
  adPrimaryIp?: string;
  adDnsIpAddresses?: string[];
  networkMatchFields?: string[];
  networkMatchScore?: number;
  networkMatchStrength?: "strong" | "medium" | "weak" | null;
  networkMatchReason?: string | null;
};

type RiskPostureResponse = {
  overallScore: number;
  averageRiskScore: number;
  byCriticality: Array<{
    criticality: string;
    count: number;
    avg_risk_score: number;
  }>;
};

const EMPTY_COVERAGE: CoverageStats = {
  total_assets: 0,
  edr_coverage_pct: 0,
  dlp_coverage_pct: 0,
  av_coverage_pct: 0,
  compliance_pct: 0,
};

const EMPTY_DISCOVERY: NetworkDiscoveryResponse = {
  scan_range: "Not configured",
  scanner: "nmap",
  nmap_available: false,
  scan_status: "unavailable",
  scanned_at: "",
  authenticated_assets: [],
  unauthorized_assets: [],
  summary: {
    authenticated_total: 0,
    authenticated_seen_on_network: 0,
    unauthorized_total: 0,
  },
};

function mapAssetType(assetType?: string): Asset["type"] {
  if (assetType === "server") return "Server";
  if (assetType === "workstation") return "Workstation";
  return "Network Device";
}

function mapCriticality(criticality?: string): Asset["criticality"] {
  if (criticality === "critical") return "Critical";
  if (criticality === "high") return "High";
  if (criticality === "low") return "Low";
  return "Medium";
}

function mapComplianceStatus(status?: string): Asset["complianceStatus"] {
  if (status === "compliant") return "Compliant";
  if (status === "partially_compliant") return "Partially Compliant";
  if (status === "non_compliant") return "Non-Compliant";
  return "Unknown";
}

function mapToolStatus(status?: string): Asset["edr"]["status"] {
  if (status === "protected") return "Active";
  if (status === "offline" || status === "outdated") return "Inactive";
  if (status === "not_installed") return "Not Installed";
  return "Unknown";
}

function mapRealAsset(asset: RealAsset, seenOnNetwork: boolean): DisplayAsset {
  return {
    id: asset.id,
    name: asset.hostname || "Unknown Asset",
    type: mapAssetType(asset.asset_type),
    department: asset.department || "Unknown",
    ipAddress: asset.effective_ip_address || asset.ip_address || "Unknown",
    criticality: mapCriticality(asset.criticality),
    complianceStatus: mapComplianceStatus(asset.compliance_status),
    edr: {
      installed: asset.edr_status === "protected",
      status: mapToolStatus(asset.edr_status),
      version: asset.edr_agent_version || undefined,
      lastUpdate: asset.edr_last_seen || undefined,
    },
    dlp: {
      installed: asset.dlp_status === "protected",
      status: mapToolStatus(asset.dlp_status),
      version: asset.dlp_agent_version || undefined,
      lastUpdate: asset.dlp_last_seen || undefined,
    },
    antivirus: {
      installed: asset.antivirus_status === "protected",
      status: mapToolStatus(asset.antivirus_status),
      version: asset.antivirus_version || undefined,
      lastUpdate: asset.antivirus_last_scan || undefined,
    },
    lastScan: asset.last_observed_at || asset.last_seen || new Date().toISOString(),
    seenOnNetwork,
    telemetrySource: asset.raw_data?.wazuh?.source || undefined,
    ipSource: asset.ip_source || undefined,
    ipLastSeen: asset.ip_last_seen || undefined,
    adLastSeen: asset.ad_last_seen || undefined,
    wazuhLastSeen: asset.wazuh_last_seen || undefined,
    networkLastSeen: asset.network_last_seen || undefined,
    lastObservedAt: asset.last_observed_at || asset.last_seen || undefined,
    adPrimaryIp: asset.ad_primary_ip || undefined,
    adDnsIpAddresses: asset.ad_dns_ip_addresses || [],
  };
}

function mapDiscoveryAsset(asset: AuthenticatedDiscoveryAsset): DisplayAsset {
  return {
    id: asset.id,
    name: asset.hostname || "Unknown Asset",
    type: mapAssetType(asset.asset_type),
    department: asset.department || "Unknown",
    ipAddress: asset.ip_address || "Unknown",
    criticality: mapCriticality(asset.criticality),
    complianceStatus: "Unknown",
    edr: { installed: false, status: "Unknown", version: "N/A" },
    dlp: { installed: false, status: "Unknown", version: "N/A" },
    antivirus: { installed: false, status: "Unknown", version: "N/A" },
    lastScan: new Date().toISOString(),
    seenOnNetwork: asset.seen_on_network,
    ipSource: asset.seen_on_network ? "network_scan" : undefined,
    ipLastSeen: asset.seen_on_network ? new Date().toISOString() : undefined,
    networkLastSeen: asset.seen_on_network ? new Date().toISOString() : undefined,
    lastObservedAt: asset.seen_on_network ? new Date().toISOString() : undefined,
    adDnsIpAddresses: [],
    networkMatchFields: asset.match_fields || [],
    networkMatchScore: asset.match_score || 0,
    networkMatchStrength: asset.match_strength || null,
    networkMatchReason: asset.match_reason || null,
  };
}

function formatIpSource(value?: string) {
  if (value === "wazuh") return "Wazuh";
  if (value === "network_scan") return "Network Scan";
  if (value === "ad_dns") return "AD DNS";
  if (value === "manual") return "Stored Asset Record";
  return "Unknown";
}

function formatTimestamp(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "No evidence yet";
}

function getAssetIcon(type: Asset["type"]) {
  if (type === "Server") return <Server className="h-4 w-4" />;
  if (type === "Network Device") return <Network className="h-4 w-4" />;
  return <Laptop className="h-4 w-4" />;
}

function getToolStatusBadge(status: Asset["edr"]["status"]) {
  if (status === "Active") return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
  if (status === "Inactive") return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
  if (status === "Not Installed") return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  return <span className="text-xs font-semibold text-gray-400">?</span>;
}

function getDiscoveryStatusText(discovery: NetworkDiscoveryResponse) {
  if (discovery.scan_status === "completed") {
    return `nmap scanned ${discovery.scan_range} and only trusted hosts with at least two corroborating signals from hostname, MAC, and IP, with recent evidence strengthening the match.`;
  }

  if (discovery.scan_status === "failed") {
    return `The nmap scan failed for ${discovery.scan_range}.`;
  }

  return "nmap is not available on this server yet, so unauthorized host detection is waiting on scanner installation.";
}

export default function AssetRiskPostureDashboard() {
  const [assets, setAssets] = useState<DisplayAsset[]>([]);
  const [coverageStats, setCoverageStats] = useState<CoverageStats>(EMPTY_COVERAGE);
  const [networkDiscovery, setNetworkDiscovery] = useState<NetworkDiscoveryResponse>(EMPTY_DISCOVERY);
  const [riskPosture, setRiskPosture] = useState<RiskPostureResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingWazuh, setIsSyncingWazuh] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  const fetchInventoryData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const [realAssetsResult, coverageResult, riskPostureResult] = await Promise.allSettled([
      fetchRealAssets(),
      assetsAPI.getCoverage(),
      assetsAPI.getRiskPosture(),
    ]);

    const realAssets = realAssetsResult.status === "fulfilled" ? realAssetsResult.value : [];
    const nextCoverage =
      coverageResult.status === "fulfilled" ? (coverageResult.value?.data as CoverageStats | undefined) ?? EMPTY_COVERAGE : EMPTY_COVERAGE;
    const nextRiskPosture =
      riskPostureResult.status === "fulfilled" ? (riskPostureResult.value?.data as RiskPostureResponse | undefined) ?? null : null;

    setAssets((currentAssets) => {
      const seenById = new Map(currentAssets.map((asset) => [asset.id, asset.seenOnNetwork]));
      return realAssets.length > 0 ? realAssets.map((asset) => mapRealAsset(asset, seenById.get(asset.id) ?? false)) : [];
    });
    setCoverageStats(nextCoverage);
    setRiskPosture(nextRiskPosture);

    if (realAssetsResult.status === "rejected" && coverageResult.status === "rejected" && riskPostureResult.status === "rejected") {
      setLoadError("Backend data could not be loaded.");
    }

    setIsLoading(false);
  }, []);

  const scanNetwork = useCallback(async () => {
    setIsScanning(true);
    setLoadError(null);

    try {
      const discoveryResponse = await assetsAPI.getNetworkDiscovery();
      const nextDiscovery = (discoveryResponse?.data as NetworkDiscoveryResponse | undefined) ?? EMPTY_DISCOVERY;
      const discoveryById = new Map(nextDiscovery.authenticated_assets.map((asset) => [asset.id, asset]));

      setNetworkDiscovery(nextDiscovery);
      setAssets((currentAssets) =>
        currentAssets.length > 0
          ? currentAssets.map((asset) => ({
              ...asset,
              ipAddress: discoveryById.get(asset.id)?.ip_address || asset.ipAddress,
              ipSource: discoveryById.get(asset.id)?.seen_on_network ? "network_scan" : asset.ipSource,
              ipLastSeen: discoveryById.get(asset.id)?.seen_on_network ? nextDiscovery.scanned_at || asset.ipLastSeen : asset.ipLastSeen,
              seenOnNetwork: discoveryById.get(asset.id)?.seen_on_network ?? false,
              networkLastSeen: discoveryById.get(asset.id)?.seen_on_network ? nextDiscovery.scanned_at || asset.networkLastSeen : asset.networkLastSeen,
              lastObservedAt: discoveryById.get(asset.id)?.seen_on_network
                ? nextDiscovery.scanned_at || asset.lastObservedAt
                : asset.lastObservedAt,
              networkMatchFields: discoveryById.get(asset.id)?.match_fields || [],
              networkMatchScore: discoveryById.get(asset.id)?.match_score || 0,
              networkMatchStrength: discoveryById.get(asset.id)?.match_strength || null,
              networkMatchReason: discoveryById.get(asset.id)?.match_reason || null,
            }))
          : nextDiscovery.authenticated_assets.map(mapDiscoveryAsset)
      );
    } catch (error) {
      setLoadError("Network discovery could not be refreshed.");
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      await fetchInventoryData();
      if (isMounted) {
        await scanNetwork();
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [fetchInventoryData, scanNetwork]);

  const handleADSync = useCallback(async () => {
    setIsSyncing(true);
    setLastSyncMessage("Syncing Active Directory inventory...");

    try {
      const result = await syncFromActiveDirectory();
      if (result.success) {
        setLastSyncMessage(`AD sync imported ${result.data.assetsImported} assets.`);
      } else {
        setLastSyncMessage(`AD sync failed: ${result.data.errors.join(", ") || result.message}`);
      }
      await fetchInventoryData();
    } catch (error) {
      setLastSyncMessage(`AD sync failed: ${String(error)}`);
    } finally {
      setIsSyncing(false);
      window.setTimeout(() => setLastSyncMessage(""), 5000);
    }
  }, [fetchInventoryData]);

  const handleWazuhSync = useCallback(async () => {
    setIsSyncingWazuh(true);
    setLastSyncMessage("Syncing Wazuh telemetry from sample logs...");

    try {
      const result = await assetsAPI.syncWazuhTelemetry();
      if (result.success) {
        setLastSyncMessage(result.message || "Wazuh telemetry sync completed.");
      } else {
        setLastSyncMessage(`Wazuh sync failed: ${result.error || result.message || "Unknown error"}`);
      }
      await fetchInventoryData();
    } catch (error) {
      setLastSyncMessage(`Wazuh sync failed: ${String(error)}`);
    } finally {
      setIsSyncingWazuh(false);
      window.setTimeout(() => setLastSyncMessage(""), 5000);
    }
  }, [fetchInventoryData]);

  const authenticatedTotal = networkDiscovery.summary.authenticated_total || assets.length;
  const authenticatedSeen = networkDiscovery.summary.authenticated_seen_on_network;
  const unauthorizedTotal = networkDiscovery.summary.unauthorized_total;
  const postureScore = riskPosture?.overallScore ?? 0;

  const criticalityDistribution = riskPosture?.byCriticality?.length
    ? riskPosture.byCriticality.map((item) => ({
        level: item.criticality.charAt(0).toUpperCase() + item.criticality.slice(1),
        count: item.count,
      }))
    : ["Critical", "High", "Medium", "Low"].map((level) => ({
        level,
        count: assets.filter((asset) => asset.criticality === level).length,
      }));

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-4 py-4 text-white dark:border-gray-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-100">
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                <span>Authenticated AD inventory vs live subnet discovery</span>
              </div>
              <p className="max-w-3xl text-sm text-slate-200">
                Active Directory defines authenticated assets. Use Sync AD to refresh inventory, then Refresh when you want a live subnet comparison against nmap.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={handleWazuhSync} disabled={isSyncingWazuh} className="btn border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Shield className={`h-4 w-4 ${isSyncingWazuh ? "animate-pulse" : ""}`} />
                {isSyncingWazuh ? "Syncing Wazuh..." : "Sync Wazuh"}
              </button>
              <button onClick={handleADSync} disabled={isSyncing} className="btn border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Database className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing AD..." : "Sync AD"}
              </button>
            </div>
          </div>
          {(lastSyncMessage || loadError) && (
            <div
              className={`rounded-xl px-3 py-2 text-xs ${
                loadError
                  ? "bg-red-500/15 text-red-100"
                  : lastSyncMessage.startsWith("AD sync imported") || lastSyncMessage.startsWith("Processed") || lastSyncMessage.includes("completed")
                    ? "bg-emerald-500/15 text-emerald-100"
                    : "bg-amber-500/15 text-amber-100"
              }`}
            >
              {loadError || lastSyncMessage}
            </div>
          )}
        </div>

        <div className="grid gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Authenticated</div>
            <div className="mt-2 text-3xl font-bold text-emerald-900 dark:text-emerald-100">{authenticatedTotal}</div>
            <div className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">Assets known to Active Directory</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Seen On Network</div>
            <div className="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-100">{authenticatedSeen}</div>
            <div className="mt-1 text-xs text-blue-800/80 dark:text-blue-200/80">Authenticated assets observed by nmap</div>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700 dark:text-red-300">Unauthorized</div>
            <div className="mt-2 text-3xl font-bold text-red-900 dark:text-red-100">{unauthorizedTotal}</div>
            <div className="mt-1 text-xs text-red-800/80 dark:text-red-200/80">Present on the scanned network but not in AD</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">Posture Score</div>
            <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{postureScore}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">Coverage score from compliance and endpoint controls</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="card p-4">
          <h3 className="text-sm font-bold">Coverage Snapshot</h3>
          <div className="mt-4 space-y-3">
            {[
              { label: "Compliance", value: coverageStats.compliance_pct },
              { label: "EDR", value: coverageStats.edr_coverage_pct },
              { label: "DLP", value: coverageStats.dlp_coverage_pct },
              { label: "Antivirus", value: coverageStats.av_coverage_pct },
            ].map((metric) => (
              <div key={metric.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span>{metric.label}</span>
                  <span>{metric.value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${metric.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Criticality Distribution</h4>
            <div className="mt-3 space-y-2">
              {criticalityDistribution.map((item) => (
                <div key={item.level}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>{item.level}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${
                        item.level === "Critical"
                          ? "bg-red-500"
                          : item.level === "High"
                            ? "bg-orange-500"
                            : item.level === "Medium"
                              ? "bg-blue-500"
                              : "bg-gray-400"
                      }`}
                      style={{ width: `${assets.length > 0 ? (item.count / assets.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-bold">Authenticated AD Assets</h3>
              <p className="text-xs text-gray-500">Known assets with network visibility status. Click an asset row to inspect versions and source-specific observation evidence.</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {authenticatedTotal} assets
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Asset</th>
                  <th className="px-4 py-3 text-left font-semibold">IP</th>
                  <th className="px-4 py-3 text-center font-semibold">EDR</th>
                  <th className="px-4 py-3 text-center font-semibold">DLP</th>
                  <th className="px-4 py-3 text-center font-semibold">AV</th>
                  <th className="px-4 py-3 text-left font-semibold">Network</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      No authenticated assets are available yet. Run an AD sync to populate the inventory.
                    </td>
                  </tr>
                )}
                {assets.map((asset) => (
                  <Fragment key={asset.id}>
                  <tr
                    className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-slate-50 dark:border-gray-800 dark:hover:bg-slate-950/40"
                    onClick={() => setExpandedAssetId((current) => (current === asset.id ? null : asset.id))}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                            asset.criticality === "Critical"
                              ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                              : asset.criticality === "High"
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          }`}
                        >
                          {getAssetIcon(asset.type)}
                        </div>
                        <div>
                          <div className="font-semibold">{asset.name}</div>
                          <div className="text-[11px] text-gray-500">{asset.type} - {asset.department}</div>
                        </div>
                        <div className="ml-auto text-gray-400">
                          {expandedAssetId === asset.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{asset.ipAddress || "Unknown"}</td>
                    <td className="px-4 py-3 text-center">{getToolStatusBadge(asset.edr.status)}</td>
                    <td className="px-4 py-3 text-center">{getToolStatusBadge(asset.dlp.status)}</td>
                    <td className="px-4 py-3 text-center">{getToolStatusBadge(asset.antivirus.status)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          asset.seenOnNetwork
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {asset.seenOnNetwork ? "Seen by nmap" : "Not seen in latest scan"}
                      </span>
                    </td>
                  </tr>
                  {expandedAssetId === asset.id && (
                    <tr className="border-t border-gray-100 bg-slate-50/70 dark:border-gray-800 dark:bg-slate-950/30">
                      <td colSpan={6} className="px-4 py-4">
                          <div className="grid gap-3 md:grid-cols-3">
                            {[
                              {
                                label: "EDR",
                                status: asset.edr.status,
                              version: asset.edr.version,
                              lastUpdate: asset.edr.lastUpdate,
                            },
                            {
                              label: "DLP",
                              status: asset.dlp.status,
                              version: asset.dlp.version,
                              lastUpdate: asset.dlp.lastUpdate,
                            },
                            {
                              label: "Antivirus",
                              status: asset.antivirus.status,
                              version: asset.antivirus.version,
                              lastUpdate: asset.antivirus.lastUpdate,
                            },
                          ].map((control) => (
                            <div key={control.label} className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-slate-900">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{control.label}</span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{control.status}</span>
                              </div>
                              <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                <div>
                                  <span className="font-semibold text-gray-800 dark:text-gray-100">Version:</span>{" "}
                                  {control.version || "No version evidence"}
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-800 dark:text-gray-100">Last evidence:</span>{" "}
                                  {control.lastUpdate ? new Date(control.lastUpdate).toLocaleString() : "No recent evidence"}
                                </div>
                              </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-slate-900">
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Observation Evidence</div>
                              <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                <div>
                                  <span className="font-semibold text-gray-800 dark:text-gray-100">Latest observed:</span>{" "}
                                  {formatTimestamp(asset.lastObservedAt)}
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-800 dark:text-gray-100">AD last logon:</span>{" "}
                                  {formatTimestamp(asset.adLastSeen)}
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-800 dark:text-gray-100">Wazuh telemetry:</span>{" "}
                                  {formatTimestamp(asset.wazuhLastSeen)}
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-800 dark:text-gray-100">Network seen:</span>{" "}
                                  {formatTimestamp(asset.networkLastSeen)}
                                </div>
                              </div>
                            </div>
                              <div className="rounded-2xl border border-gray-200 bg-white p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-slate-900 dark:text-gray-300">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Evidence Source</div>
                                <div className="mt-3 space-y-1">
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">Displayed IP:</span>{" "}
                                    {asset.ipAddress || "No current IP recorded"}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">IP source:</span>{" "}
                                    {formatIpSource(asset.ipSource)}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">IP last seen:</span>{" "}
                                    {formatTimestamp(asset.ipLastSeen)}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">AD DNS IPs:</span>{" "}
                                    {asset.adDnsIpAddresses && asset.adDnsIpAddresses.length > 0
                                      ? asset.adDnsIpAddresses.join(", ")
                                      : "No AD DNS IPs recorded"}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">Telemetry source:</span>{" "}
                                    {asset.telemetrySource || "No Wazuh source recorded"}
                                  </div>
                                  <div>
                                  <span className="font-semibold text-gray-800 dark:text-gray-100">Network status:</span>{" "}
                                  {asset.seenOnNetwork ? "Seen in latest nmap comparison" : "Not seen in latest nmap comparison"}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">Match strength:</span>{" "}
                                    {asset.networkMatchStrength
                                      ? `${asset.networkMatchStrength.charAt(0).toUpperCase()}${asset.networkMatchStrength.slice(1)}`
                                      : "No trusted correlation in latest scan"}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">Matched fields:</span>{" "}
                                    {asset.networkMatchFields && asset.networkMatchFields.length > 0
                                      ? asset.networkMatchFields.join(", ")
                                      : "No corroborating field combination recorded"}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">Match reason:</span>{" "}
                                    {asset.networkMatchReason || "The latest scan did not establish a strong authenticated match."}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">AD identity:</span>{" "}
                                    {asset.name}
                                  </div>
                                </div>
                              </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.38fr_0.62fr]">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold">Discovery Status</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => void scanNetwork()} disabled={isScanning} className="btn px-3 py-1.5 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? "animate-spin" : ""}`} />
                {isScanning ? "Refreshing..." : "Refresh"}
              </button>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  networkDiscovery.scan_status === "completed"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : networkDiscovery.scan_status === "failed"
                      ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                {networkDiscovery.scan_status.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Scanner</div>
              <div className="mt-1 font-medium">{networkDiscovery.scanner}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Scan Range</div>
              <div className="mt-1 font-medium">{networkDiscovery.scan_range}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Last Attempt</div>
              <div className="mt-1 font-medium">{networkDiscovery.scanned_at ? new Date(networkDiscovery.scanned_at).toLocaleString() : "No scan yet"}</div>
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
            {getDiscoveryStatusText(networkDiscovery)}
          </div>
          {networkDiscovery.error && <div className="mt-2 text-xs text-red-600 dark:text-red-300">{networkDiscovery.error}</div>}
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-bold">Unauthorized Devices</h3>
              <p className="text-xs text-gray-500">Hosts seen by the network scan that could not be matched to AD-authenticated assets</p>
            </div>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300">
              {unauthorizedTotal} flagged
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Host</th>
                  <th className="px-4 py-3 text-left font-semibold">IP</th>
                  <th className="px-4 py-3 text-left font-semibold">MAC</th>
                  <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                  <th className="px-4 py-3 text-left font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {networkDiscovery.unauthorized_assets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      {networkDiscovery.scan_status === "completed"
                        ? "No unauthorized devices were found in the latest subnet scan."
                        : "Unauthorized hosts will appear here once nmap scanning is available and a scan completes."}
                    </td>
                  </tr>
                )}
                {networkDiscovery.unauthorized_assets.map((host) => (
                  <tr key={`${host.ip_address}-${host.mac_address ?? "no-mac"}`} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{host.hostname || "Unknown host"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{host.ip_address}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{host.mac_address || "Unknown"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{host.vendor || "Unknown"}</td>
                    <td className="px-4 py-3 text-red-700 dark:text-red-300">{host.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
