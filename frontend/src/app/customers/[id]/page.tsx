'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Phone, IndianRupee, Calendar, Tag, Save, Loader2, TrendingUp, ExternalLink } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { customersApi } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime, getDpdBgColor, getOutcomeColor } from '@/lib/utils';
import type { Customer, CallSession } from '@/lib/types';

interface PageProps {
  params: { id: string };
}

const MOCK_CUSTOMER: Customer = {
  id: 'cus-1',
  name: 'Rajesh Kumar',
  phone: '+91 9876543210',
  email: 'rajesh.kumar@email.com',
  loan_amount: 250000,
  outstanding_amount: 45000,
  dpd: 15,
  due_date: '2026-03-01',
  loan_id: 'LN2024001234',
  segment: 'standard',
  preferred_language: 'hi-IN',
  status: 'active',
  tags: ['urgent', 'follow-up'],
  created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
};

const MOCK_SESSIONS: CallSession[] = Array.from({ length: 5 }, (_, i) => ({
  id: `sess-${i + 1}`,
  customer_id: 'cus-1',
  agent_type: i % 2 === 0 ? 'sarvam' : 'whisper_edge',
  flow_id: 'flow_standard',
  status: 'completed',
  tier: 'tier_2',
  outcome: ['commitment', 'refused', 'voicemail', 'callback', 'no_answer'][i % 5],
  duration_seconds: 120 + i * 45,
  created_at: new Date(Date.now() - i * 7 * 86400000).toISOString(),
}));

export default function CustomerDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          customersApi.get(params.id),
          customersApi.getSessions(params.id),
        ]);
        setCustomer(cRes.data);
        setForm(cRes.data);
        setSessions((sRes.data as { items?: CallSession[] })?.items || []);
      } catch {
        setCustomer(MOCK_CUSTOMER);
        setForm(MOCK_CUSTOMER);
        setSessions(MOCK_SESSIONS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await customersApi.update(params.id, form);
      setCustomer(res.data);
      setForm(res.data);
      setEditMode(false);
    } catch {
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && form.tags && !form.tags.includes(newTag.trim())) {
      setForm({ ...form, tags: [...(form.tags || []), newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: (form.tags || []).filter((t) => t !== tag) });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const inputClass = 'w-full bg-[#111318] border border-[#2a2d38] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:outline-none focus:border-indigo-500/50';

  return (
    <div className="p-6 space-y-5">
      <button onClick={() => router.push('/customers')} className="flex items-center gap-2 text-[#94a3b8] hover:text-[#f1f5f9] text-sm transition-colors">
        <ArrowLeft size={16} />Back to Customers
      </button>

      {/* Header */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl font-bold text-indigo-300">
              {customer.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-[#f1f5f9] font-bold text-xl">{customer.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <div className="flex items-center gap-1 text-[#94a3b8] text-sm">
                  <Phone size={13} />
                  {customer.phone}
                </div>
                {customer.loan_id && (
                  <span className="text-[#475569] font-mono text-xs bg-[#111318] px-2 py-0.5 rounded border border-[#2a2d38]">
                    {customer.loan_id}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge status={customer.status} size="md" />
            <Badge status={customer.segment} size="md" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[#2a2d38]">
          <div>
            <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">Loan Amount</div>
            <div className="flex items-center gap-1 text-[#f1f5f9] font-semibold">
              <IndianRupee size={13} />
              {formatCurrency(customer.loan_amount).replace('₹', '')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">Outstanding</div>
            <div className="flex items-center gap-1 text-red-400 font-semibold">
              <IndianRupee size={13} />
              {formatCurrency(customer.outstanding_amount).replace('₹', '')}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">DPD</div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${getDpdBgColor(customer.dpd)}`}>
                {customer.dpd} days
              </span>
              <TrendingUp size={13} className="text-[#475569]" />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">Due Date</div>
            <div className="flex items-center gap-1 text-[#94a3b8] text-sm">
              <Calendar size={13} className="text-[#475569]" />
              {customer.due_date ? formatDate(customer.due_date) : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Edit Form */}
        <div className="lg:col-span-1 bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
          <div className="px-5 py-4 border-b border-[#2a2d38] flex items-center justify-between">
            <h3 className="text-[#f1f5f9] font-semibold text-sm">Customer Details</h3>
            {!editMode ? (
              <button onClick={() => setEditMode(true)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Edit</button>
            ) : (
              <button onClick={() => { setEditMode(false); setForm(customer); }} className="text-xs text-[#475569] hover:text-[#94a3b8] transition-colors">Cancel</button>
            )}
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-[#475569] mb-1.5">Full Name</label>
              {editMode ? <input className={inputClass} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                : <div className="text-[#94a3b8] text-sm">{customer.name}</div>}
            </div>
            <div>
              <label className="block text-xs text-[#475569] mb-1.5">Phone</label>
              {editMode ? <input className={inputClass} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                : <div className="text-[#94a3b8] text-sm font-mono">{customer.phone}</div>}
            </div>
            <div>
              <label className="block text-xs text-[#475569] mb-1.5">Email</label>
              {editMode ? <input type="email" className={inputClass} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                : <div className="text-[#94a3b8] text-sm">{customer.email || '—'}</div>}
            </div>
            <div>
              <label className="block text-xs text-[#475569] mb-1.5">Preferred Language</label>
              {editMode ? (
                <select className={inputClass} value={form.preferred_language || 'hi-IN'} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
                  <option value="hi-IN">Hindi</option>
                  <option value="en-IN">English</option>
                  <option value="ta-IN">Tamil</option>
                  <option value="te-IN">Telugu</option>
                </select>
              ) : <div className="text-[#94a3b8] text-sm">{customer.preferred_language}</div>}
            </div>
            <div>
              <label className="block text-xs text-[#475569] mb-1.5">Segment</label>
              {editMode ? (
                <select className={inputClass} value={form.segment || 'standard'} onChange={(e) => setForm({ ...form, segment: e.target.value as Customer['segment'] })}>
                  <option value="prime">Prime</option>
                  <option value="standard">Standard</option>
                  <option value="risky">Risky</option>
                </select>
              ) : <Badge status={customer.segment} />}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs text-[#475569] mb-1.5 flex items-center gap-1">
                <Tag size={10} />Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(form.tags || []).map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-[#111318] border border-[#2a2d38] rounded-full px-2 py-0.5 text-xs text-[#94a3b8]">
                    {tag}
                    {editMode && (
                      <button onClick={() => removeTag(tag)} className="text-[#475569] hover:text-red-400 ml-0.5">×</button>
                    )}
                  </span>
                ))}
              </div>
              {editMode && (
                <div className="flex gap-2">
                  <input
                    value={newTag} onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add tag..."
                    className="flex-1 bg-[#111318] border border-[#2a2d38] rounded-lg px-3 py-1.5 text-xs text-[#94a3b8] focus:outline-none focus:border-indigo-500/50"
                  />
                  <button onClick={addTag} className="px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-xs text-indigo-400 hover:bg-indigo-600/30 transition-colors">
                    Add
                  </button>
                </div>
              )}
            </div>

            {editMode && (
              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}

            <div className="pt-3 border-t border-[#2a2d38]">
              <div className="text-xs text-[#475569]">Customer since {formatDate(customer.created_at)}</div>
            </div>
          </div>
        </div>

        {/* Call History */}
        <div className="lg:col-span-2 bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
          <div className="px-5 py-4 border-b border-[#2a2d38]">
            <h3 className="text-[#f1f5f9] font-semibold text-sm">Call History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2028]">
                  {['Date', 'Agent', 'Flow', 'Duration', 'Outcome', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2028]">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#475569] text-sm">No call history</td>
                  </tr>
                ) : sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-[#111318] transition-colors">
                    <td className="px-4 py-3 text-[#94a3b8] text-xs whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                    <td className="px-4 py-3"><Badge status={s.agent_type} size="sm" /></td>
                    <td className="px-4 py-3 text-[#94a3b8] text-xs font-mono">{s.flow_id.replace('flow_', '')}</td>
                    <td className="px-4 py-3 text-[#94a3b8] text-xs">
                      {s.duration_seconds ? `${Math.floor(s.duration_seconds / 60)}:${String(s.duration_seconds % 60).padStart(2, '0')}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={s.outcome || s.status} size="sm" />
                    </td>
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
    </div>
  );
}
