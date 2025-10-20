"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { time: '00:00', networkTraffic: 120, anomalies: 2 },
  { time: '04:00', networkTraffic: 98, anomalies: 1 },
  { time: '08:00', networkTraffic: 280, anomalies: 8 },
  { time: '12:00', networkTraffic: 350, anomalies: 12 },
  { time: '16:00', networkTraffic: 420, anomalies: 15 },
  { time: '20:00', networkTraffic: 310, anomalies: 9 },
  { time: '23:59', networkTraffic: 180, anomalies: 4 },
];

export default function NetworkActivityChart() {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        24-Hour Network Activity & Anomalies
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              className="text-gray-600 dark:text-gray-400"
            />
            <YAxis className="text-gray-600 dark:text-gray-400" />
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Area
              type="monotone"
              dataKey="networkTraffic"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#colorTraffic)"
              name="Network Traffic (Mbps)"
            />
            <Area
              type="monotone"
              dataKey="anomalies"
              stroke="#ef4444"
              fillOpacity={1}
              fill="url(#colorAnomalies)"
              name="Anomalies Detected"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}