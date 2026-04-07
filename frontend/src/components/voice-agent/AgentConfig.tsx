'use client';

import { useState, useEffect } from 'react';
import { Play, Loader2, User, IndianRupee, Calendar, Globe, Bot, Mic, Cpu } from 'lucide-react';
import type { AgentConfig, LLMProvider } from '@/lib/types';

interface AgentConfigProps {
  onStart: (config: AgentConfig) => void;
  onFlowChange?: (flowId: string) => void;
  isConnected: boolean;
  isConnecting: boolean;
}

const BUILT_IN_FLOWS = [
  { id: 'flow_basic', name: 'Basic', description: 'Tier 1 — Simple reminder call' },
  { id: 'flow_standard', name: 'Standard', description: 'Tier 2 — Negotiation flow' },
  { id: 'flow_advanced', name: 'Advanced', description: 'Tier 3 — Full escalation' },
  { id: 'flow_field_visit', name: 'Field Visit', description: 'Verify agent visit & payment' },
];

const BULBUL_V3_VOICES = [
  { id: 'priya',  label: 'Priya',  gender: 'F' },
  { id: 'neha',   label: 'Neha',   gender: 'F' },
  { id: 'pooja',  label: 'Pooja',  gender: 'F' },
  { id: 'simran', label: 'Simran', gender: 'F' },
  { id: 'kavya',  label: 'Kavya',  gender: 'F' },
  { id: 'ritu',   label: 'Ritu',   gender: 'F' },
  { id: 'rahul',  label: 'Rahul',  gender: 'M' },
  { id: 'rohan',  label: 'Rohan',  gender: 'M' },
  { id: 'amit',   label: 'Amit',   gender: 'M' },
  { id: 'dev',    label: 'Dev',    gender: 'M' },
];

const LLM_PROVIDERS: { id: LLMProvider; label: string; description: string; defaultTokens: number }[] = [
  { id: 'groq',   label: 'Groq',   description: 'llama-3.3-70b · sub-500ms · no thinking tokens', defaultTokens: 300 },
  { id: 'sarvam', label: 'Sarvam', description: 'sarvam-30b · reasoning model · needs 2000+ tokens', defaultTokens: 2000 },
  { id: 'openai', label: 'OpenAI', description: 'gpt-4o-mini · ~1s · reliable fallback', defaultTokens: 300 },
];

const LANGUAGES = [
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'bn-IN', label: 'Bengali' },
];

export default function AgentConfig({ onStart, onFlowChange, isConnected, isConnecting }: AgentConfigProps) {
  const [customFlows, setCustomFlows] = useState<Array<{ id: string; name: string; description: string }>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sarvam_custom_flows');
      if (raw) {
        const flows = JSON.parse(raw) as Array<{ id: string; name: string; description: string }>;
        setCustomFlows(flows.map(f => ({ id: f.id, name: f.name, description: f.description })));
      }
    } catch {}
  }, []);

  const [config, setConfig] = useState<AgentConfig>({
    customerName: 'Rajesh Kumar',
    customerId: '',
    loanAmount: 250000,
    outstandingAmount: 45000,
    dpd: 15,
    dueDate: new Date().toISOString().split('T')[0],
    flowId: 'flow_basic',
    agentType: 'sarvam',
    language: 'hi-IN',
    voice: 'priya',
    llmProvider: 'groq',
    llmMaxTokens: 300,
  });

  const set = (key: keyof AgentConfig, value: unknown) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const inputClass =
    'w-full bg-[#0a0b0e] border border-[#2a2d38] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-indigo-500/70 transition-colors';

  const labelClass = 'block text-xs font-medium text-[#94a3b8] mb-1.5';

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#2a2d38]">
        <h2 className="text-[#f1f5f9] font-semibold text-sm flex items-center gap-2">
          <Bot size={16} className="text-indigo-400" />
          Agent Configuration
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Customer Info */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest">Customer Details</p>

          <div>
            <label className={labelClass}>
              <User size={11} className="inline mr-1 text-[#475569]" />
              Customer Name *
            </label>
            <input
              className={inputClass}
              value={config.customerName}
              onChange={(e) => set('customerName', e.target.value)}
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label className={labelClass}>Customer ID (optional)</label>
            <input
              className={inputClass}
              value={config.customerId || ''}
              onChange={(e) => set('customerId', e.target.value)}
              placeholder="CUS-XXXXX"
            />
          </div>
        </div>

        {/* Loan Details */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest">Loan Details</p>

          <div>
            <label className={labelClass}>
              <IndianRupee size={11} className="inline mr-1 text-[#475569]" />
              Loan Amount (₹)
            </label>
            <input
              type="number"
              className={inputClass}
              value={config.loanAmount}
              onChange={(e) => set('loanAmount', Number(e.target.value))}
              placeholder="250000"
            />
          </div>

          <div>
            <label className={labelClass}>Outstanding Amount (₹)</label>
            <input
              type="number"
              className={inputClass}
              value={config.outstandingAmount}
              onChange={(e) => set('outstandingAmount', Number(e.target.value))}
              placeholder="45000"
            />
          </div>

          <div>
            <label className={labelClass}>DPD (Days Past Due)</label>
            <input
              type="number"
              className={inputClass}
              value={config.dpd}
              onChange={(e) => set('dpd', Number(e.target.value))}
              placeholder="15"
              min={0}
            />
            {config.dpd > 0 && (
              <div className={`mt-1.5 text-xs px-2 py-1 rounded flex items-center gap-1 w-fit ${
                config.dpd <= 7 ? 'bg-emerald-400/10 text-emerald-400' :
                config.dpd <= 30 ? 'bg-amber-400/10 text-amber-400' :
                'bg-red-400/10 text-red-400'
              }`}>
                {config.dpd <= 7 ? 'Low risk' : config.dpd <= 30 ? 'Medium risk' : 'High risk'} — {config.dpd} DPD
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>
              <Calendar size={11} className="inline mr-1 text-[#475569]" />
              Due Date
            </label>
            <input
              type="date"
              className={inputClass}
              value={config.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
            />
          </div>
        </div>

        {/* Flow Selection */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest">Flow Selection</p>

          <div className="space-y-2">
            {[...BUILT_IN_FLOWS, ...customFlows].map((flow) => (
              <button
                key={flow.id}
                onClick={() => { set('flowId', flow.id); onFlowChange?.(flow.id); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${
                  config.flowId === flow.id
                    ? 'border-indigo-500/50 bg-indigo-600/10 text-[#f1f5f9]'
                    : 'border-[#2a2d38] bg-[#0a0b0e] text-[#94a3b8] hover:border-[#3a3d4a]'
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{flow.name}</div>
                  <div className="text-xs text-[#475569]">{flow.description}</div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                  config.flowId === flow.id ? 'border-indigo-500' : 'border-[#2a2d38]'
                }`}>
                  {config.flowId === flow.id && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Agent Speech (STT/TTS engine) */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest flex items-center gap-1.5">
            <Mic size={10} />Agent Speech
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['sarvam', 'whisper_edge'] as const).map((type) => (
              <button
                key={type}
                onClick={() => set('agentType', type)}
                className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                  config.agentType === type
                    ? 'border-indigo-500/50 bg-indigo-600/10 text-indigo-300'
                    : 'border-[#2a2d38] bg-[#0a0b0e] text-[#94a3b8] hover:border-[#3a3d4a]'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${config.agentType === type ? 'bg-indigo-400' : 'bg-[#475569]'}`} />
                {type === 'sarvam' ? 'Sarvam' : 'Whisper Edge'}
              </button>
            ))}
          </div>
        </div>

        {/* Agent LLM */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest flex items-center gap-1.5">
            <Cpu size={10} />Agent LLM
          </p>
          <div className="space-y-1.5">
            {LLM_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setConfig((prev) => ({ ...prev, llmProvider: p.id, llmMaxTokens: p.defaultTokens }))}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                  config.llmProvider === p.id
                    ? 'border-indigo-500/50 bg-indigo-600/10'
                    : 'border-[#2a2d38] bg-[#0a0b0e] hover:border-[#3a3d4a]'
                }`}
              >
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${config.llmProvider === p.id ? 'bg-indigo-400' : 'bg-[#475569]'}`} />
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${config.llmProvider === p.id ? 'text-indigo-300' : 'text-[#94a3b8]'}`}>{p.label}</div>
                  <div className="text-[10px] text-[#475569] mt-0.5 leading-snug">{p.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Max tokens — editable, auto-set on provider switch */}
          <div>
            <label className={labelClass}>
              Max Tokens
              {config.llmProvider === 'sarvam' && (
                <span className="ml-1.5 text-amber-400/80 font-normal">⚠ sarvam-30b needs ≥ 2000</span>
              )}
            </label>
            <input
              type="number"
              className={inputClass}
              value={config.llmMaxTokens}
              onChange={(e) => set('llmMaxTokens', Number(e.target.value))}
              min={100}
              step={100}
            />
          </div>
        </div>

        {/* Language */}
        <div>
          <label className={labelClass}>
            <Globe size={11} className="inline mr-1 text-[#475569]" />
            Language
          </label>
          <select
            className={inputClass}
            value={config.language}
            onChange={(e) => set('language', e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-[#1a1d24]">
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Voice — only for Sarvam (bulbul:v3) */}
        {config.agentType === 'sarvam' && (
          <div>
            <label className={labelClass}>
              <Mic size={11} className="inline mr-1 text-[#475569]" />
              Voice (bulbul:v3)
            </label>
            <select
              className={inputClass}
              value={config.voice}
              onChange={(e) => set('voice', e.target.value)}
            >
              {['F', 'M'].map((gender) => (
                <optgroup key={gender} label={gender === 'F' ? '— Female —' : '— Male —'} className="bg-[#1a1d24]">
                  {BULBUL_V3_VOICES.filter(v => v.gender === gender).map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#1a1d24]">
                      {v.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Start Button */}
      <div className="px-4 py-4 border-t border-[#2a2d38]">
        <button
          onClick={() => onStart(config)}
          disabled={isConnected || isConnecting || !config.customerName}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
            isConnected
              ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 cursor-default'
              : isConnecting
              ? 'bg-indigo-600/50 border border-indigo-500/30 text-white cursor-wait'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-transparent shadow-lg shadow-indigo-500/20'
          }`}
        >
          {isConnecting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Connecting...
            </>
          ) : isConnected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Session Active
            </>
          ) : (
            <>
              <Play size={16} />
              Start Session
            </>
          )}
        </button>
      </div>
    </div>
  );
}
