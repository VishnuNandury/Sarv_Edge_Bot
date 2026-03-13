'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { analyticsApi } from '@/lib/api';

const PERIODS = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

// Mock analytics data
function generateMockData(period: string) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const dailyCalls = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - i - 1) * 86400000);
    const label = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const total = Math.floor(Math.random() * 40 + 20);
    const commitment = Math.floor(total * 0.3);
    const refused = Math.floor(total * 0.2);
    const voicemail = Math.floor(total * 0.25);
    const callback = total - commitment - refused - voicemail;
    return { date: label, total, commitment, refused, voicemail, callback };
  });

  const agentComparison = [
    { agent: 'Sarvam', calls: 342, success_rate: 34.2, avg_latency: 1120 },
    { agent: 'Whisper Edge', calls: 189, success_rate: 38.6, avg_latency: 980 },
  ];

  const flowPerformance = [
    { flow: 'Basic', calls: 187, completion_rate: 91.2 },
    { flow: 'Standard', calls: 243, completion_rate: 87.4 },
    { flow: 'Advanced', calls: 101, completion_rate: 76.8 },
  ];

  const latencyTrends = Array.from({ length: Math.min(days, 14) }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    stt: 200 + Math.random() * 150,
    llm: 550 + Math.random() * 300,
    tts: 150 + Math.random() * 120,
  }));

  const dpdDistribution = [
    { range: '0-7d', count: 85 },
    { range: '8-15d', count: 124 },
    { range: '16-30d', count: 98 },
    { range: '31-60d', count: 67 },
    { range: '60+d', count: 45 },
  ];

  const outcomeBreakdown = { commitment: 162, refused: 95, voicemail: 118, callback: 84, no_answer: 72 };

  return { dailyCalls, agentComparison, flowPerformance, latencyTrends, dpdDistribution, outcomeBreakdown };
}

const OUTCOME_COLORS: Record<string, string> = {
  commitment: '#10b981', refused: '#ef4444', voicemail: '#f59e0b', callback: '#3b82f6', no_answer: '#475569',
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1d24] border border-[#2a2d38] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#94a3b8] mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#94a3b8] capitalize">{p.name}:</span>
          <span className="font-medium" style={{ color: p.color }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

interface KPICardProps {
  label: string;
  value: string;
  change: number;
  subtitle: string;
}

function KPICard({ label, value, change, subtitle }: KPICardProps) {
  const isUp = change > 0;
  const isNeutral = change === 0;
  return (
    <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
      <div className="text-xs text-[#475569] mb-2">{label}</div>
      <div className="text-2xl font-bold text-[#f1f5f9] mb-1">{value}</div>
      <div className="flex items-center gap-1">
        <span className={`text-xs flex items-center gap-0.5 ${isNeutral ? 'text-[#475569]' : isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isNeutral ? <Minus size={11} /> : isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(change)}%
        </span>
        <span className="text-[10px] text-[#475569]">{subtitle}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(() => generateMockData('30d'));
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await analyticsApi.getOverview({ period });
      setData(generateMockData(period));
    } catch {
      setData(generateMockData(period));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalCalls = data.dailyCalls.reduce((s, d) => s + d.total, 0);
  const totalCommitted = data.dailyCalls.reduce((s, d) => s + d.commitment, 0);
  const successRate = totalCalls > 0 ? (totalCommitted / totalCalls * 100) : 0;

  const chartProps = {
    style: { background: 'transparent' },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-[#f1f5f9] text-xl font-bold">Analytics</h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#1a1d24] border border-[#2a2d38] rounded-lg p-1 gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === p.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={fetchData} disabled={loading} className="p-2 bg-[#1a1d24] border border-[#2a2d38] rounded-lg text-[#94a3b8] hover:bg-[#22262f] transition-colors disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Calls" value={totalCalls.toLocaleString()} change={8.2} subtitle="vs prev period" />
        <KPICard label="Committed" value={totalCommitted.toLocaleString()} change={12.4} subtitle="vs prev period" />
        <KPICard label="Success Rate" value={`${successRate.toFixed(1)}%`} change={2.1} subtitle="vs prev period" />
        <KPICard label="Avg Latency" value="1,140ms" change={-4.3} subtitle="improvement" />
      </div>

      {/* Daily Calls Chart */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
        <h3 className="text-[#f1f5f9] font-semibold text-sm mb-4">Daily Calls by Outcome</h3>
        <ResponsiveContainer width="100%" height={220} {...chartProps}>
          <AreaChart data={data.dailyCalls} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {Object.entries(OUTCOME_COLORS).map(([key, color]) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {Object.entries(OUTCOME_COLORS).map(([key, color]) => (
              <Area key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={1.5} fill={`url(#grad-${key})`} stackId="1" />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Agent Comparison */}
        <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
          <h3 className="text-[#f1f5f9] font-semibold text-sm mb-4">Agent Comparison</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.agentComparison} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" vertical={false} />
              <XAxis dataKey="agent" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
              <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} name="Calls" />
              <Bar dataKey="success_rate" fill="#10b981" radius={[4, 4, 0, 0]} name="Success %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Flow Performance */}
        <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
          <h3 className="text-[#f1f5f9] font-semibold text-sm mb-4">Flow Performance</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.flowPerformance} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" vertical={false} />
              <XAxis dataKey="flow" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
              <Bar dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Calls" />
              <Bar dataKey="completion_rate" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Completion %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Latency Trends */}
        <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
          <h3 className="text-[#f1f5f9] font-semibold text-sm mb-4">Latency Trends (ms)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.latencyTrends} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v.toUpperCase()}</span>} />
              <Line type="monotone" dataKey="stt" stroke="#10b981" strokeWidth={2} dot={false} name="stt" />
              <Line type="monotone" dataKey="llm" stroke="#6366f1" strokeWidth={2} dot={false} name="llm" />
              <Line type="monotone" dataKey="tts" stroke="#f59e0b" strokeWidth={2} dot={false} name="tts" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Outcome Donut + DPD Distribution */}
        <div className="space-y-5">
          <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
            <h3 className="text-[#f1f5f9] font-semibold text-sm mb-3">Outcome Breakdown</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={Object.entries(data.outcomeBreakdown).map(([k, v]) => ({ name: k, value: v }))}
                    cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value"
                  >
                    {Object.entries(data.outcomeBreakdown).map(([k]) => (
                      <Cell key={k} fill={OUTCOME_COLORS[k] || '#475569'} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1d24', border: '1px solid #2a2d38', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {Object.entries(data.outcomeBreakdown).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: OUTCOME_COLORS[key] || '#475569' }} />
                      <span className="text-[11px] text-[#94a3b8] capitalize">{key}</span>
                    </div>
                    <span className="text-[11px] font-medium text-[#f1f5f9]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DPD Distribution */}
          <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
            <h3 className="text-[#f1f5f9] font-semibold text-sm mb-3">DPD Distribution</h3>
            <div className="space-y-2">
              {data.dpdDistribution.map((d) => {
                const maxCount = Math.max(...data.dpdDistribution.map((x) => x.count));
                const pct = (d.count / maxCount) * 100;
                const color = d.range === '0-7d' ? '#10b981' : d.range === '8-15d' ? '#3b82f6' : d.range === '16-30d' ? '#f59e0b' : '#ef4444';
                return (
                  <div key={d.range} className="flex items-center gap-3">
                    <span className="text-[11px] text-[#475569] w-16 font-mono">{d.range}</span>
                    <div className="flex-1 bg-[#111318] rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-[11px] font-medium text-[#94a3b8] w-8 text-right">{d.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
