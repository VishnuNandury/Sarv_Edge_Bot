'use client';

import { useEffect, useState } from 'react';
import { Users, PhoneCall, TrendingUp, Megaphone, RefreshCw } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import HourlyCallsChart from '@/components/dashboard/HourlyCallsChart';
import OutcomeChart from '@/components/dashboard/OutcomeChart';
import RecentCalls from '@/components/dashboard/RecentCalls';
import { dashboardApi } from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/utils';
import type { DashboardStats } from '@/lib/types';

const MOCK_STATS: DashboardStats = {
  total_customers: 1247,
  active_campaigns: 3,
  calls_today: 84,
  calls_this_week: 512,
  payment_rate: 34.2,
  avg_call_duration: 187,
  total_committed_today: 284500,
  calls_by_outcome: {
    commitment: 29,
    refused: 18,
    voicemail: 22,
    callback: 15,
  },
  recent_sessions: [],
  hourly_calls: Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    count: Math.floor(Math.random() * 15),
  })),
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getStats();
      setStats(res.data);
    } catch {
      setStats(MOCK_STATS);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const s = stats || MOCK_STATS;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[#f1f5f9] text-xl font-bold">Overview</h2>
          <p className="text-[#475569] text-sm mt-0.5">
            Last updated: {lastUpdated.toLocaleTimeString('en-IN')}
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-[#1a1d24] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] hover:bg-[#22262f] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Customers"
          value={loading ? '—' : s.total_customers.toLocaleString('en-IN')}
          icon={Users}
          change={5.2}
          changeType="up"
          color="blue"
          subtitle="Across all segments"
          loading={loading}
        />
        <StatCard
          title="Calls Today"
          value={loading ? '—' : s.calls_today.toString()}
          icon={PhoneCall}
          change={12.1}
          changeType="up"
          color="green"
          subtitle={`${s.calls_this_week} this week`}
          loading={loading}
        />
        <StatCard
          title="Payment Rate"
          value={loading ? '—' : `${s.payment_rate.toFixed(1)}%`}
          icon={TrendingUp}
          change={2.4}
          changeType="up"
          color="indigo"
          subtitle={`${formatCurrency(s.total_committed_today)} committed today`}
          loading={loading}
        />
        <StatCard
          title="Active Campaigns"
          value={loading ? '—' : s.active_campaigns.toString()}
          icon={Megaphone}
          change={0}
          changeType="neutral"
          color="orange"
          subtitle={`Avg ${formatDuration(s.avg_call_duration)} call duration`}
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HourlyCallsChart data={s.hourly_calls} loading={loading} />
        <OutcomeChart data={s.calls_by_outcome} loading={loading} />
      </div>

      {/* Recent Calls */}
      <RecentCalls sessions={s.recent_sessions} loading={loading} />
    </div>
  );
}
