"use client";

import { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Mail, Download, Shield, DollarSign } from 'lucide-react';
import { currentRiskPosture, currentSOCMetrics } from '@/lib/soc-data';

export default function CEORiskSummary() {
  const [emailSent, setEmailSent] = useState(false);
  const riskPosture = currentRiskPosture;

  const handleSendEmail = () => {
    // Simulate sending email
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  const handleDownloadReport = () => {
    // Simulate downloading PDF report
    alert('Executive Risk Report downloaded! (PDF generation would happen here)');
  };

  // Calculate overall risk level
  const getRiskLevel = (score: number): { level: string; color: string; bgColor: string } => {
    if (score >= 80) return { level: 'Low Risk', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900' };
    if (score >= 60) return { level: 'Medium Risk', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900' };
    if (score >= 40) return { level: 'High Risk', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900' };
    return { level: 'Critical Risk', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900' };
  };

  const riskLevel = getRiskLevel(riskPosture.overallScore);

  // Calculate financial impact estimate
  const estimateFinancialImpact = (risks: typeof riskPosture.criticalRisks) => {
    // Simple estimation based on risk scores
    const totalRisk = risks.reduce((sum, r) => sum + r.riskScore, 0);
    return Math.round(totalRisk * 15000); // $15k per risk point as example
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Executive Risk Summary for CEO
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              High-level security posture and business risk overview
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSendEmail}
              className="btn btn-primary flex items-center gap-2"
              disabled={emailSent}
            >
              <Mail className="w-4 h-4" />
              {emailSent ? 'Email Sent!' : 'Email to CEO'}
            </button>
            <button
              onClick={handleDownloadReport}
              className="btn bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>

        {emailSent && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Executive Risk Summary has been emailed to CEO successfully!
            </span>
          </div>
        )}
      </div>

      {/* Overall Risk Status - Big Visual */}
      <div className="card p-8">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-4">
            Current Organizational Risk Level
          </h3>
          <div className={`inline-flex items-center justify-center w-48 h-48 rounded-full ${riskLevel.bgColor} mb-4`}>
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">
                {riskPosture.overallScore}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                /100
              </div>
            </div>
          </div>
          <div className={`text-2xl font-bold ${riskLevel.color} mb-2`}>
            {riskLevel.level}
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            {riskPosture.trend === 'improving' ? (
              <>
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-green-600 font-medium">Improving</span>
              </>
            ) : riskPosture.trend === 'worsening' ? (
              <>
                <TrendingDown className="w-5 h-5 text-red-600" />
                <span className="text-red-600 font-medium">Worsening</span>
              </>
            ) : (
              <span className="text-gray-600 font-medium">Stable</span>
            )}
          </div>
        </div>

        {/* Key Metrics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {currentSOCMetrics.incidentsResolved}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Security Incidents Resolved (30 days)
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {currentSOCMetrics.meanTimeToRespond.toFixed(1)}m
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Average Response Time
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {Math.round((currentSOCMetrics.incidentsResolved / currentSOCMetrics.incidentsCreated) * 100)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Incident Resolution Rate
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Critical Risks - Business Language */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Top Business Risks Requiring Attention
        </h3>
        <div className="space-y-4">
          {riskPosture.criticalRisks.slice(0, 3).map((risk, index) => (
            <div key={index} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <h4 className="font-bold text-lg text-red-900 dark:text-red-100">
                      {risk.title}
                    </h4>
                  </div>
                  <p className="text-red-800 dark:text-red-200 mb-3 pl-10">
                    {risk.description}
                  </p>
                  <div className="bg-red-100 dark:bg-red-900/40 p-3 rounded-lg ml-10">
                    <div className="flex items-start gap-2">
                      <DollarSign className="w-5 h-5 text-red-700 mt-0.5" />
                      <div>
                        <div className="font-semibold text-red-900 dark:text-red-100 text-sm mb-1">
                          Business Impact:
                        </div>
                        <div className="text-sm text-red-800 dark:text-red-200">
                          {risk.businessImpact}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ml-4 text-center bg-white dark:bg-gray-800 rounded-lg p-3 min-w-[80px]">
                  <div className="text-xs text-gray-500 mb-1">Risk Score</div>
                  <div className="text-3xl font-bold text-red-600">{risk.riskScore}</div>
                  <div className="text-xs text-gray-500">/100</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Impact Estimate */}
      <div className="card p-6 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6 text-yellow-700" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-lg text-yellow-900 dark:text-yellow-100 mb-2">
              Estimated Financial Impact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-3xl font-bold text-yellow-800 dark:text-yellow-200 mb-1">
                  ${(estimateFinancialImpact(riskPosture.criticalRisks) / 1000).toFixed(0)}K
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  Potential loss if risks materialize
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 mb-1">
                  ${((estimateFinancialImpact(riskPosture.criticalRisks) * 0.6) / 1000).toFixed(0)}K
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Estimated remediation investment needed
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Team Performance */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Security Team Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  Excellent
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Response Performance
                </div>
              </div>
            </div>
            <p className="text-sm text-green-800 dark:text-green-200">
              Security team is responding to threats in an average of {currentSOCMetrics.meanTimeToRespond.toFixed(1)} minutes, 
              which is {currentSOCMetrics.meanTimeToRespond < 15 ? 'above' : 'below'} industry standards.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {Math.round((currentSOCMetrics.incidentsResolved / currentSOCMetrics.incidentsCreated) * 100)}%
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  Resolution Rate
                </div>
              </div>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {currentSOCMetrics.incidentsResolved} out of {currentSOCMetrics.incidentsCreated} security incidents 
              have been successfully resolved in the last 30 days.
            </p>
          </div>
        </div>
      </div>

      {/* CISO Recommendation */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
          CISO Recommendations for CEO
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
              1
            </div>
            <div className="text-sm">
              <strong className="text-gray-900 dark:text-white">Immediate Action:</strong>
              <span className="text-gray-700 dark:text-gray-300 ml-1">
                Approve emergency patching for critical SQL injection vulnerability to prevent potential data breach.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
              2
            </div>
            <div className="text-sm">
              <strong className="text-gray-900 dark:text-white">Short-term (30 days):</strong>
              <span className="text-gray-700 dark:text-gray-300 ml-1">
                Invest in MFA implementation for all administrative accounts to reduce credential theft risk by 95%.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
              3
            </div>
            <div className="text-sm">
              <strong className="text-gray-900 dark:text-white">Medium-term (90 days):</strong>
              <span className="text-gray-700 dark:text-gray-300 ml-1">
                Deploy EDR and DLP solutions to Marketing and Sales departments to achieve 95% organizational coverage.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Email Info */}
      <div className="card p-4 bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-400">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-gray-600 mt-0.5" />
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Note:</strong> This risk summary is automatically generated based on real-time data. 
            You can email it to the CEO at any time or download a PDF version for board meetings.
          </div>
        </div>
      </div>
    </div>
  );
}
