"use client";

import { useEffect, useState } from "react";
import { CheckCircle, RefreshCw, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { ceoAPI, socAPI } from "@/lib/api";
import { demoExecutiveSummary, demoSocSummary, demoTopRisks } from "@/lib/demo-data";

type ExecutiveSummaryResponse = {
  security?: {
    activeIncidents?: number;
    criticalIncidents?: number;
    mttr?: number;
    alertVolume?: number;
  };
  assets?: {
    total?: number;
    coverage?: number;
  };
  risks?: {
    critical?: number;
    high?: number;
    open?: number;
    avgScore?: number;
  };
};

type TopRisk = {
  id: string;
  title: string;
  description: string;
  risk_score: number;
  priority: string;
  mitigation_plan?: string | null;
  owner?: string | null;
  status?: string | null;
};

type SocMetricsResponse = {
  mtr?: number;
  mttr?: number;
  incidents_created?: number;
  incidents_resolved?: number;
};

const EMPTY_SUMMARY: ExecutiveSummaryResponse = {
  security: { activeIncidents: 0, criticalIncidents: 0, mttr: 0, alertVolume: 0 },
  assets: { total: 0, coverage: 0 },
  risks: { critical: 0, high: 0, open: 0, avgScore: 0 },
};

const EMPTY_SOC: SocMetricsResponse = {
  mtr: 0,
  mttr: 0,
  incidents_created: 0,
  incidents_resolved: 0,
};

export default function CEORiskSummary() {
  const [summary, setSummary] = useState<ExecutiveSummaryResponse>(EMPTY_SUMMARY);
  const [socMetrics, setSocMetrics] = useState<SocMetricsResponse>(EMPTY_SOC);
  const [topRisks, setTopRisks] = useState<TopRisk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchData = async () => {
    setIsLoading(true);

    try {
      const [summaryResponse, socResponse, topRisksResponse] = await Promise.all([
        ceoAPI.getOverview(),
        socAPI.getMetrics().catch(() => null),
        ceoAPI.getTopRisks(6).catch(() => null),
      ]);

      setSummary((summaryResponse?.data as ExecutiveSummaryResponse | undefined) ?? EMPTY_SUMMARY);
      setSocMetrics((socResponse?.data as SocMetricsResponse | undefined) ?? EMPTY_SOC);
      setTopRisks(Array.isArray(topRisksResponse?.data) ? topRisksResponse.data : []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (error) {
      setSummary(demoExecutiveSummary);
      setSocMetrics(demoSocSummary);
      setTopRisks(demoTopRisks);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    const interval = window.setInterval(fetchData, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const averageRiskScore = Number(summary.risks?.avgScore || 0);
  const coverage = Number(summary.assets?.coverage || 0);
  const riskTrendIcon =
    averageRiskScore >= 70 ? <TrendingUp className="h-4 w-4 text-red-500" /> : <TrendingDown className="h-4 w-4 text-green-500" />;

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
          <span>{isLoading ? "Refreshing executive telemetry..." : `Executive summary updated at ${lastUpdated || "just now"}`}</span>
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
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Average Risk Score</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-3xl font-bold">{averageRiskScore}</div>
            {riskTrendIcon}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Open Risks</div>
          <div className="mt-2 text-3xl font-bold text-red-600">{summary.risks?.open || 0}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Critical Incidents</div>
          <div className="mt-2 text-3xl font-bold text-orange-600">{summary.security?.criticalIncidents || 0}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Asset Coverage</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-3xl font-bold text-blue-600">{coverage}%</div>
            <Shield className="h-4 w-4 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.42fr_0.58fr]">
        <div className="card p-4">
          <h3 className="text-sm font-bold">Executive Snapshot</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Active incidents</span>
              <span className="font-semibold">{summary.security?.activeIncidents || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">24h alert volume</span>
              <span className="font-semibold">{summary.security?.alertVolume || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Average incident MTTR</span>
              <span className="font-semibold">{summary.security?.mttr || 0}h</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Average response time</span>
              <span className="font-semibold">{socMetrics.mtr || 0}m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Authenticated assets</span>
              <span className="font-semibold">{summary.assets?.total || 0}</span>
            </div>
          </div>
        </div>

        {topRisks.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <h3 className="text-sm font-bold">Top Business Risks</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {topRisks.map((risk) => (
                <div key={risk.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{risk.title}</div>
                      {risk.description && <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{risk.description}</div>}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                        {risk.priority && <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">{risk.priority}</span>}
                        {risk.status && <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{risk.status}</span>}
                        {risk.owner && <span>Owner: {risk.owner}</span>}
                      </div>
                      {risk.mitigation_plan && (
                        <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">Mitigation: {risk.mitigation_plan}</div>
                      )}
                    </div>
                    <div className="rounded-xl bg-red-50 px-3 py-2 text-right dark:bg-red-950/30">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-red-700 dark:text-red-300">Risk</div>
                      <div className="text-2xl font-bold text-red-800 dark:text-red-200">{risk.risk_score}</div>
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
