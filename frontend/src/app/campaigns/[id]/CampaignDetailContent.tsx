'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Pause, CheckCircle, Users, Phone, Clock, ExternalLink } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { campaignsApi } from '@/lib/api';
import { formatDateTime, formatDuration, getCampaignStatusColor } from '@/lib/utils';
import type { Campaign, CallSession } from '@/lib/types';

const MOCK_CAMPAIGN: Campaign = {
  id: 'c1',
  name: 'March Collection Drive',
  description: 'Standard monthly collection for March 2026',
  status: 'active',
  agent_type: 'sarvam',
  flow_id: 'flow_standard',
  total_customers: 245,
  called: 134,
  connected: 98,
  committed: 42,
  created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
};

const MOCK_SESSIONS: CallSession[] = Array.from({ length: 10 }, (_, i) => ({
  id: `sess-${i + 1}`,
  customer_id: `cus-${i + 1}`,
  campaign_id: 'c1',
  agent_type: 'sarvam',
  flow_id: 'flow_standard',
  status: 'completed',
  tier: 'tier_2',
  outcome: ['commitment', 'refused', 'voicemail', 'callback', 'no_answer'][i % 5],
  duration_seconds: 120 + i * 30,
  created_at: new Date(Date.now() - i * 3600000).toISOString(),
}));

function ProgressRing({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1e2028" strokeWidth="6" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
            strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-[#f1f5f9]">{value}</span>
          <span className="text-[9px] text-[#475569]">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-xs text-[#94a3b8]">{label}</span>
    </div>
  );
}

export default function CampaignDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          campaignsApi.get(id),
          campaignsApi.getSessions(id),
        ]);
        setCampaign(cRes.data);
        setSessions((sRes.data as { items?: CallSession[] })?.items || []);
      } catch {
        setCampaign(MOCK_CAMPAIGN);
        setSessions(MOCK_SESSIONS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleAction = async (action: string) => {
    if (!campaign) return;
    try {
      if (action === 'start') await campaignsApi.start(campaign.id);
      else if (action === 'pause') await campaignsApi.pause(campaign.id);
      else if (action === 'complete') await campaignsApi.complete(campaign.id);
      const res = await campaignsApi.get(campaign.id);
      setCampaign(res.data);
    } catch {
      const statusMap: Record<string, Campaign['status']> = { start: 'active', pause: 'paused', complete: 'completed' };
      setCampaign((prev) => prev ? { ...prev, status: statusMap[action] || prev.status } : null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <div className="p-6 space-y-5">
      <button onClick={() => router.push('/campaigns')} className="flex items-center gap-2 text-[#94a3b8] hover:text-[#f1f5f9] text-sm transition-colors">
        <ArrowLeft size={16} />Back to Campaigns
      </button>

      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[#f1f5f9] font-bold text-xl">{campaign.name}</h2>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getCampaignStatusColor(campaign.status)}`}>
                {campaign.status}
              </span>
            </div>
            {campaign.description && <p className="text-[#475569] text-sm mt-1">{campaign.description}</p>}
            <div className="flex items-center gap-3 mt-2">
              <Badge status={campaign.agent_type} size="sm" />
              <span className="text-xs text-[#475569] font-mono">{campaign.flow_id}</span>
              <span className="text-xs text-[#475569] flex items-center gap-1">
                <Clock size={11} />Created {formatDateTime(campaign.created_at)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {campaign.status === 'draft' && (
              <button onClick={() => handleAction('start')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-sm text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                <Play size={14} />Start Campaign
              </button>
            )}
            {campaign.status === 'active' && (
              <button onClick={() => handleAction('pause')} className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 border border-amber-500/30 rounded-lg text-sm text-amber-400 hover:bg-amber-600/30 transition-colors">
                <Pause size={14} />Pause
              </button>
            )}
            {campaign.status === 'paused' && (
              <>
                <button onClick={() => handleAction('start')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-sm text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                  <Play size={14} />Resume
                </button>
                <button onClick={() => handleAction('complete')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-sm text-indigo-400 hover:bg-indigo-600/30 transition-colors">
                  <CheckCircle size={14} />Complete
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-8 mt-6 pt-5 border-t border-[#2a2d38]">
          <ProgressRing value={campaign.total_customers} max={campaign.total_customers} label="Total" color="#6366f1" />
          <ProgressRing value={campaign.called} max={campaign.total_customers} label="Called" color="#3b82f6" />
          <ProgressRing value={campaign.connected} max={campaign.called} label="Connected" color="#10b981" />
          <ProgressRing value={campaign.committed} max={campaign.connected} label="Committed" color="#f59e0b" />
        </div>
      </div>

      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
        <div className="px-5 py-4 border-b border-[#2a2d38] flex items-center justify-between">
          <h3 className="text-[#f1f5f9] font-semibold text-sm flex items-center gap-2">
            <Phone size={15} className="text-[#475569]" />Call History ({sessions.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2028]">
                {['Customer', 'Agent', 'Flow', 'Duration', 'Outcome', 'Date', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2028]">
              {sessions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#475569]">No calls yet</td></tr>
              ) : sessions.map((s) => (
                <tr key={s.id} className="hover:bg-[#111318] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#22262f] flex items-center justify-center">
                        <Users size={12} className="text-[#475569]" />
                      </div>
                      <span className="text-[#94a3b8] text-xs font-mono">{s.customer_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge status={s.agent_type} size="sm" /></td>
                  <td className="px-4 py-3 text-[#94a3b8] text-xs font-mono">{s.flow_id.replace('flow_', '')}</td>
                  <td className="px-4 py-3 text-[#94a3b8] text-xs">{s.duration_seconds ? formatDuration(s.duration_seconds) : '—'}</td>
                  <td className="px-4 py-3"><Badge status={s.outcome || s.status} size="sm" /></td>
                  <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => router.push(`/conversations/${s.id}`)} className="p-1 rounded hover:bg-[#22262f] text-[#475569] hover:text-[#94a3b8] transition-colors">
                      <ExternalLink size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
