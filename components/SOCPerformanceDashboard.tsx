"use client";

import { Activity, Clock, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { sampleSOCEvents, currentSOCMetrics, sampleRemediationTasks, formatDuration, calculateTimeDiff, getStatusColor } from '@/lib/soc-data';

export default function SOCPerformanceDashboard() {
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
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
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
                <span className="text-xs text-gray-500">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
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
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {task.description}
                  </p>
                </div>
                <div className="text-right">
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

              {/* Steps */}
              <div className="space-y-2 mb-3">
                {task.steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {step.completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-gray-300 rounded-full flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        step.completed
                          ? 'text-gray-500 line-through'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {step.step}
                    </span>
                  </div>
                ))}
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
    </div>
  );
}
