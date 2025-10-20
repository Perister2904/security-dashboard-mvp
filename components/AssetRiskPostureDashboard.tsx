"use client";

import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Server, Laptop, Network, X, Calendar, Activity } from 'lucide-react';
import { sampleAssets, currentRiskPosture, Asset } from '@/lib/soc-data';

export default function AssetRiskPostureDashboard() {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const assets = sampleAssets;
  const riskPosture = currentRiskPosture;

  // Calculate coverage statistics
  const totalAssets = assets.length;
  const compliantAssets = assets.filter(a => a.complianceStatus === 'Compliant').length;
  const assetsWithEDR = assets.filter(a => a.edr.installed).length;
  const assetsWithDLP = assets.filter(a => a.dlp.installed).length;
  const assetsWithAV = assets.filter(a => a.antivirus.installed).length;

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'Server':
        return <Server className="w-5 h-5" />;
      case 'Workstation':
      case 'Mobile':
        return <Laptop className="w-5 h-5" />;
      case 'Network Device':
        return <Network className="w-5 h-5" />;
      default:
        return <Shield className="w-5 h-5" />;
    }
  };

  const getToolStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Inactive':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'Not Installed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary Header */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Asset & Risk Posture Management
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Comprehensive view of asset security coverage and organizational risk posture
        </p>
      </div>

      {/* Risk Posture Score */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Overall Security Posture
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1">
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - riskPosture.overallScore / 100)}`}
                    className={`${
                      riskPosture.overallScore >= 80
                        ? 'text-green-500'
                        : riskPosture.overallScore >= 60
                        ? 'text-yellow-500'
                        : 'text-red-500'
                    } transition-all duration-1000`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {riskPosture.overallScore}
                  </span>
                  <span className="text-sm text-gray-500">/100</span>
                </div>
              </div>
              <div className="mt-4 text-center">
                <div className="font-medium text-gray-900 dark:text-white">
                  Security Posture Score
                </div>
                <div className={`text-sm mt-1 flex items-center gap-1 justify-center ${
                  riskPosture.trend === 'improving' ? 'text-green-600' :
                  riskPosture.trend === 'worsening' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {riskPosture.trend === 'improving' ? '↑ Improving' :
                   riskPosture.trend === 'worsening' ? '↓ Worsening' :
                   '→ Stable'}
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Coverage Statistics
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round((compliantAssets / totalAssets) * 100)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Assets Compliant
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {compliantAssets} of {totalAssets} assets
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((assetsWithEDR / totalAssets) * 100)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  EDR Coverage
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {assetsWithEDR} of {totalAssets} assets
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round((assetsWithDLP / totalAssets) * 100)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  DLP Coverage
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {assetsWithDLP} of {totalAssets} assets
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round((assetsWithAV / totalAssets) * 100)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Antivirus Coverage
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {assetsWithAV} of {totalAssets} assets
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Risks */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Top Critical Risks
        </h3>
        <div className="space-y-4">
          {riskPosture.criticalRisks.map((risk, index) => (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {risk.title}
                    </h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      risk.riskScore >= 70 ? 'bg-red-100 text-red-800' :
                      risk.riskScore >= 50 ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      Risk Score: {risk.riskScore}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {risk.description}
                  </p>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                      Business Impact:
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      {risk.businessImpact}
                    </div>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-xs text-gray-500 mb-1">Likelihood</div>
                  <div className="text-xl font-bold text-orange-600">{risk.likelihood}/10</div>
                  <div className="text-xs text-gray-500 mt-2 mb-1">Impact</div>
                  <div className="text-xl font-bold text-red-600">{risk.impact}/10</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage Gaps */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Security Coverage Gaps
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {riskPosture.coverageGaps.map((gap, index) => (
            <div
              key={index}
              className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-900 dark:text-yellow-100">
                  {gap.department}
                </span>
              </div>
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-1">
                {gap.assetCount}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                Assets Missing Tools
              </div>
              <div className="flex flex-wrap gap-1">
                {gap.missingTools.map((tool, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-xs"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Asset Inventory */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Asset Inventory & Security Tools Status
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Click any asset row for detailed information
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Asset</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Department</th>
                <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">EDR</th>
                <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">DLP</th>
                <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-white">Antivirus</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr 
                  key={asset.id} 
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`${
                        asset.criticality === 'Critical' ? 'text-red-600' :
                        asset.criticality === 'High' ? 'text-orange-600' :
                        'text-blue-600'
                      }`}>
                        {getAssetIcon(asset.type)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {asset.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {asset.type} • {asset.ipAddress || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {asset.department}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col items-center">
                      {getToolStatusBadge(asset.edr.status)}
                      {asset.edr.version && (
                        <span className="text-xs text-gray-500 mt-1">
                          v{asset.edr.version}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col items-center">
                      {getToolStatusBadge(asset.dlp.status)}
                      {asset.dlp.version && (
                        <span className="text-xs text-gray-500 mt-1">
                          v{asset.dlp.version}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col items-center">
                      {getToolStatusBadge(asset.antivirus.status)}
                      {asset.antivirus.version && (
                        <span className="text-xs text-gray-500 mt-1">
                          v{asset.antivirus.version}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      asset.complianceStatus === 'Compliant' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      asset.complianceStatus === 'Partially Compliant' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {asset.complianceStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Automated Asset Discovery Active
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              System continuously scans the network for new assets and monitors security tool coverage. 
              Critical gaps trigger automatic alerts to IT and Security teams.
            </p>
          </div>
        </div>
      </div>

      {/* Asset Details Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAsset(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  selectedAsset.criticality === 'Critical' ? 'bg-red-100 text-red-600' :
                  selectedAsset.criticality === 'High' ? 'bg-orange-100 text-orange-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {getAssetIcon(selectedAsset.type)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedAsset.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedAsset.type} • {selectedAsset.ipAddress || 'No IP'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAsset(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Asset Overview */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Asset Overview
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Department</div>
                    <div className="font-medium">{selectedAsset.department}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Criticality</div>
                    <div className="font-medium">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        selectedAsset.criticality === 'Critical' ? 'bg-red-100 text-red-800' :
                        selectedAsset.criticality === 'High' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedAsset.criticality}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Department</div>
                    <div className="font-medium">{selectedAsset.department}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Compliance Status</div>
                    <div className="font-medium">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        selectedAsset.complianceStatus === 'Compliant' ? 'bg-green-100 text-green-800' :
                        selectedAsset.complianceStatus === 'Partially Compliant' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedAsset.complianceStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Tools Status */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Security Tools Coverage
                </h4>
                <div className="space-y-3">
                  {/* EDR */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Endpoint Detection & Response (EDR)</span>
                        {getToolStatusBadge(selectedAsset.edr.status)}
                      </div>
                      {selectedAsset.edr.version && (
                        <span className="text-sm text-gray-500">Version {selectedAsset.edr.version}</span>
                      )}
                    </div>
                    {selectedAsset.edr.lastUpdate && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        Last Updated: {selectedAsset.edr.lastUpdate}
                      </div>
                    )}
                    {selectedAsset.edr.status === 'Not Installed' && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        ⚠️ Action Required: EDR installation needed for endpoint protection
                      </div>
                    )}
                  </div>

                  {/* DLP */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Data Loss Prevention (DLP)</span>
                        {getToolStatusBadge(selectedAsset.dlp.status)}
                      </div>
                      {selectedAsset.dlp.version && (
                        <span className="text-sm text-gray-500">Version {selectedAsset.dlp.version}</span>
                      )}
                    </div>
                    {selectedAsset.dlp.lastUpdate && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        Last Updated: {selectedAsset.dlp.lastUpdate}
                      </div>
                    )}
                    {selectedAsset.dlp.status === 'Not Installed' && (
                      <div className="mt-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                        ⚠️ Recommended: DLP installation for data protection
                      </div>
                    )}
                  </div>

                  {/* Antivirus */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Antivirus Protection</span>
                        {getToolStatusBadge(selectedAsset.antivirus.status)}
                      </div>
                      {selectedAsset.antivirus.version && (
                        <span className="text-sm text-gray-500">Version {selectedAsset.antivirus.version}</span>
                      )}
                    </div>
                    {selectedAsset.antivirus.lastUpdate && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        Last Updated: {selectedAsset.antivirus.lastUpdate}
                      </div>
                    )}
                    {selectedAsset.antivirus.status === 'Inactive' && (
                      <div className="mt-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                        ⚠️ Alert: Antivirus is installed but not active
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recommended Actions */}
              {(selectedAsset.edr.status === 'Not Installed' || 
                selectedAsset.dlp.status === 'Not Installed' || 
                selectedAsset.antivirus.status !== 'Active') && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                    Recommended Actions
                  </h4>
                  <ul className="space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                    {selectedAsset.edr.status === 'Not Installed' && (
                      <li>• Install and configure EDR solution immediately</li>
                    )}
                    {selectedAsset.dlp.status === 'Not Installed' && (
                      <li>• Deploy DLP agent to protect sensitive data</li>
                    )}
                    {selectedAsset.antivirus.status !== 'Active' && (
                      <li>• Activate or reinstall antivirus protection</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
              <button 
                onClick={() => setSelectedAsset(null)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
