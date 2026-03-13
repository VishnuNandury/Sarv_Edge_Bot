'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import AgentConfig from '@/components/voice-agent/AgentConfig';
import VoiceInterface from '@/components/voice-agent/VoiceInterface';
import type { AgentConfig as AgentConfigType } from '@/lib/types';

// ReactFlow must be client-side only
const FlowVisualizer = dynamic(
  () => import('@/components/voice-agent/FlowVisualizer'),
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[#475569] text-sm">Loading flow visualizer...</p>
      </div>
    </div>
  )}
);

export default function VoiceAgentPage() {
  const [config, setConfig] = useState<AgentConfigType>({
    customerName: '',
    customerId: '',
    loanAmount: 0,
    outstandingAmount: 0,
    dpd: 0,
    dueDate: '',
    flowId: 'flow_basic',
    agentType: 'sarvam',
    language: 'hi-IN',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>();

  const handleStart = useCallback((cfg: AgentConfigType) => {
    setConfig(cfg);
    setIsConnecting(true);
    setCurrentNodeId('start');
  }, []);

  const handleConnectionChange = useCallback((connected: boolean, connecting: boolean) => {
    setIsConnected(connected);
    setIsConnecting(connecting);
    if (!connected && !connecting) {
      setCurrentNodeId(undefined);
    }
  }, []);

  const handleNodeChange = useCallback((nodeId: string) => {
    setCurrentNodeId(nodeId);
  }, []);

  const handleSessionStart = useCallback((sid: string) => {
    setSessionId(sid);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel: Config */}
      <div className="w-[300px] flex-shrink-0 border-r border-[#2a2d38] bg-[#111318] overflow-hidden flex flex-col">
        <AgentConfig
          onStart={handleStart}
          isConnected={isConnected}
          isConnecting={isConnecting}
        />
      </div>

      {/* Center Panel: Flow Visualizer */}
      <div className="flex-1 bg-[#0a0b0e] relative overflow-hidden">
        <FlowVisualizer
          flowId={config.flowId || 'flow_basic'}
          currentNodeId={currentNodeId}
        />

        {/* Session info overlay */}
        {isConnected && config.customerName && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1a1d24]/95 border border-[#2a2d38] rounded-xl px-5 py-3 backdrop-blur-sm flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-[#94a3b8]">Active Call</span>
            </div>
            <div className="h-4 w-px bg-[#2a2d38]" />
            <div>
              <span className="text-xs font-medium text-[#f1f5f9]">{config.customerName}</span>
              <span className="text-xs text-[#475569] ml-2">DPD {config.dpd}</span>
            </div>
            {sessionId && (
              <>
                <div className="h-4 w-px bg-[#2a2d38]" />
                <span className="text-[10px] font-mono text-[#475569]">{sessionId.slice(0, 12)}…</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Panel: Voice Interface */}
      <div className="w-[300px] flex-shrink-0 border-l border-[#2a2d38] bg-[#111318] overflow-hidden flex flex-col">
        <VoiceInterface
          config={config}
          isConnected={isConnected}
          isConnecting={isConnecting}
          sessionId={sessionId}
          onConnectionChange={handleConnectionChange}
          onNodeChange={handleNodeChange}
          onSessionStart={handleSessionStart}
        />
      </div>
    </div>
  );
}
