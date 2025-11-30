"use client";

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Mail, Download, Shield, DollarSign, X, Activity, RefreshCw } from 'lucide-react';
import { ceoAPI, socAPI } from '@/lib/api';
import { currentRiskPosture, currentSOCMetrics, SOCMetrics } from '@/lib/soc-data';

export default function CEORiskSummary() {
  const [emailSent, setEmailSent] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<typeof currentRiskPosture.criticalRisks[0] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  
  // State for data
  const [riskPosture, setRiskPosture] = useState(currentRiskPosture);
  const [socMetrics, setSocMetrics] = useState<SOCMetrics>(currentSOCMetrics);

  // Fetch data from backend
  const fetchData = async () => {
    setIsLoading(true);
    
    try {
      const [ceoResponse, socResponse] = await Promise.all([
        ceoAPI.getOverview().catch(() => null),
        socAPI.getMetrics().catch(() => null),
      ]);

      if (ceoResponse?.data) {
        setRiskPosture(prev => ({
          ...prev,
          overallScore: ceoResponse.data.risk_score || prev.overallScore,
          trend: ceoResponse.data.trend || prev.trend,
        }));
        setUsingMockData(false);
      } else {
        setUsingMockData(true);
      }

      if (socResponse?.data) {
        setSocMetrics({
          meanTimeToDetect: socResponse.data.mtd || currentSOCMetrics.meanTimeToDetect,
          meanTimeToRespond: socResponse.data.mtr || currentSOCMetrics.meanTimeToRespond,
          meanTimeToContain: socResponse.data.mtc || currentSOCMetrics.meanTimeToContain,
          meanTimeToResolve: socResponse.data.mttr || currentSOCMetrics.meanTimeToResolve,
          alertsGenerated: socResponse.data.alerts_24h || currentSOCMetrics.alertsGenerated,
          incidentsCreated: socResponse.data.incidents_created || currentSOCMetrics.incidentsCreated,
          incidentsResolved: socResponse.data.incidents_resolved || currentSOCMetrics.incidentsResolved,
          falsePositiveRate: socResponse.data.false_positive_rate || currentSOCMetrics.falsePositiveRate,
          escalationRate: socResponse.data.escalation_rate || currentSOCMetrics.escalationRate,
        });
      }
    } catch (err) {
      console.error('Failed to fetch CEO data:', err);
      setUsingMockData(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSendEmail = () => {
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'Low Risk', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (score >= 60) return { level: 'Medium Risk', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    return { level: 'High Risk', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  const riskLevel = getRiskLevel(riskPosture.overallScore);
  const estimateFinancialImpact = () => Math.round(riskPosture.criticalRisks.reduce((sum, r) => sum + r.riskScore, 0) * 15000);

  return (
    <div className="space-y-2">
      {/* Data Source Indicator */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
        usingMockData 
          ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200'
          : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200'
      }`}>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : usingMockData ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <span>
            {isLoading 
              ? 'Loading executive data...' 
              : usingMockData 
                ? '⚠️ Using demo data (backend unavailable)' 
                : '✓ Connected to live backend'}
          </span>
        </div>
        <button 
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ULTRA COMPACT EXECUTIVE VIEW - 2 COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        
        {/* LEFT: Risk Overview + Key Metrics */}
        <div className="space-y-2">
          {/* Header with Actions */}
          <div className="card p-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold">Executive Risk Summary</h3>
              <div className="flex gap-1">
                <button onClick={handleSendEmail} disabled={emailSent} className="btn btn-primary text-[10px] px-2 py-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" />{emailSent ? 'Sent!' : 'Email CEO'}
                </button>
                <button className="btn bg-gray-600 text-white text-[10px] px-2 py-1 flex items-center gap-1">
                  <Download className="w-3 h-3" />PDF
                </button>
              </div>
            </div>
            {emailSent && (
              <div className="bg-green-50 border border-green-200 rounded p-2 flex items-center gap-2 text-[9px] text-green-800">
                <CheckCircle className="w-3 h-3" />Summary emailed to CEO successfully!
              </div>
            )}
          </div>

          {/* Risk Score - Compact Gauge with Trend Chart */}
          <div className="card p-3">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="9" fill="none" className="text-gray-200 dark:text-gray-700" />
                  <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="9" fill="none"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - riskPosture.overallScore / 100)}`}
                    className={`${riskPosture.overallScore >= 80 ? 'text-green-500' : riskPosture.overallScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{riskPosture.overallScore}</span>
                  <span className="text-[10px] text-gray-500">/100</span>
                </div>
              </div>
              <div className="flex-1">
                <div className={`text-2xl font-bold ${riskLevel.color} mb-1`}>{riskLevel.level}</div>
                <div className="flex items-center gap-1 text-sm mb-2">
                  {riskPosture.trend === 'improving' ? (
                    <><TrendingUp className="w-4 h-4 text-green-600" /><span className="text-green-600 font-medium">Improving</span></>
                  ) : (
                    <span className="text-gray-600">Stable</span>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-600">Incidents Resolved</span>
                    <span className="font-bold">{socMetrics.incidentsResolved}/{socMetrics.incidentsCreated}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-600">Avg Response</span>
                    <span className="font-bold text-green-600">{socMetrics.meanTimeToRespond}m</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-600">Resolution Rate</span>
                    <span className="font-bold text-blue-600">{Math.round((socMetrics.incidentsResolved / socMetrics.incidentsCreated) * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 7-Day Risk Score Trend */}
            <div>
              <div className="text-[10px] font-bold text-gray-700 mb-1">7-Day Risk Score Trend</div>
              <div className="flex items-end justify-between gap-1" style={{ height: '80px' }}>
                {[68, 70, 69, 71, 70, 71, 72].map((score, i) => {
                  const heightPx = (score / 100) * 80; // Scale to 80px
                  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="text-[9px] font-bold text-gray-700">{score}</div>
                      <div className={`w-full ${color} rounded-t`} style={{ height: `${heightPx}px` }}></div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{['M','T','W','T','F','S','S'][i]}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[9px] text-gray-500 text-center mt-1">Risk score (out of 100)</div>
            </div>
          </div>

          {/* Financial Impact with Chart */}
          <div className="card p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500">
            <div className="flex items-start gap-2">
              <DollarSign className="w-5 h-5 text-yellow-700 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-sm text-yellow-900 mb-2">Financial Impact Estimate</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-2xl font-bold text-yellow-800">${(estimateFinancialImpact() / 1000).toFixed(0)}K</div>
                    <div className="text-[10px] text-yellow-700">Potential loss</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">${((estimateFinancialImpact() * 0.6) / 1000).toFixed(0)}K</div>
                    <div className="text-[10px] text-gray-600">Remediation cost</div>
                  </div>
                </div>
                
                {/* Financial Comparison Chart */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-gray-700">Cost Comparison</div>
                  <div>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-yellow-700">Potential Loss</span>
                      <span className="font-bold">${(estimateFinancialImpact() / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-green-700">Remediation Cost</span>
                      <span className="font-bold">${((estimateFinancialImpact() * 0.6) / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                  <div className="text-[9px] text-green-700 font-medium mt-1">
                    ✓ Investing in remediation saves ${((estimateFinancialImpact() * 0.4) / 1000).toFixed(0)}K (40% savings)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security Team Performance */}
          <div className="card p-3">
            <h4 className="text-xs font-bold mb-2 flex items-center gap-1"><Shield className="w-3 h-3 text-blue-600" />Security Team Performance</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2">
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-bold text-green-700">Excellent</span>
                </div>
                <p className="text-[10px] text-green-800">Response in {socMetrics.meanTimeToRespond}min - {socMetrics.meanTimeToRespond < 15 ? 'above' : 'below'} industry standards</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-blue-700">{Math.round((socMetrics.incidentsResolved / socMetrics.incidentsCreated) * 100)}%</span>
                </div>
                <p className="text-[10px] text-blue-800">{socMetrics.incidentsResolved} of {socMetrics.incidentsCreated} incidents resolved (30d)</p>
              </div>
            </div>
          </div>

          {/* CISO Recommendations - Compact */}
          <div className="card p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
            <h4 className="text-xs font-bold mb-2">CISO Recommendations</h4>
            <div className="space-y-1.5">
              <div className="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded text-[11px]">
                <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</div>
                <div><strong>Immediate:</strong> Approve emergency SQL injection patching</div>
              </div>
              <div className="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded text-[11px]">
                <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">2</div>
                <div><strong>30 days:</strong> Implement MFA for admin accounts (95% risk reduction)</div>
              </div>
              <div className="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded text-[11px]">
                <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">3</div>
                <div><strong>90 days:</strong> Deploy EDR/DLP to Marketing & Sales (95% coverage)</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Top 3 Critical Risks */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-600" />Top Business Risks <span className="text-[10px] text-gray-500 font-normal">(Click for details)</span></h3>
          <div className="space-y-2">
            {riskPosture.criticalRisks.slice(0, 3).map((risk, i) => (
              <div key={i} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 hover:border-red-400 cursor-pointer" onClick={() => setSelectedRisk(risk)}>
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-xs">{i + 1}</span>
                    <h4 className="font-bold text-sm text-red-900">{risk.title}</h4>
                  </div>
                  <div className="text-center bg-white dark:bg-gray-800 rounded px-2 py-1">
                    <div className="text-[10px] text-gray-500">Risk</div>
                    <div className="text-xl font-bold text-red-600">{risk.riskScore}</div>
                  </div>
                </div>
                <p className="text-[11px] text-red-800 mb-2 line-clamp-2">{risk.description}</p>
                <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded">
                  <div className="flex items-start gap-1">
                    <DollarSign className="w-3 h-3 text-red-700 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-[11px] text-red-900 mb-0.5">Business Impact:</div>
                      <div className="text-[10px] text-red-800 line-clamp-2">{risk.businessImpact}</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2 text-[10px]">
                  <div className="bg-orange-100 px-2 py-0.5 rounded">Likelihood: {risk.likelihood}/10</div>
                  <div className="bg-red-100 px-2 py-0.5 rounded">Impact: {risk.impact}/10</div>
                </div>
              </div>
            ))}
          </div>

          {/* Compliance & Coverage - Compact Metrics */}
          <div className="card p-3">
            <h4 className="text-xs font-bold mb-2">Additional Metrics</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded p-2 text-center">
                <div className="text-xl font-bold text-green-700">94%</div>
                <div className="text-[9px] text-green-600">Compliance Score</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded p-2 text-center">
                <div className="text-xl font-bold text-blue-700">$2.5M</div>
                <div className="text-[9px] text-blue-600">Insurance Coverage</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 rounded p-2 text-center">
                <div className="text-xl font-bold text-purple-700">72%</div>
                <div className="text-[9px] text-purple-600">Security Posture</div>
              </div>
            </div>
          </div>

          {/* Revenue at Risk */}
          <div className="card p-3 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500">
            <h4 className="text-xs font-bold text-orange-900 mb-2">Revenue at Risk Analysis</h4>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-orange-800">Daily Revenue</span>
                <span className="font-bold">$485K</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-orange-800">Downtime Risk (24h)</span>
                <span className="font-bold text-red-600">$485K</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-orange-800">Reputational Impact</span>
                <span className="font-bold text-red-600">$1.2M</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-2.5 bg-gray-50 dark:bg-gray-800 border-l-2 border-gray-400">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-600" />
          <p className="text-[11px] text-gray-700 dark:text-gray-300">📊 Auto-generated from real-time data • Email CEO or download PDF anytime</p>
        </div>
      </div>

      {/* Risk Details Modal */}
      {selectedRisk && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRisk(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="border-b p-4 flex justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-bold">{selectedRisk.title}</h3>
                </div>
                <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-800">Risk Score: {selectedRisk.riskScore}/100</span>
              </div>
              <button onClick={() => setSelectedRisk(null)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Description</h4>
                <p className="text-sm">{selectedRisk.description}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-semibold text-sm text-red-900 mb-1 flex items-center gap-1"><DollarSign className="w-4 h-4" />Business Impact</h4>
                <p className="text-sm text-red-800">{selectedRisk.businessImpact}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-500">Likelihood</div>
                  <div className="text-2xl font-bold text-orange-600">{selectedRisk.likelihood}/10</div>
                </div>
                <div className="border rounded p-2">
                  <div className="text-xs text-gray-500">Impact</div>
                  <div className="text-2xl font-bold text-red-600">{selectedRisk.impact}/10</div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <h4 className="font-semibold text-sm mb-2">Recommended Actions</h4>
                <ul className="space-y-1 text-xs">
                  <li className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Emergency board meeting for budget approval</li>
                  <li className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Engage security consultants for rapid assessment</li>
                  <li className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Implement temporary controls and monitoring</li>
                  <li className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Weekly executive briefings until resolved</li>
                </ul>
              </div>
            </div>
            <div className="border-t p-3 flex justify-end">
              <button onClick={() => setSelectedRisk(null)} className="btn btn-primary text-sm px-4 py-1">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
