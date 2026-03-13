'use client';

import { useRouter } from 'next/navigation';
import { Phone, Clock } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { formatDuration, formatRelativeTime } from '@/lib/utils';
import type { CallSession } from '@/lib/types';

interface RecentCallsProps {
  sessions: Array<CallSession & { customer_name: string }>;
  loading?: boolean;
}

function SkeletonRow() {
  return (
    <tr>
      <td className="px-4 py-3"><div className="skeleton h-4 w-32 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-4 w-24 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-4 w-12 rounded" /></td>
      <td className="px-4 py-3"><div className="skeleton h-5 w-20 rounded-full" /></td>
      <td className="px-4 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
    </tr>
  );
}

export default function RecentCalls({ sessions, loading = false }: RecentCallsProps) {
  const router = useRouter();

  return (
    <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
      <div className="px-5 py-4 border-b border-[#2a2d38] flex items-center justify-between">
        <h3 className="text-[#f1f5f9] font-semibold text-sm">Recent Calls</h3>
        <button
          onClick={() => router.push('/conversations')}
          className="text-indigo-400 text-xs hover:text-indigo-300 transition-colors"
        >
          View all →
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2028]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider">Outcome</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2028]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[#475569] text-sm">
                  No recent calls
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr
                  key={session.id}
                  className="hover:bg-[#111318] cursor-pointer transition-colors"
                  onClick={() => router.push(`/conversations/${session.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                        <Phone size={12} className="text-indigo-400" />
                      </div>
                      <span className="text-[#f1f5f9] font-medium truncate max-w-[120px]">
                        {session.customer_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">
                    {session.customer?.phone || '—'}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    <div className="flex items-center gap-1">
                      <Clock size={11} className="text-[#475569]" />
                      {session.duration_seconds ? formatDuration(session.duration_seconds) : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {session.outcome ? <Badge status={session.outcome} /> : <Badge status={session.status} />}
                  </td>
                  <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">
                    {formatRelativeTime(session.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
