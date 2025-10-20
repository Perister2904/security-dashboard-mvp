"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const data = [
  { name: 'Compliant', value: 78, color: '#10b981' },
  { name: 'Non-Compliant', value: 15, color: '#ef4444' },
  { name: 'Partially Compliant', value: 7, color: '#f59e0b' },
];

const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

export default function ComplianceChart() {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Compliance Status Overview
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff'
              }}
              formatter={(value) => [`${value}%`, 'Percentage']}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, entry) => `${value}: ${entry?.payload?.value || 0}%`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}