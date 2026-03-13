'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface HourlyCallsChartProps {
  data: Array<{ hour: string; count: number }>;
  loading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1d24] border border-[#2a2d38] rounded-lg px-3 py-2 text-sm">
        <p className="text-[#94a3b8] mb-1">{label}</p>
        <p className="text-indigo-400 font-medium">{payload[0].value} calls</p>
      </div>
    );
  }
  return null;
};

export default function HourlyCallsChart({ data, loading = false }: HourlyCallsChartProps) {
  if (loading) {
    return (
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
        <div className="skeleton h-4 w-32 rounded mb-4" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
      <h3 className="text-[#f1f5f9] font-semibold text-sm mb-4">Calls Last 24 Hours</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#475569', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#callsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
