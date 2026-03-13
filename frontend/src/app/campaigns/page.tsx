'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Play, Pause, CheckCircle, Clock, Users, TrendingUp, Bot, GitBranch } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { campaignsApi } from '@/lib/api';
import { formatDateTime, getCampaignStatusColor } from '@/lib/utils';
import type { Campaign, Customer } from '@/lib/types';

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: 'c1', name: 'March Collection Drive', description: 'Standard monthly collection for March 2026', status: 'active', agent_type: 'sarvam', flow_id: 'flow_standard', total_customers: 245, called: 134, connected: 98, committed: 42, created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 'c2', name: 'High DPD Recovery Q1', description: 'Targeting 60+ DPD accounts', status: 'paused', agent_type: 'whisper_edge', flow_id: 'flow_advanced', total_customers: 87, called: 45, connected: 28, committed: 11, created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
  { id: 'c3', name: 'Prime Reminder Feb', description: 'Gentle reminders for prime segment', status: 'completed', agent_type: 'sarvam', flow_id: 'flow_basic', total_customers: 320, called: 320, connected: 287, committed: 145, created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
  { id: 'c4', name: 'Q2 Collection Setup', status: 'draft', agent_type: 'sarvam', flow_id: 'flow_standard', total_customers: 0, called: 0, connected: 0, committed: 0, created_at: new Date().toISOString() },
];

interface CampaignFormProps {
  onSave: (data: Partial<Campaign>) => Promise<void>;
  onClose: () => void;
}

function CampaignForm({ onSave, onClose }: CampaignFormProps) {
  const [form, setForm] = useState<Partial<Campaign>>({
    name: '', description: '', status: 'draft', agent_type: 'sarvam', flow_id: 'flow_standard',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const inputClass = 'w-full bg-[#111318] border border-[#2a2d38] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-indigo-500/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1d24] border border-[#2a2d38] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-[#f1f5f9] font-semibold text-lg mb-5">Create Campaign</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1.5">Campaign Name *</label>
            <input className={inputClass} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. March Collection Drive" />
          </div>
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1.5">Description</label>
            <textarea rows={2} className={inputClass} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#94a3b8] mb-1.5">Agent Engine</label>
              <select className={inputClass} value={form.agent_type || 'sarvam'} onChange={(e) => setForm({ ...form, agent_type: e.target.value as Campaign['agent_type'] })}>
                <option value="sarvam">Sarvam</option>
                <option value="whisper_edge">Whisper Edge</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94a3b8] mb-1.5">Flow</label>
              <select className={inputClass} value={form.flow_id || 'flow_standard'} onChange={(e) => setForm({ ...form, flow_id: e.target.value })}>
                <option value="flow_basic">Basic</option>
                <option value="flow_standard">Standard</option>
                <option value="flow_advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1.5">Schedule Time (optional)</label>
            <input type="datetime-local" className={inputClass} value={form.schedule_time || ''} onChange={(e) => setForm({ ...form, schedule_time: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[#2a2d38] text-[#94a3b8] text-sm hover:bg-[#22262f] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, onAction, onClick }: { campaign: Campaign; onAction: (id: string, action: string) => void; onClick: () => void }) {
  const progress = campaign.total_customers > 0 ? (campaign.called / campaign.total_customers) * 100 : 0;
  const successRate = campaign.called > 0 ? (campaign.committed / campaign.called) * 100 : 0;

  return (
    <div
      className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] hover:border-[#3a3d4a] transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-3">
            <h3 className="text-[#f1f5f9] font-semibold text-sm truncate">{campaign.name}</h3>
            {campaign.description && (
              <p className="text-[#475569] text-xs mt-0.5 truncate">{campaign.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {campaign.status === 'active' && (
              <div className="relative flex items-center justify-center w-4 h-4">
                <div className="absolute w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-50" />
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            )}
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${getCampaignStatusColor(campaign.status)}`}>
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {campaign.total_customers > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-[#475569] mb-1.5">
              <span>{campaign.called}/{campaign.total_customers} called</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-[#111318] rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[#94a3b8] text-sm font-semibold">
              <Users size={12} className="text-[#475569]" />
              {campaign.total_customers}
            </div>
            <div className="text-[10px] text-[#475569] mt-0.5">Total</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-400 text-sm font-semibold">
              <TrendingUp size={12} />
              {campaign.connected}
            </div>
            <div className="text-[10px] text-[#475569] mt-0.5">Connected</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-400 text-sm font-semibold">
              <CheckCircle size={12} />
              {campaign.committed}
            </div>
            <div className="text-[10px] text-[#475569] mt-0.5">Committed</div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1e2028]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] text-[#475569]">
              <Bot size={10} />
              {campaign.agent_type === 'sarvam' ? 'Sarvam' : 'Whisper'}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#475569]">
              <GitBranch size={10} />
              {campaign.flow_id.replace('flow_', '')}
            </div>
            {campaign.total_customers > 0 && (
              <div className="text-[10px] text-emerald-400 font-medium">
                {successRate.toFixed(0)}% success
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#475569]">
            <Clock size={10} />
            {formatDateTime(campaign.created_at).split(',')[0]}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
        {campaign.status === 'draft' && (
          <button onClick={() => onAction(campaign.id, 'start')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 hover:bg-emerald-600/30 transition-colors">
            <Play size={12} />Start
          </button>
        )}
        {campaign.status === 'active' && (
          <button onClick={() => onAction(campaign.id, 'pause')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-600/20 border border-amber-500/30 rounded-lg text-xs text-amber-400 hover:bg-amber-600/30 transition-colors">
            <Pause size={12} />Pause
          </button>
        )}
        {campaign.status === 'paused' && (
          <>
            <button onClick={() => onAction(campaign.id, 'start')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 hover:bg-emerald-600/30 transition-colors">
              <Play size={12} />Resume
            </button>
            <button onClick={() => onAction(campaign.id, 'complete')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-xs text-indigo-400 hover:bg-indigo-600/30 transition-colors">
              <CheckCircle size={12} />Complete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await campaignsApi.list({ status: statusFilter || undefined });
      setCampaigns((res.data as { items?: Campaign[] })?.items || MOCK_CAMPAIGNS);
    } catch {
      setCampaigns(MOCK_CAMPAIGNS);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAction = async (id: string, action: string) => {
    try {
      if (action === 'start') await campaignsApi.start(id);
      else if (action === 'pause') await campaignsApi.pause(id);
      else if (action === 'complete') await campaignsApi.complete(id);
      fetch();
    } catch {
      // Update local state optimistically
      setCampaigns((prev) => prev.map((c) => {
        if (c.id !== id) return c;
        const statusMap: Record<string, Campaign['status']> = { start: 'active', pause: 'paused', complete: 'completed' };
        return { ...c, status: statusMap[action] || c.status };
      }));
    }
  };

  const handleCreate = async (data: Partial<Campaign>) => {
    await campaignsApi.create(data);
    setShowForm(false);
    fetch();
  };

  const filtered = statusFilter ? campaigns.filter((c) => c.status === statusFilter) : campaigns;

  return (
    <div className="p-6 space-y-5">
      {showForm && <CampaignForm onSave={handleCreate} onClose={() => setShowForm(false)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-[#f1f5f9] text-xl font-bold">Campaigns</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-medium transition-colors">
          <Plus size={14} />
          New Campaign
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['', 'draft', 'active', 'paused', 'completed'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-[#1a1d24] border border-[#2a2d38] text-[#94a3b8] hover:bg-[#22262f]'
            }`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#475569]">No campaigns found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onAction={handleAction}
              onClick={() => router.push(`/campaigns/${c.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
