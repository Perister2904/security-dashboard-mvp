"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { category: 'Malware', critical: 12, high: 23, medium: 15, low: 8 },
  { category: 'Phishing', critical: 8, high: 31, medium: 22, low: 12 },
  { category: 'DDoS', critical: 5, high: 18, medium: 28, low: 19 },
  { category: 'Data Breach', critical: 15, high: 12, medium: 9, low: 4 },
  { category: 'Insider Threat', critical: 3, high: 14, medium: 26, low: 17 },
  { category: 'Ransomware', critical: 18, high: 8, medium: 6, low: 2 },
];

export default function ThreatCategoriesChart() {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Threat Categories by Risk Level
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="category" 
              className="text-gray-600 dark:text-gray-400"
              angle={-45}
              textAnchor="end"
              height={80}
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
            <Bar dataKey="critical" stackId="a" fill="#dc2626" name="Critical" />
            <Bar dataKey="high" stackId="a" fill="#ea580c" name="High" />
            <Bar dataKey="medium" stackId="a" fill="#d97706" name="Medium" />
            <Bar dataKey="low" stackId="a" fill="#65a30d" name="Low" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}