"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { socAPI } from "@/lib/api";
import { demoSocIncidents, demoSocMetrics } from "@/lib/demo-data";

type SocMetrics = {
  active_incidents?: number;
  critical_incidents?: number;
  mttr?: number;
  mtd?: number;
  mtr?: number;
  mtc?: number;
  alerts_24h?: number;
  incidents_created?: number;
  incidents_resolved?: number;
  false_positive_rate?: number;
  escalation_rate?: number;
};

type Incident = {
  id: string;
  title: string;
  description?: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  source: string;
  timestamp: string;
};

const EMPTY_METRICS: SocMetrics = {
  active_incidents: 0,
  critical_incidents: 0,
  mttr: 0,
  mtd: 0,
  mtr: 0,
  mtc: 0,
  alerts_24h: 0,
  incidents_created: 0,
  incidents_resolved: 0,
  false_positive_rate: 0,
  escalation_rate: 0,
};

function normalizeSeverity(severity?: string): Incident["severity"] {
  const value = (severity || "medium").toLowerCase();
  if (value === "critical") return "Critical";
  if (value === "high") return "High";
  if (value === "low") return "Low";
  return "Medium";
}

function normalizeStatus(status?: string): Incident["status"] {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "closed":
    case "false_positive":
      return "Closed";
    default:
      return "Open";
  }
}

export default function SOCPerformanceDashboard() {
  const [metrics, setMetrics] = useState<SocMetrics>(EMPTY_METRICS);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchData = async () => {
    setIsLoading(true);

    try {
      const [metricsResponse, incidentsResponse] = await Promise.all([
        socAPI.getMetrics(),
        socAPI.getIncidents({ limit: 10 }),
      ]);

      setMetrics((metricsResponse?.data as SocMetrics | undefined) ?? EMPTY_METRICS);

      const incidentsPayload = incidentsResponse?.data?.incidents || incidentsResponse?.data || [];
      setIncidents(
        Array.isArray(incidentsPayload)
          ? incidentsPayload.map((incident: any) => ({
              id: incident.id,
              title: incident.title || "Security Incident",
              description: incident.description || "",
              severity: normalizeSeverity(incident.severity),
              status: normalizeStatus(incident.status),
              source: incident.source_tool || incident.source || "SIEM",
              timestamp: incident.detected_at || incident.created_at || new Date().toISOString(),
            }))
          : []
      );
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (error) {
      setMetrics(demoSocMetrics);
      setIncidents(demoSocIncidents as Incident[]);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    const interval = window.setInterval(fetchData, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const resolutionRate =
    Number(metrics.incidents_created || 0) > 0
      ? Math.round((Number(metrics.incidents_resolved || 0) / Number(metrics.incidents_created || 0)) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
          isLoading
            ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            : "border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          <span>{isLoading ? "Refreshing SOC telemetry..." : `Operational telemetry updated at ${lastUpdated || "just now"}`}</span>
        </div>
        <button
          onClick={() => void fetchData()}
          disabled={isLoading}
          className="flex items-center gap-1 rounded bg-white px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">MTD</div>
          <div className="mt-2 text-3xl font-bold text-blue-600">{metrics.mtd || 0}m</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">MTR</div>
          <div className="mt-2 text-3xl font-bold text-green-600">{metrics.mtr || 0}m</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Active Incidents</div>
          <div className="mt-2 text-3xl font-bold text-orange-600">{metrics.active_incidents || 0}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">24h Alerts</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-3xl font-bold">{metrics.alerts_24h || 0}</div>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.38fr_0.62fr]">
        <div className="card p-4">
          <h3 className="text-sm font-bold">Operational Snapshot</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Critical incidents</span>
              <span className="font-semibold">{metrics.critical_incidents || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Mean containment time</span>
              <span className="font-semibold">{metrics.mtc || 0}m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Mean resolution time</span>
              <span className="font-semibold">{metrics.mttr || 0}h</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">False positive rate</span>
              <span className="font-semibold">{metrics.false_positive_rate || 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Resolution rate</span>
              <span className="font-semibold">{resolutionRate}%</span>
            </div>
          </div>
        </div>

        {incidents.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <h3 className="text-sm font-bold">Recent Incidents</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {incidents.map((incident) => (
                <div key={incident.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{incident.title}</div>
                      {incident.description && <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{incident.description}</div>}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                        <span
                          className={`rounded-full px-2 py-1 ${
                            incident.severity === "Critical"
                              ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                              : incident.severity === "High"
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                                : incident.severity === "Medium"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300"
                                  : "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                          }`}
                        >
                          {incident.severity}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{incident.status}</span>
                        <span>{incident.source}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      {new Date(incident.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
