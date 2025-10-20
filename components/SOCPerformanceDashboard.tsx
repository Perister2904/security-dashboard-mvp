"use client";

import { useState } from 'react';
import { Activity, Clock, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus, X, User, FileText } from 'lucide-react';
import { sampleSOCEvents, currentSOCMetrics, sampleRemediationTasks, formatDuration, calculateTimeDiff, getStatusColor, SOCEvent, RemediationTask } from '@/lib/soc-data';

export default function SOCPerformanceDashboard() {
  const [selectedEvent, setSelectedEvent] = useState<SOCEvent | null>(null);
  const [selectedTask, setSelectedTask] = useState<RemediationTask | null>(null);
  const metrics = currentSOCMetrics;
  const events = sampleSOCEvents;
  const tasks = sampleRemediationTasks;

  // Calculate trend indicators
  const getTrendIcon = (value: number, benchmark: number, lower: boolean = true) => {
    if (lower) {
      // For metrics where lower is better (like response time)
      if (value < benchmark) return <TrendingDown className="w-4 h-4 text-green-500" />;
      if (value > benchmark) return <TrendingUp className="w-4 h-4 text-red-500" />;
    } else {
      // For metrics where higher is better (like resolution rate)
      if (value > benchmark) return <TrendingUp className="w-4 h-4 text-green-500" />;
      if (value < benchmark) return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary Header */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          SOC Performance Dashboard
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Real-time Security Operations Center metrics and performance indicators
        </p>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mean Time to Detect */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Mean Time to Detect
            </span>
            {getTrendIcon(metrics.meanTimeToDetect, 10, true)}
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {metrics.meanTimeToDetect}
            <span className="text-lg text-gray-500 ml-1">min</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Target: &lt; 10 min
          </div>
        </div>

        {/* Mean Time to Respond */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Mean Time to Respond
            </span>
            {getTrendIcon(metrics.meanTimeToRespond, 15, true)}
          </div>
          <div className="text-3xl font-bold text-green-600">
            {metrics.meanTimeToRespond}
            <span className="text-lg text-gray-500 ml-1">min</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Target: &lt; 15 min
          </div>
        </div>

        {/* Mean Time to Contain */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Mean Time to Contain
            </span>
            {getTrendIcon(metrics.meanTimeToContain, 60, true)}
          </div>
          <div className="text-3xl font-bold text-orange-600">
            {metrics.meanTimeToContain}
            <span className="text-lg text-gray-500 ml-1">min</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Target: &lt; 60 min
          </div>
        </div>

        {/* Resolution Rate */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Resolution Rate
            </span>
            {getTrendIcon((metrics.incidentsResolved / metrics.incidentsCreated) * 100, 80, false)}
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {Math.round((metrics.incidentsResolved / metrics.incidentsCreated) * 100)}
            <span className="text-lg text-gray-500 ml-1">%</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.incidentsResolved} / {metrics.incidentsCreated} incidents
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.alertsGenerated}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Alerts Generated (24h)
              </div>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.falsePositiveRate}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                False Positive Rate
              </div>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.escalationRate}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Escalation Rate
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Events Timeline */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Recent Security Events
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Click any event for full details and response actions
        </p>
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all"
              onClick={() => setSelectedEvent(event)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {event.title}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      event.severity === 'Critical'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : event.severity === 'High'
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        : event.severity === 'Medium'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}
                  >
                    {event.severity}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                    {event.status}
                  </span>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                {event.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>
                  <strong>Source:</strong> {event.source}
                </span>
                <span>
                  <strong>Assigned:</strong> {event.assignedTo}
                </span>
                {event.responseTime && (
                  <span className="text-green-600 dark:text-green-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Response: {formatDuration(calculateTimeDiff(event.detectionTime, event.responseTime))}
                  </span>
                )}
                <span className="text-blue-600 ml-auto">View Details →</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Remediation Tasks */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Active Remediation Tasks
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Click any task for detailed steps and progress tracking
        </p>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all"
              onClick={() => setSelectedTask(task)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {task.title}
                    </h4>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.priority === 'Critical'
                          ? 'bg-red-100 text-red-800'
                          : task.priority === 'High'
                          ? 'bg-orange-100 text-orange-800'
                          : task.priority === 'Medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {task.description}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {task.progress}%
                  </div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  <strong>Assigned:</strong> {task.assignedTo}
                </span>
                <span>
                  <strong>Due:</strong> {new Date(task.dueDate).toLocaleDateString()}
                </span>
                <span className={`px-2 py-1 rounded-full font-medium ${getStatusColor(task.status)}`}>
                  {task.status}
                </span>
                <span className="text-blue-600">View Details →</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Alert Notice */}
      <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Automated Email Alerts Active
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Critical and High severity events are automatically sent to CISO and SOC team leads. 
              You can view the full event timeline above.
            </p>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {selectedEvent.title}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedEvent.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                    selectedEvent.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                    selectedEvent.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {selectedEvent.severity}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedEvent.status)}`}>
                    {selectedEvent.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Event Description</h4>
                <p className="text-gray-700 dark:text-gray-300">{selectedEvent.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Event Source</div>
                  <div className="font-medium">{selectedEvent.source}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Assigned Analyst</div>
                  <div className="font-medium flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {selectedEvent.assignedTo}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Detection Time</div>
                  <div className="font-medium">{new Date(selectedEvent.detectionTime).toLocaleString()}</div>
                </div>
                {selectedEvent.responseTime && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Response Time</div>
                    <div className="font-medium text-green-600">
                      {formatDuration(calculateTimeDiff(selectedEvent.detectionTime, selectedEvent.responseTime))}
                    </div>
                  </div>
                )}
              </div>

              {selectedEvent.responseTime && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Response Actions Taken</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    SOC team responded within {formatDuration(calculateTimeDiff(selectedEvent.detectionTime, selectedEvent.responseTime))} and initiated containment procedures. 
                    Event is currently being monitored and investigated.
                  </p>
                </div>
              )}

              {!selectedEvent.responseTime && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">⚠️ Pending Response</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    This event is awaiting analyst response. Assigned to {selectedEvent.assignedTo}.
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
              <button onClick={() => setSelectedEvent(null)} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {selectedTask.title}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedTask.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                    selectedTask.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                    selectedTask.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {selectedTask.priority} Priority
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                    {selectedTask.status}
                  </span>
                  <span className="text-2xl font-bold text-blue-600">{selectedTask.progress}%</span>
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Task Description</h4>
                <p className="text-gray-700 dark:text-gray-300">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Assigned To</div>
                  <div className="font-medium flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {selectedTask.assignedTo}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Due Date</div>
                  <div className="font-medium">{new Date(selectedTask.dueDate).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Overall Progress</h4>
                  <span className="text-sm font-medium text-blue-600">{selectedTask.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${selectedTask.progress}%` }}
                  />
                </div>
              </div>

              {/* Detailed Steps */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Remediation Steps</h4>
                <div className="space-y-3">
                  {selectedTask.steps.map((step, index) => (
                    <div 
                      key={index} 
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        step.completed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'
                      }`}
                    >
                      <div className="mt-0.5">
                        {step.completed ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-gray-400 rounded-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium ${
                          step.completed ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'
                        }`}>
                          Step {index + 1}: {step.step}
                        </div>
                        {step.completed && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            ✓ Completed
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTask.progress < 100 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Next Steps</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {selectedTask.steps.find(s => !s.completed)?.step || 'All steps completed - awaiting final review'}
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
              <button onClick={() => setSelectedTask(null)} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
