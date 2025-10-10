"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Jan', threats: 65, resolved: 58, pending: 7 },
  { month: 'Feb', threats: 78, resolved: 71, pending: 7 },
  { month: 'Mar', threats: 52, resolved: 49, pending: 3 },
  { month: 'Apr', threats: 91, resolved: 83, pending: 8 },
  { month: 'May', threats: 69, resolved: 64, pending: 5 },
  { month: 'Jun', threats: 43, resolved: 41, pending: 2 },
  { month: 'Jul', threats: 87, resolved: 79, pending: 8 },
  { month: 'Aug', threats: 76, resolved: 72, pending: 4 },
  { month: 'Sep', threats: 59, resolved: 55, pending: 4 },
  { month: 'Oct', threats: 94, resolved: 86, pending: 8 },
];

export default function SecurityTrendsChart() {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Security Threats Trend Analysis
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="month" 
              className="text-gray-600 dark:text-gray-400"
            />
            <YAxis className="text-gray-600 dark:text-gray-400" />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="threats" 
              stroke="#ef4444" 
              strokeWidth={3}
              name="Total Threats"
              dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="resolved" 
              stroke="#10b981" 
              strokeWidth={3}
              name="Resolved"
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="pending" 
              stroke="#f59e0b" 
              strokeWidth={3}
              name="Pending"
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}