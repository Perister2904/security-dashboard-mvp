"use client";

import { useState, useEffect } from "react";
import { Database, Wifi, WifiOff, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { dataSources, DataSource } from "@/lib/data";

export function DataSourcesPanel() {
  const [sources, setSources] = useState<DataSource[]>(dataSources);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time updates
      setSources(currentSources => 
        currentSources.map(source => ({
          ...source,
          recordsProcessed: source.recordsProcessed + Math.floor(Math.random() * 100),
          lastUpdate: Math.random() > 0.7 ? "Just now" : source.lastUpdate,
          status: Math.random() > 0.95 ? 'Degraded' : source.status
        }))
      );
      setLastRefresh(new Date());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Connected': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Degraded': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'Offline': return <WifiOff className="w-4 h-4 text-red-500" />;
      default: return <Wifi className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    const colors = {
      'SIEM': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'SOAR': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'EDR': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Network': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Database': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      'API': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const connectedSources = sources.filter(s => s.status === 'Connected').length;
  const totalSources = sources.length;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Data Sources</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>Updated {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">System Health</span>
          <span className="text-sm font-bold text-green-600">
            {connectedSources}/{totalSources} Connected
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(connectedSources / totalSources) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {sources.map((source, index) => (
          <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-3">
              {getStatusIcon(source.status)}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{source.name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(source.type)}`}>
                    {source.type}
                  </span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {source.recordsProcessed.toLocaleString()} records processed
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {source.lastUpdate}
              </div>
              <div className={`text-xs font-medium ${
                source.status === 'Connected' ? 'text-green-600' :
                source.status === 'Degraded' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {source.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}