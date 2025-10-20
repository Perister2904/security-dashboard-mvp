"use client";

import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Server, Laptop, Network, X, Calendar } from 'lucide-react';
import { sampleAssets, currentRiskPosture, Asset } from '@/lib/soc-data';

export default function AssetRiskPostureDashboard() {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<typeof currentRiskPosture.criticalRisks[0] | null>(null);
  const assets = sampleAssets;
  const riskPosture = currentRiskPosture;

  const totalAssets = assets.length;
  const compliantAssets = assets.filter(a => a.complianceStatus === 'Compliant').length;
  const assetsWithEDR = assets.filter(a => a.edr.installed).length;
  const assetsWithDLP = assets.filter(a => a.dlp.installed).length;
  const assetsWithAV = assets.filter(a => a.antivirus.installed).length;

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'Server': return <Server className="w-4 h-4" />;
      case 'Workstation':
      case 'Mobile': return <Laptop className="w-4 h-4" />;
      case 'Network Device': return <Network className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const getToolStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'Inactive': return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      case 'Not Installed': return <XCircle className="w-3 h-3 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-2">
      {/* ULTRA COMPACT 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        
        {/* LEFT: Risk Posture + Coverage Stats + Gaps */}
        <div className="space-y-2">
          {/* Posture Score & Stats - Side by Side */}
          <div className="grid grid-cols-3 gap-2">
            {/* Score Gauge */}
            <div className="card p-2">
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="none" className="text-gray-200 dark:text-gray-700" />
                    <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="none"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - riskPosture.overallScore / 100)}`}
                      className={`${riskPosture.overallScore >= 80 ? 'text-green-500' : riskPosture.overallScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold">{riskPosture.overallScore}</span>
                    <span className="text-[8px] text-gray-500">/100</span>
                  </div>
                </div>
                <div className="text-[9px] font-medium mt-1">Posture Score</div>
                <div className={`text-[8px] ${riskPosture.trend === 'improving' ? 'text-green-600' : 'text-gray-600'}`}>
                  {riskPosture.trend === 'improving' ? '↑ Improving' : '→ Stable'}
                </div>
              </div>
            </div>

            {/* Coverage Stats - 2x2 Grid */}
            <div className="col-span-2 grid grid-cols-2 gap-1.5">
              <div className="card p-1.5">
                <div className="text-lg font-bold text-green-600">{Math.round((compliantAssets / totalAssets) * 100)}%</div>
                <div className="text-[8px] text-gray-600">Compliant</div>
                <div className="text-[7px] text-gray-500">{compliantAssets}/{totalAssets}</div>
              </div>
              <div className="card p-1.5">
                <div className="text-lg font-bold text-blue-600">{Math.round((assetsWithEDR / totalAssets) * 100)}%</div>
                <div className="text-[8px] text-gray-600">EDR</div>
                <div className="text-[7px] text-gray-500">{assetsWithEDR}/{totalAssets}</div>
              </div>
              <div className="card p-1.5">
                <div className="text-lg font-bold text-purple-600">{Math.round((assetsWithDLP / totalAssets) * 100)}%</div>
                <div className="text-[8px] text-gray-600">DLP</div>
                <div className="text-[7px] text-gray-500">{assetsWithDLP}/{totalAssets}</div>
              </div>
              <div className="card p-1.5">
                <div className="text-lg font-bold text-orange-600">{Math.round((assetsWithAV / totalAssets) * 100)}%</div>
                <div className="text-[8px] text-gray-600">Antivirus</div>
                <div className="text-[7px] text-gray-500">{assetsWithAV}/{totalAssets}</div>
              </div>
            </div>
          </div>

          {/* Critical Risks - Compact Cards */}
          <div className="card p-2">
            <h4 className="text-[10px] font-bold mb-1.5">Top Critical Risks <span className="text-[8px] text-gray-500">(Click for details)</span></h4>
            <div className="space-y-1">
              {riskPosture.criticalRisks.map((risk, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded p-1.5 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer" onClick={() => setSelectedRisk(risk)}>
                  <div className="flex justify-between items-start mb-0.5">
                    <h5 className="font-medium text-[10px] line-clamp-1 flex-1">{risk.title}</h5>
                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold whitespace-nowrap ml-1 ${risk.riskScore >= 70 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                      {risk.riskScore}
                    </span>
                  </div>
                  <p className="text-[8px] text-gray-600 line-clamp-1">{risk.description}</p>
                  <div className="flex gap-2 mt-0.5 text-[7px] text-gray-500">
                    <span>L:{risk.likelihood}/10</span>
                    <span>I:{risk.impact}/10</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coverage Gaps - Compact */}
          <div className="card p-2">
            <h4 className="text-[10px] font-bold mb-1">Coverage Gaps</h4>
            <div className="grid grid-cols-3 gap-1">
              {riskPosture.coverageGaps.map((gap, i) => (
                <div key={i} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-1.5">
                  <div className="text-sm font-bold text-yellow-800">{gap.assetCount}</div>
                  <div className="text-[8px] text-yellow-700">{gap.department}</div>
                  <div className="text-[7px] text-yellow-600">{gap.missingTools.join(', ')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Asset Type Distribution */}
          <div className="card p-2">
            <h4 className="text-[10px] font-bold mb-1">Asset Distribution</h4>
            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px]">
                <span className="flex items-center gap-1"><Server className="w-3 h-3" />Servers</span>
                <span className="font-bold">{assets.filter(a => a.type === 'Server').length}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="flex items-center gap-1"><Laptop className="w-3 h-3" />Workstations</span>
                <span className="font-bold">{assets.filter(a => a.type === 'Workstation').length}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="flex items-center gap-1"><Network className="w-3 h-3" />Network Devices</span>
                <span className="font-bold">{assets.filter(a => a.type === 'Network Device').length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Asset Inventory Table */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-xs font-bold">Asset Inventory</h3>
            <span className="text-[8px] text-gray-500">Click row for details</span>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-[9px]">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-1.5 px-2 font-medium">Asset</th>
                  <th className="text-left py-1.5 px-2 font-medium">Dept</th>
                  <th className="text-center py-1.5 px-1 font-medium">EDR</th>
                  <th className="text-center py-1.5 px-1 font-medium">DLP</th>
                  <th className="text-center py-1.5 px-1 font-medium">AV</th>
                  <th className="text-left py-1.5 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer" onClick={() => setSelectedAsset(asset)}>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1">
                        <div className={`${asset.criticality === 'Critical' ? 'text-red-600' : asset.criticality === 'High' ? 'text-orange-600' : 'text-blue-600'}`}>
                          {getAssetIcon(asset.type)}
                        </div>
                        <div>
                          <div className="font-medium line-clamp-1">{asset.name}</div>
                          <div className="text-[7px] text-gray-500">{asset.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-gray-600">{asset.department.split(' ')[0]}</td>
                    <td className="py-1.5 px-1 text-center">{getToolStatusBadge(asset.edr.status)}</td>
                    <td className="py-1.5 px-1 text-center">{getToolStatusBadge(asset.dlp.status)}</td>
                    <td className="py-1.5 px-1 text-center">{getToolStatusBadge(asset.antivirus.status)}</td>
                    <td className="py-1.5 px-2">
                      <span className={`px-1 py-0.5 rounded text-[7px] font-medium ${
                        asset.complianceStatus === 'Compliant' ? 'bg-green-100 text-green-800' :
                        asset.complianceStatus === 'Partially Compliant' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {asset.complianceStatus === 'Compliant' ? '✓ OK' :
                         asset.complianceStatus === 'Partially Compliant' ? '⚠ Partial' : '✗ Non'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card p-2 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500">
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3 text-blue-600" />
          <p className="text-[9px] text-blue-800 dark:text-blue-200">🔍 Auto asset discovery active • Gaps trigger alerts to IT & Security</p>
        </div>
      </div>

      {/* Asset Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAsset(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b p-4 flex justify-between">
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded flex items-center justify-center ${selectedAsset.criticality === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                  {getAssetIcon(selectedAsset.type)}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedAsset.name}</h3>
                  <p className="text-xs text-gray-600">{selectedAsset.type} • {selectedAsset.ipAddress}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <div className="text-[10px] text-gray-500">Department</div>
                  <div className="text-xs font-medium">{selectedAsset.department}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <div className="text-[10px] text-gray-500">Criticality</div>
                  <div className="text-xs"><span className={`px-2 py-0.5 rounded ${selectedAsset.criticality === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>{selectedAsset.criticality}</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1"><Shield className="w-4 h-4" />Security Tools</h4>
                <div className="space-y-2">
                  {/* EDR */}
                  <div className="border rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">EDR</span>
                        {getToolStatusBadge(selectedAsset.edr.status)}
                      </div>
                      {selectedAsset.edr.version && <span className="text-[10px] text-gray-500">v{selectedAsset.edr.version}</span>}
                    </div>
                    {selectedAsset.edr.lastUpdate && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-600">
                        <Calendar className="w-3 h-3" />Updated: {new Date(selectedAsset.edr.lastUpdate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {/* DLP */}
                  <div className="border rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">DLP</span>
                        {getToolStatusBadge(selectedAsset.dlp.status)}
                      </div>
                      {selectedAsset.dlp.version && <span className="text-[10px] text-gray-500">v{selectedAsset.dlp.version}</span>}
                    </div>
                    {selectedAsset.dlp.status === 'Not Installed' && <div className="text-[9px] text-orange-600 bg-orange-50 p-1 rounded mt-1">⚠️ Recommended: Install DLP</div>}
                  </div>
                  {/* AV */}
                  <div className="border rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Antivirus</span>
                        {getToolStatusBadge(selectedAsset.antivirus.status)}
                      </div>
                      {selectedAsset.antivirus.version && <span className="text-[10px] text-gray-500">v{selectedAsset.antivirus.version}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t p-3 flex justify-end">
              <button onClick={() => setSelectedAsset(null)} className="btn btn-primary text-sm px-4 py-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Risk Modal */}
      {selectedRisk && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRisk(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b p-4 flex justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1">{selectedRisk.title}</h3>
                <span className={`px-2 py-1 rounded text-xs font-bold ${selectedRisk.riskScore >= 70 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                  Risk Score: {selectedRisk.riskScore}/100
                </span>
              </div>
              <button onClick={() => setSelectedRisk(null)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Description</h4>
                <p className="text-sm">{selectedRisk.description}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 p-3 rounded">
                <h4 className="font-semibold text-sm text-red-900 mb-1">Business Impact</h4>
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
            </div>
            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t p-3 flex justify-end">
              <button onClick={() => setSelectedRisk(null)} className="btn btn-primary text-sm px-4 py-1">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
