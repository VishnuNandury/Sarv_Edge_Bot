'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, ChevronLeft, ChevronRight, Phone, Clock, ExternalLink } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { conversationsApi } from '@/lib/api';
import { formatDuration, formatDateTime } from '@/lib/utils';
import type { CallSession } from '@/lib/types';

const MOCK_SESSIONS: (CallSession & { customer_name: string; customer_phone: string })[] = Array.from({ length: 12 }, (_, i) => ({
  id: `sess-${i + 1}`,
  customer_id: `cus-${i + 1}`,
  customer_name: ['Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sunita Verma', 'Deepak Singh'][i % 5],
  customer_phone: `+91 98${String(i + 1).padStart(2, '0')} 76543`,
  agent_type: i % 2 === 0 ? 'sarvam' : 'whisper_edge',
  flow_id: ['flow_basic', 'flow_standard', 'flow_advanced'][i % 3],
  status: ['completed', 'completed', 'failed', 'voicemail', 'no_answer'][i % 5] as CallSession['status'],
  tier: ['tier_1', 'tier_2', 'tier_3'][i % 3] as CallSession['tier'],
  outcome: ['commitment', 'refused', 'voicemail', 'callback', 'no_answer'][i % 5],
  duration_seconds: 90 + i * 30,
  created_at: new Date(Date.now() - i * 3600000).toISOString(),
  start_time: new Date(Date.now() - i * 3600000).toISOString(),
}));

export default function ConversationsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<(CallSession & { customer_name: string; customer_phone: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await conversationsApi.list({
        search, status: statusFilter || undefined, agent_type: agentFilter || undefined,
        date_from: dateFrom || undefined, date_to: dateTo || undefined, page, limit,
      });
      const data = res.data as { items?: unknown[]; total?: number } | undefined;
      setSessions((data?.items as typeof MOCK_SESSIONS) || MOCK_SESSIONS);
      setTotal(data?.total || MOCK_SESSIONS.length);
    } catch {
      setSessions(MOCK_SESSIONS);
      setTotal(MOCK_SESSIONS.length);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, agentFilter, dateFrom, dateTo, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[#f1f5f9] text-xl font-bold">Conversations</h2>
        <div className="text-sm text-[#475569]">{total} total sessions</div>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] w-4 h-4" />
            <input
              type="text"
              placeholder="Search customer name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] focus:outline-none focus:border-indigo-500/50"
          >
            <option value="">All Outcomes</option>
            <option value="commitment">Commitment</option>
            <option value="refused">Refused</option>
            <option value="voicemail">Voicemail</option>
            <option value="callback">Callback</option>
            <option value="no_answer">No Answer</option>
          </select>
          <select
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] focus:outline-none focus:border-indigo-500/50"
          >
            <option value="">All Agents</option>
            <option value="sarvam">Sarvam</option>
            <option value="whisper_edge">Whisper Edge</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] focus:outline-none focus:border-indigo-500/50"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] focus:outline-none focus:border-indigo-500/50"
          />
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setAgentFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] hover:bg-[#22262f] transition-colors"
          >
            <Filter size={14} />
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d38]">
                {['Customer', 'Phone', 'Duration', 'Agent', 'Flow', 'Outcome', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2028]">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#475569]">
                    No conversations found
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-[#111318] cursor-pointer transition-colors"
                    onClick={() => router.push(`/conversations/${s.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                          <Phone size={12} className="text-indigo-400" />
                        </div>
                        <span className="text-[#f1f5f9] font-medium">{s.customer_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">{s.customer_phone}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">
                      <div className="flex items-center gap-1">
                        <Clock size={11} className="text-[#475569]" />
                        {s.duration_seconds ? formatDuration(s.duration_seconds) : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge status={s.agent_type} size="sm" /></td>
                    <td className="px-4 py-3">
                      <span className="text-[#94a3b8] text-xs font-mono">
                        {s.flow_id.replace('flow_', '')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.outcome ? <Badge status={s.outcome} /> : <Badge status={s.status} />}
                    </td>
                    <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">
                      {formatDateTime(s.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/conversations/${s.id}`); }}
                        className="p-1.5 rounded hover:bg-[#22262f] text-[#475569] hover:text-[#94a3b8] transition-colors"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t border-[#2a2d38] flex items-center justify-between">
            <span className="text-xs text-[#475569]">
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-[#2a2d38] text-[#94a3b8] hover:bg-[#22262f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded border text-xs font-medium transition-colors ${
                    page === p
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'border-[#2a2d38] text-[#94a3b8] hover:bg-[#22262f]'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-1.5 rounded border border-[#2a2d38] text-[#94a3b8] hover:bg-[#22262f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
