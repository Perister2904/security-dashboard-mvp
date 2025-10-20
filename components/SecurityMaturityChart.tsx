"use client";

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { subject: 'Network Security', current: 85, target: 95 },
  { subject: 'Data Protection', current: 78, target: 90 },
  { subject: 'Access Control', current: 92, target: 98 },
  { subject: 'Incident Response', current: 73, target: 85 },
  { subject: 'Compliance', current: 88, target: 95 },
  { subject: 'Employee Training', current: 65, target: 80 },
  { subject: 'Vulnerability Mgmt', current: 81, target: 90 },
  { subject: 'Business Continuity', current: 76, target: 88 },
];

export default function SecurityMaturityChart() {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Security Maturity Assessment
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid className="opacity-30" />
            <PolarAngleAxis 
              dataKey="subject" 
              className="text-gray-600 dark:text-gray-400"
              fontSize={12}
            />
            <PolarRadiusAxis 
              domain={[0, 100]} 
              className="text-gray-600 dark:text-gray-400"
              fontSize={10}
            />
            <Radar
              name="Current Score"
              dataKey="current"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Radar
              name="Target Score"
              dataKey="target"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}