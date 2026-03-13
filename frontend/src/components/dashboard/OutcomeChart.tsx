'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface OutcomeChartProps {
  data: Record<string, number>;
  loading?: boolean;
}

const COLORS: Record<string, string> = {
  commitment: '#10b981',
  refused: '#ef4444',
  voicemail: '#f59e0b',
  callback: '#3b82f6',
  no_answer: '#475569',
  completed: '#6366f1',
  failed: '#ef4444',
};

const LABELS: Record<string, string> = {
  commitment: 'Committed',
  refused: 'Refused',
  voicemail: 'Voicemail',
  callback: 'Callback',
  no_answer: 'No Answer',
  completed: 'Completed',
  failed: 'Failed',
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1d24] border border-[#2a2d38] rounded-lg px-3 py-2 text-sm">
        <p className="text-[#94a3b8] mb-1">{payload[0].name}</p>
        <p className="font-medium" style={{ color: payload[0].payload.color }}>
          {payload[0].value} calls
        </p>
      </div>
    );
  }
  return null;
};

export default function OutcomeChart({ data, loading = false }: OutcomeChartProps) {
  if (loading) {
    return (
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
        <div className="skeleton h-4 w-36 rounded mb-4" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>
    );
  }

  const chartData = Object.entries(data).map(([key, value]) => ({
    name: LABELS[key] || key,
    value,
    color: COLORS[key] || '#475569',
  })).filter((d) => d.value > 0);

  if (chartData.length === 0) {
    return (
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
        <h3 className="text-[#f1f5f9] font-semibold text-sm mb-4">Outcome Distribution</h3>
        <div className="flex items-center justify-center h-48 text-[#475569] text-sm">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
      <h3 className="text-[#f1f5f9] font-semibold text-sm mb-4">Outcome Distribution</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
            wrapperStyle={{ paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
