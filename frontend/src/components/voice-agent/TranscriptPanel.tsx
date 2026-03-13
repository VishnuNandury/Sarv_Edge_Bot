'use client';

import { useEffect, useRef } from 'react';
import { Hash } from 'lucide-react';

interface TranscriptEntry {
  speaker: 'agent' | 'customer' | 'dtmf';
  text: string;
  timestamp: string;
  turn_index?: number;
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

export default function TranscriptPanel({ entries }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <div className="text-[#475569] text-xs">Transcript will appear here once the call starts</div>
        <div className="flex gap-1.5 mt-3">
          {[0.5, 0.8, 0.6, 0.9, 0.7].map((h, i) => (
            <div
              key={i}
              className="w-0.5 bg-[#2a2d38] rounded-full"
              style={{ height: `${h * 24}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pr-1">
      {entries.map((entry, i) => {
        if (entry.speaker === 'dtmf') {
          return (
            <div key={i} className="flex justify-center">
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                <Hash size={10} className="text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-mono">DTMF: {entry.text}</span>
              </div>
            </div>
          );
        }

        const isAgent = entry.speaker === 'agent';

        return (
          <div
            key={i}
            className={`flex flex-col gap-0.5 ${isAgent ? 'items-start' : 'items-end'}`}
          >
            <div className="flex items-center gap-1.5 px-1">
              <span className={`text-[10px] font-medium ${isAgent ? 'text-indigo-400' : 'text-emerald-400'}`}>
                {isAgent ? '🤖 Agent' : '👤 Customer'}
              </span>
              <span className="text-[10px] text-[#475569]">{formatTime(entry.timestamp)}</span>
            </div>
            <div
              className={`max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                isAgent
                  ? 'bg-indigo-600/15 border border-indigo-500/20 text-[#c7d2fe] rounded-tl-sm'
                  : 'bg-[#1a1d24] border border-[#2a2d38] text-[#94a3b8] rounded-tr-sm'
              }`}
            >
              {entry.text}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
