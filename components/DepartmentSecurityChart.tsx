"use client";

import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { department: 'IT', vulnerabilities: 45, remediated: 38, avgTime: 2.3 },
  { department: 'Finance', vulnerabilities: 32, remediated: 29, avgTime: 1.8 },
  { department: 'HR', vulnerabilities: 28, remediated: 25, avgTime: 2.1 },
  { department: 'Sales', vulnerabilities: 39, remediated: 31, avgTime: 2.7 },
  { department: 'Marketing', vulnerabilities: 22, remediated: 20, avgTime: 1.5 },
  { department: 'Operations', vulnerabilities: 35, remediated: 32, avgTime: 2.0 },
];

export default function DepartmentSecurityChart() {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Department Security Performance
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="department" 
              className="text-gray-600 dark:text-gray-400"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis yAxisId="left" className="text-gray-600 dark:text-gray-400" />
            <YAxis yAxisId="right" orientation="right" className="text-gray-600 dark:text-gray-400" />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="vulnerabilities" fill="#ef4444" name="Vulnerabilities Found" />
            <Bar yAxisId="left" dataKey="remediated" fill="#10b981" name="Remediated" />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="avgTime" 
              stroke="#f59e0b" 
              strokeWidth={3}
              name="Avg Resolution Time (days)"
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}