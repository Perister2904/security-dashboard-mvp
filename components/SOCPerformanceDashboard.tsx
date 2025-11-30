"use client";

import { useState, useEffect } from 'react';
import { Activity, Clock, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus, X, User, RefreshCw } from 'lucide-react';
import { socAPI } from '@/lib/api';
import { sampleSOCEvents, currentSOCMetrics, sampleRemediationTasks, formatDuration, calculateTimeDiff, getStatusColor, SOCEvent, RemediationTask, SOCMetrics } from '@/lib/soc-data';

export default function SOCPerformanceDashboard() {
  const [selectedEvent, setSelectedEvent] = useState<SOCEvent | null>(null);
  const [selectedTask, setSelectedTask] = useState<RemediationTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  
  // State for data (starts with mock, updates with real)
  const [metrics, setMetrics] = useState<SOCMetrics>(currentSOCMetrics);
  const [events, setEvents] = useState<SOCEvent[]>(sampleSOCEvents);
  const [tasks, setTasks] = useState<RemediationTask[]>(sampleRemediationTasks);

  // Fetch data from backend
  const fetchData = async () => {
    setIsLoading(true);
    
    try {
      const [metricsResponse, incidentsResponse] = await Promise.all([
        socAPI.getMetrics().catch(() => null),
        socAPI.getIncidents({ limit: 10 }).catch(() => null),
      ]);

      if (metricsResponse?.data) {
        setMetrics({
          meanTimeToDetect: metricsResponse.data.mtd || currentSOCMetrics.meanTimeToDetect,
          meanTimeToRespond: metricsResponse.data.mtr || currentSOCMetrics.meanTimeToRespond,
          meanTimeToContain: metricsResponse.data.mtc || currentSOCMetrics.meanTimeToContain,
          meanTimeToResolve: metricsResponse.data.mttr || currentSOCMetrics.meanTimeToResolve,
          alertsGenerated: metricsResponse.data.alerts_24h || currentSOCMetrics.alertsGenerated,
          incidentsCreated: metricsResponse.data.incidents_created || currentSOCMetrics.incidentsCreated,
          incidentsResolved: metricsResponse.data.incidents_resolved || currentSOCMetrics.incidentsResolved,
          falsePositiveRate: metricsResponse.data.false_positive_rate || currentSOCMetrics.falsePositiveRate,
          escalationRate: metricsResponse.data.escalation_rate || currentSOCMetrics.escalationRate,
        });
        setUsingMockData(false);
      } else {
        setUsingMockData(true);
      }

      if (incidentsResponse?.data && Array.isArray(incidentsResponse.data)) {
        const mappedEvents: SOCEvent[] = incidentsResponse.data.map((incident: any) => ({
          id: incident.id,
          title: incident.title || 'Security Incident',
          description: incident.description || '',
          severity: incident.severity || 'Medium',
          status: incident.status || 'Open',
          source: incident.source || 'SIEM',
          timestamp: incident.created_at || new Date().toISOString(),
          detectionTime: incident.detection_time || incident.created_at,
          responseTime: incident.response_time,
          assignedTo: incident.assigned_to || 'Unassigned',
        }));
        if (mappedEvents.length > 0) setEvents(mappedEvents);
      }
    } catch (err) {
      console.error('Failed to fetch SOC data:', err);
      setUsingMockData(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getTrendIcon = (value: number, benchmark: number, lower: boolean = true) => {
    if (lower) {
      if (value < benchmark) return <TrendingDown className="w-3 h-3 text-green-500" />;
      if (value > benchmark) return <TrendingUp className="w-3 h-3 text-red-500" />;
    } else {
      if (value > benchmark) return <TrendingUp className="w-3 h-3 text-green-500" />;
      if (value < benchmark) return <TrendingDown className="w-3 h-3 text-red-500" />;
    }
    return <Minus className="w-3 h-3 text-gray-500" />;
  };

  return (
    <div className="space-y-3">
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
              ? 'Loading live data...' 
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

      {/* COMPACT 3-COLUMN GRID WITH CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        
        {/* LEFT: Metrics + Charts */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="card p-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">MTD</span>
                {getTrendIcon(metrics.meanTimeToDetect, 10, true)}
              </div>
              <div className="text-2xl font-bold text-blue-600">{metrics.meanTimeToDetect}<span className="text-sm">m</span></div>
              <div className="text-[10px] text-gray-500">Target &lt;10</div>
            </div>

            <div className="card p-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">MTR</span>
                {getTrendIcon(metrics.meanTimeToRespond, 15, true)}
              </div>
              <div className="text-2xl font-bold text-green-600">{metrics.meanTimeToRespond}<span className="text-sm">m</span></div>
              <div className="text-[10px] text-gray-500">Target &lt;15</div>
            </div>

            <div className="card p-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">MTC</span>
                {getTrendIcon(metrics.meanTimeToContain, 60, true)}
              </div>
              <div className="text-2xl font-bold text-orange-600">{metrics.meanTimeToContain}<span className="text-sm">m</span></div>
              <div className="text-[10px] text-gray-500">Target &lt;60</div>
            </div>

            <div className="card p-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">MTTR</span>
                <Clock className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-600">{metrics.meanTimeToResolve}<span className="text-sm">h</span></div>
              <div className="text-[10px] text-gray-500">Avg Resolve</div>
            </div>
          </div>

          {/* Response Time Trend Graph */}
          <div className="card p-3">
            <h4 className="text-xs font-bold mb-2">7-Day Response Trend</h4>
            <div className="flex items-end justify-between gap-1" style={{ height: '80px' }}>
              {[15.2, 13.8, 12.1, 14.5, 11.9, 12.3, 12.3].map((val, i) => {
                const heightPx = (val / 20) * 80; // Scale to 80px max height
                const color = val < 13 ? 'bg-green-500' : val < 15 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[9px] font-bold text-gray-700">{val}</div>
                    <div 
                      className={`w-full rounded-t ${color}`}
                      style={{ height: `${heightPx}px` }}
                    />
                    <span className="text-[9px] text-gray-500 mt-1">{['M','T','W','T','F','S','S'][i]}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-[9px] text-gray-500 text-center mt-1">Response time (minutes)</div>
          </div>

          {/* Severity Distribution Pie Chart */}
          <div className="card p-3">
            <h4 className="text-xs font-bold mb-2">Incident Severity (30d)</h4>
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#ef4444" strokeWidth="20" strokeDasharray="25 75" strokeDashoffset="0" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f97316" strokeWidth="20" strokeDasharray="30 70" strokeDashoffset="-25" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#eab308" strokeWidth="20" strokeDasharray="28 72" strokeDashoffset="-55" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#22c55e" strokeWidth="20" strokeDasharray="17 83" strokeDashoffset="-83" />
                </svg>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span>Critical</span>
                  <span className="font-bold">25%</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-full"></span>High</span>
                  <span className="font-bold">30%</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span>Medium</span>
                  <span className="font-bold">28%</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span>Low</span>
                  <span className="font-bold">17%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="card p-2">
              <div className="flex items-center gap-1">
                <Activity className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xl font-bold">{metrics.alertsGenerated}</div>
                  <div className="text-[10px] text-gray-600">Alerts/24h</div>
                </div>
              </div>
            </div>

            <div className="card p-2">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xl font-bold">{Math.round((metrics.incidentsResolved / metrics.incidentsCreated) * 100)}%</div>
                  <div className="text-[10px] text-gray-600">Resolved</div>
                </div>
              </div>
            </div>

            <div className="card p-2">
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div>
                  <div className="text-xl font-bold">{metrics.falsePositiveRate}%</div>
                  <div className="text-[10px] text-gray-600">False Pos</div>
                </div>
              </div>
            </div>

            <div className="card p-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-5 h-5 text-red-600" />
                <div>
                  <div className="text-xl font-bold">{metrics.escalationRate}%</div>
                  <div className="text-[10px] text-gray-600">Escalation</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-3">
            <h4 className="text-xs font-bold mb-2">30d Volume</h4>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Created</span>
                <span className="font-bold">{metrics.incidentsCreated}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Resolved</span>
                <span className="font-bold text-green-600">{metrics.incidentsResolved}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Open</span>
                <span className="font-bold text-orange-600">{metrics.incidentsCreated - metrics.incidentsResolved}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-1.5">
                <div className="bg-green-600 h-1.5 rounded" style={{ width: `${(metrics.incidentsResolved / metrics.incidentsCreated) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="card p-3">
            <h4 className="text-xs font-bold mb-2">Top Analysts</h4>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span>Ahmed (SOC-1)</span>
                <span className="font-bold text-green-600">32 closed</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Fatima (SOC-2)</span>
                <span className="font-bold text-green-600">28 closed</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Ali (SOC-3)</span>
                <span className="font-bold text-blue-600">16 active</span>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE: Events */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold">Recent Events</h3>
            <span className="text-[10px] text-gray-500">Click details</span>
          </div>
          {events.map((event) => (
            <div
              key={event.id}
              className="border border-gray-200 dark:border-gray-700 rounded p-2.5 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
              onClick={() => setSelectedEvent(event)}
            >
              <div className="flex justify-between mb-1">
                <div className="flex gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    event.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                    event.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>{event.severity}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${getStatusColor(event.status)}`}>{event.status}</span>
                </div>
                <span className="text-[10px] text-gray-500">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <h4 className="font-medium text-xs mb-1 line-clamp-1">{event.title}</h4>
              <p className="text-[10px] text-gray-600 line-clamp-1 mb-1">{event.description}</p>
              <div className="flex gap-2 text-[10px] text-gray-500">
                <span className="truncate">{event.source}</span>
                {event.responseTime && (
                  <span className="text-green-600 whitespace-nowrap">⚡{formatDuration(calculateTimeDiff(event.detectionTime, event.responseTime))}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: Tasks */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold">Remediation Tasks</h3>
            <span className="text-[10px] text-gray-500">Click steps</span>
          </div>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="border border-gray-200 dark:border-gray-700 rounded p-2.5 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
              onClick={() => setSelectedTask(task)}
            >
              <div className="flex justify-between mb-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  task.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                  'bg-orange-100 text-orange-800'
                }`}>{task.priority}</span>
                <div className="text-xl font-bold text-blue-600">{task.progress}%</div>
              </div>
              <h4 className="font-medium text-xs mb-1.5 line-clamp-2">{task.title}</h4>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-1.5 mb-1.5">
                <div className="bg-blue-600 h-1.5 rounded" style={{ width: `${task.progress}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span className="truncate">{task.assignedTo}</span>
                <span className={`px-1.5 py-0.5 rounded ${getStatusColor(task.status)}`}>{task.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-2.5 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <p className="text-[11px] text-blue-800 dark:text-blue-200">🔔 Auto email alerts for Critical/High • CISO & SOC leads notified</p>
        </div>
      </div>

      {/* Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b p-4 flex justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1">{selectedEvent.title}</h3>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${selectedEvent.severity === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>{selectedEvent.severity}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedEvent.status)}`}>{selectedEvent.status}</span>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Description</h4>
                <p className="text-sm">{selectedEvent.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <div className="text-[10px] text-gray-500">Source</div>
                  <div className="text-xs font-medium">{selectedEvent.source}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <div className="text-[10px] text-gray-500">Assigned</div>
                  <div className="text-xs font-medium flex items-center gap-1"><User className="w-3 h-3" />{selectedEvent.assignedTo}</div>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t p-3 flex justify-end">
              <button onClick={() => setSelectedEvent(null)} className="btn btn-primary text-sm px-4 py-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b p-4 flex justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1">{selectedTask.title}</h3>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${selectedTask.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>{selectedTask.priority}</span>
                  <span className="text-lg font-bold text-blue-600">{selectedTask.progress}%</span>
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Steps</h4>
                <div className="space-y-2">
                  {selectedTask.steps.map((step, i) => (
                    <div key={i} className={`flex gap-2 p-2 rounded ${step.completed ? 'bg-green-50' : 'bg-gray-50'}`}>
                      {step.completed ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 border-2 rounded-full" />}
                      <div className="text-xs">{step.step}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t p-3 flex justify-end">
              <button onClick={() => setSelectedTask(null)} className="btn btn-primary text-sm px-4 py-1">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
