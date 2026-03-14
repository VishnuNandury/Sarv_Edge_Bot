'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, User, Bot, GitBranch, IndianRupee, FileText, Phone, CheckCircle2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { conversationsApi } from '@/lib/api';
import { formatDuration, formatDateTime, formatCurrency, getLatencyColor } from '@/lib/utils';
import type { CallSession, Transcript, SessionMetrics } from '@/lib/types';

const MOCK_SESSION: CallSession & { customer_name: string; customer_phone: string } = {
  id: 'sess-1',
  customer_id: 'cus-1',
  customer_name: 'Rajesh Kumar',
  customer_phone: '+91 9876543210',
  agent_type: 'sarvam',
  flow_id: 'flow_standard',
  status: 'completed',
  tier: 'tier_2',
  outcome: 'commitment',
  commitment_amount: 15000,
  commitment_date: '2026-03-20',
  duration_seconds: 243,
  created_at: new Date().toISOString(),
  start_time: new Date().toISOString(),
  end_time: new Date(Date.now() + 243000).toISOString(),
};

const MOCK_TRANSCRIPT: Transcript[] = [
  { id: '1', session_id: 'sess-1', speaker: 'agent', text: 'नमस्ते! मैं Converse AI से बोल रहा हूं। क्या आप Rajesh Kumar जी हैं?', timestamp: new Date().toISOString(), turn_index: 0 },
  { id: '2', session_id: 'sess-1', speaker: 'customer', text: 'हाँ, मैं Rajesh Kumar हूं। कौन बोल रहा है?', timestamp: new Date(Date.now() + 5000).toISOString(), turn_index: 1 },
  { id: '3', session_id: 'sess-1', speaker: 'agent', text: 'Sir, आपके loan account पर ₹45,000 outstanding है जो 15 दिन से overdue है। क्या आप इसका payment कर सकते हैं?', timestamp: new Date(Date.now() + 12000).toISOString(), turn_index: 2 },
  { id: '4', session_id: 'sess-1', speaker: 'customer', text: 'हाँ, मैं अगले हफ्ते ₹15,000 भेज दूंगा।', timestamp: new Date(Date.now() + 25000).toISOString(), turn_index: 3 },
  { id: '5', session_id: 'sess-1', speaker: 'agent', text: 'बहुत अच्छा! तो आप 20 मार्च तक ₹15,000 transfer करेंगे। क्या यह confirm है?', timestamp: new Date(Date.now() + 32000).toISOString(), turn_index: 4 },
  { id: '6', session_id: 'sess-1', speaker: 'customer', text: 'हाँ, confirm है।', timestamp: new Date(Date.now() + 40000).toISOString(), turn_index: 5 },
  { id: '7', session_id: 'sess-1', speaker: 'agent', text: 'धन्यवाद Rajesh ji. आपका reference number CR20260313001 है। कोई समस्या हो तो 1800-XXX-XXXX पर call करें।', timestamp: new Date(Date.now() + 48000).toISOString(), turn_index: 6 },
];

const MOCK_METRICS: SessionMetrics = {
  id: 'm1', session_id: 'sess-1',
  stt_latency_ms: 245, llm_latency_ms: 680, tts_latency_ms: 198, total_latency_ms: 1123,
  tokens_input: 847, tokens_output: 312, cost_usd: 0.0042,
  created_at: new Date().toISOString(),
};

const NODE_FLOW = ['Greeting', 'Identity Verification', 'Overdue Information', 'Listen Situation', 'Handle Objection', 'Get Commitment', 'Farewell'];

export default function ConversationDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [session, setSession] = useState<(CallSession & { customer_name: string; customer_phone: string }) | null>(null);
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, tRes, mRes] = await Promise.all([
          conversationsApi.get(id),
          conversationsApi.getTranscript(id),
          conversationsApi.getMetrics(id),
        ]);
        setSession(sRes.data as typeof MOCK_SESSION);
        setTranscript((tRes.data as { items?: Transcript[] })?.items || []);
        setMetrics(mRes.data as SessionMetrics);
      } catch {
        setSession(MOCK_SESSION);
        setTranscript(MOCK_TRANSCRIPT);
        setMetrics(MOCK_METRICS);
        setNotes('Customer agreed to partial payment. Follow up required on March 20.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-64 rounded-xl" /><div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="p-6 space-y-5">
      <button onClick={() => router.push('/conversations')} className="flex items-center gap-2 text-[#94a3b8] hover:text-[#f1f5f9] text-sm transition-colors">
        <ArrowLeft size={16} />Back to Conversations
      </button>

      {/* Session Header */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Phone size={22} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-[#f1f5f9] font-bold text-lg">{session.customer_name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[#94a3b8] text-sm font-mono">{session.customer_phone}</span>
                <span className="text-[#2a2d38]">•</span>
                <span className="text-[#475569] text-xs font-mono">{id}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge status={session.outcome || session.status} size="md" />
            <Badge status={session.agent_type} size="md" />
            <Badge status={session.tier} size="md" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[#2a2d38]">
          <div>
            <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">Duration</div>
            <div className="flex items-center gap-1.5 text-[#f1f5f9] font-medium">
              <Clock size={14} className="text-[#475569]" />
              {session.duration_seconds ? formatDuration(session.duration_seconds) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">Date & Time</div>
            <div className="text-[#f1f5f9] text-sm">{formatDateTime(session.created_at)}</div>
          </div>
          {session.commitment_amount && (
            <div>
              <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">Committed</div>
              <div className="flex items-center gap-1 text-emerald-400 font-medium">
                <IndianRupee size={13} />{formatCurrency(session.commitment_amount).replace('₹', '')}
              </div>
            </div>
          )}
          {session.commitment_date && (
            <div>
              <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">Payment By</div>
              <div className="text-[#f1f5f9] text-sm">{session.commitment_date}</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Transcript */}
        <div className="lg:col-span-3 bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
          <div className="px-5 py-4 border-b border-[#2a2d38]">
            <h3 className="text-[#f1f5f9] font-semibold text-sm flex items-center gap-2">
              <FileText size={15} className="text-[#475569]" />Full Transcript
            </h3>
          </div>
          <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
            {transcript.map((t, i) => (
              <div key={t.id || i} className={`flex flex-col gap-1 ${t.speaker === 'agent' ? 'items-start' : 'items-end'}`}>
                <div className={`flex items-center gap-2 ${t.speaker === 'agent' ? '' : 'flex-row-reverse'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${t.speaker === 'agent' ? 'bg-indigo-600/30' : 'bg-emerald-600/30'}`}>
                    {t.speaker === 'agent' ? <Bot size={10} className="text-indigo-400" /> : <User size={10} className="text-emerald-400" />}
                  </div>
                  <span className={`text-[10px] font-medium ${t.speaker === 'agent' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                    {t.speaker === 'agent' ? 'AI Agent' : 'Customer'}
                  </span>
                  <span className="text-[10px] text-[#475569]">{new Date(t.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                  t.speaker === 'agent'
                    ? 'bg-indigo-600/10 border border-indigo-500/20 text-[#c7d2fe] rounded-tl-none'
                    : 'bg-[#111318] border border-[#2a2d38] text-[#94a3b8] rounded-tr-none'
                }`}>
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Flow Path */}
          <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
            <div className="px-5 py-4 border-b border-[#2a2d38]">
              <h3 className="text-[#f1f5f9] font-semibold text-sm flex items-center gap-2">
                <GitBranch size={15} className="text-[#475569]" />Flow Path
              </h3>
            </div>
            <div className="p-5">
              <div className="space-y-2">
                {NODE_FLOW.map((node, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={12} className="text-indigo-400" />
                      </div>
                      {i < NODE_FLOW.length - 1 && <div className="w-px h-4 bg-[#2a2d38] mt-0.5" />}
                    </div>
                    <span className="text-sm text-[#94a3b8]">{node}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Session Metrics */}
          {metrics && (
            <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
              <div className="px-5 py-4 border-b border-[#2a2d38]">
                <h3 className="text-[#f1f5f9] font-semibold text-sm flex items-center gap-2">
                  <Bot size={15} className="text-[#475569]" />Session Metrics
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'STT', value: metrics.stt_latency_ms, type: 'stt' as const },
                    { label: 'LLM', value: metrics.llm_latency_ms, type: 'llm' as const },
                    { label: 'TTS', value: metrics.tts_latency_ms, type: 'tts' as const },
                    { label: 'Total', value: metrics.total_latency_ms, type: 'total' as const },
                  ].map(({ label, value, type }) => (
                    <div key={label} className="bg-[#111318] rounded-lg p-3 border border-[#1e2028]">
                      <div className="text-[10px] text-[#475569] mb-1">{label} Latency</div>
                      <div className={`text-sm font-bold font-mono ${value !== undefined ? getLatencyColor(value, type) : 'text-[#475569]'}`}>
                        {value !== undefined ? `${value}ms` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between py-2 border-t border-[#1e2028]">
                  <div>
                    <div className="text-[10px] text-[#475569]">Tokens In</div>
                    <div className="text-sm font-mono text-blue-400">{metrics.tokens_input?.toLocaleString() || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#475569]">Tokens Out</div>
                    <div className="text-sm font-mono text-purple-400">{metrics.tokens_output?.toLocaleString() || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#475569]">Cost</div>
                    <div className="text-sm font-mono text-amber-400">${metrics.cost_usd?.toFixed(4) || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
            <div className="px-5 py-4 border-b border-[#2a2d38]">
              <h3 className="text-[#f1f5f9] font-semibold text-sm">Notes</h3>
            </div>
            <div className="p-5">
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={4} placeholder="Add notes about this conversation..."
                className="w-full bg-[#111318] border border-[#2a2d38] rounded-lg px-3 py-2.5 text-sm text-[#94a3b8] placeholder-[#475569] focus:outline-none focus:border-indigo-500/50 resize-none"
              />
              <button className="mt-2 px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-xs text-indigo-400 hover:bg-indigo-600/30 transition-colors">
                Save Notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
