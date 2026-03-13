'use client';

import { useEffect, useState } from 'react';
import { getLatencyColor, formatDuration } from '@/lib/utils';

interface MetricsPanelProps {
  metrics: {
    stt_latency_ms?: number;
    llm_latency_ms?: number;
    tts_latency_ms?: number;
    total_latency_ms?: number;
    tokens_input?: number;
    tokens_output?: number;
  };
  isConnected: boolean;
  startTime?: Date;
}

interface MetricCardProps {
  label: string;
  value: string;
  colorClass?: string;
  sublabel?: string;
}

function MetricCard({ label, value, colorClass = 'text-[#94a3b8]', sublabel }: MetricCardProps) {
  return (
    <div className="bg-[#111318] rounded-lg p-2.5 border border-[#1e2028]">
      <div className="text-[10px] text-[#475569] mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono ${colorClass}`}>{value}</div>
      {sublabel && <div className="text-[10px] text-[#475569] mt-0.5">{sublabel}</div>}
    </div>
  );
}

export default function MetricsPanel({ metrics, isConnected, startTime }: MetricsPanelProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isConnected || !startTime) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected, startTime]);

  const stt = metrics.stt_latency_ms;
  const llm = metrics.llm_latency_ms;
  const tts = metrics.tts_latency_ms;
  const total = metrics.total_latency_ms;

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest mb-2">
        Performance Metrics
      </div>

      {/* Duration */}
      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-lg px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-[#94a3b8]">Call Duration</span>
        <span className="text-sm font-bold font-mono text-indigo-300">
          {isConnected ? formatDuration(elapsed) : '—'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="STT Latency"
          value={stt !== undefined ? `${stt}ms` : '—'}
          colorClass={stt !== undefined ? getLatencyColor(stt, 'stt') : 'text-[#475569]'}
          sublabel={stt !== undefined ? (stt < 300 ? 'Fast' : stt < 500 ? 'OK' : 'Slow') : undefined}
        />
        <MetricCard
          label="LLM Latency"
          value={llm !== undefined ? `${llm}ms` : '—'}
          colorClass={llm !== undefined ? getLatencyColor(llm, 'llm') : 'text-[#475569]'}
          sublabel={llm !== undefined ? (llm < 500 ? 'Fast' : llm < 1000 ? 'OK' : 'Slow') : undefined}
        />
        <MetricCard
          label="TTS Latency"
          value={tts !== undefined ? `${tts}ms` : '—'}
          colorClass={tts !== undefined ? getLatencyColor(tts, 'tts') : 'text-[#475569]'}
        />
        <MetricCard
          label="Total Latency"
          value={total !== undefined ? `${total}ms` : '—'}
          colorClass={total !== undefined ? getLatencyColor(total, 'total') : 'text-[#475569]'}
        />
      </div>

      {/* Tokens */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Tokens In"
          value={metrics.tokens_input !== undefined ? metrics.tokens_input.toLocaleString() : '—'}
          colorClass="text-blue-400"
        />
        <MetricCard
          label="Tokens Out"
          value={metrics.tokens_output !== undefined ? metrics.tokens_output.toLocaleString() : '—'}
          colorClass="text-purple-400"
        />
      </div>

      {/* Latency breakdown bar */}
      {stt !== undefined && llm !== undefined && tts !== undefined && total !== undefined && (
        <div className="bg-[#111318] rounded-lg p-2.5 border border-[#1e2028]">
          <div className="text-[10px] text-[#475569] mb-2">Latency Breakdown</div>
          <div className="flex gap-0.5 h-3 rounded overflow-hidden">
            <div
              className="bg-emerald-500 rounded-l"
              style={{ width: `${(stt / total) * 100}%` }}
              title={`STT: ${stt}ms`}
            />
            <div
              className="bg-indigo-500"
              style={{ width: `${(llm / total) * 100}%` }}
              title={`LLM: ${llm}ms`}
            />
            <div
              className="bg-amber-500 rounded-r"
              style={{ width: `${(tts / total) * 100}%` }}
              title={`TTS: ${tts}ms`}
            />
          </div>
          <div className="flex gap-3 mt-1.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-emerald-500" />
              <span className="text-[9px] text-[#475569]">STT</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-indigo-500" />
              <span className="text-[9px] text-[#475569]">LLM</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-amber-500" />
              <span className="text-[9px] text-[#475569]">TTS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
