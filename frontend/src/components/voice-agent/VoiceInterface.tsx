'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { PhoneOff, Volume2, VolumeX, Mic, MicOff, Hash } from 'lucide-react';
import { voiceApi } from '@/lib/api';
import AudioWaveform from './AudioWaveform';
import MetricsPanel from './MetricsPanel';
import TranscriptPanel from './TranscriptPanel';
import type { AgentConfig, WSEvent } from '@/lib/types';

interface VoiceInterfaceProps {
  config: AgentConfig;
  isConnected: boolean;
  isConnecting: boolean;
  sessionId: string | null;
  onConnectionChange: (connected: boolean, connecting: boolean) => void;
  onNodeChange: (nodeId: string) => void;
  onSessionStart: (sessionId: string) => void;
}

interface TranscriptEntry {
  speaker: 'agent' | 'customer' | 'dtmf';
  text: string;
  timestamp: string;
  turn_index?: number;
}

interface Metrics {
  stt_latency_ms?: number;
  llm_latency_ms?: number;
  tts_latency_ms?: number;
  total_latency_ms?: number;
  tokens_input?: number;
  tokens_output?: number;
}

const DTMF_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export default function VoiceInterface({
  config,
  isConnected,
  isConnecting,
  sessionId,
  onConnectionChange,
  onNodeChange,
  onSessionStart,
}: VoiceInterfaceProps) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [agentLevel, setAgentLevel] = useState(0);
  const [customerLevel, setCustomerLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [startTime, setStartTime] = useState<Date | undefined>();
  const [dtmfFeedback, setDtmfFeedback] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => null);
      audioContextRef.current = null;
    }
    setAgentLevel(0);
    setCustomerLevel(0);
  }, []);

  const startAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const measure = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.slice(0, 20).reduce((a, b) => a + b, 0) / 20 / 255;
        setCustomerLevel(avg);
        animFrameRef.current = requestAnimationFrame(measure);
      };
      measure();
    } catch {
      // AudioContext not available
    }
  }, []);

  const connect = useCallback(async () => {
    onConnectionChange(false, true);

    try {
      // Get ICE servers
      let iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
      try {
        const iceRes = await voiceApi.getIceServers();
        iceServers = iceRes.data.iceServers;
      } catch {
        // Use default STUN
      }

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      startAudioAnalyser(stream);

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      // Add tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote audio
      pc.ontrack = (event) => {
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.muted = isSpeakerOff;
        remoteAudio.play().catch(() => null);

        // Measure agent audio level via simulation
        const interval = setInterval(() => {
          if (!isConnected) { clearInterval(interval); return; }
          setAgentLevel(Math.random() * 0.6);
        }, 100);
      };

      // Create session
      const sessionRes = await voiceApi.createSession(config);
      const newSessionId = sessionRes.data.session_id;
      onSessionStart(newSessionId);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') resolve();
        };
        setTimeout(resolve, 3000); // fallback
      });

      // Send offer
      const answerRes = await voiceApi.sendOffer(newSessionId, pc.localDescription!.sdp);
      await pc.setRemoteDescription({ type: 'answer', sdp: answerRes.data.sdp });

      // Connect WebSocket
      // Derive WebSocket URL from current page location when no env var is set
      const wsBase = process.env.NEXT_PUBLIC_WS_URL ||
        (typeof window !== 'undefined'
          ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
          : 'ws://localhost:8000');
      const wsUrl = `${wsBase}/ws/voice/${newSessionId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStartTime(new Date());
        onConnectionChange(true, false);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSEvent;
          switch (msg.type) {
            case 'transcript':
              setTranscript((prev) => [
                ...prev,
                {
                  speaker: msg.data.speaker as 'agent' | 'customer',
                  text: msg.data.text,
                  timestamp: msg.data.timestamp,
                  turn_index: msg.data.turn_index,
                },
              ]);
              break;
            case 'node_change':
              onNodeChange(msg.data.node_id);
              break;
            case 'metrics':
              setMetrics(msg.data);
              break;
            case 'audio_level':
              setAgentLevel(msg.data.level);
              break;
            case 'dtmf':
              setTranscript((prev) => [
                ...prev,
                { speaker: 'dtmf', text: msg.data.digit, timestamp: new Date().toISOString() },
              ]);
              break;
            case 'ended':
              cleanup();
              onConnectionChange(false, false);
              break;
            case 'error':
              console.error('WS Error:', msg.data.message);
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        cleanup();
        onConnectionChange(false, false);
      };

      ws.onclose = () => {
        onConnectionChange(false, false);
      };
    } catch (err) {
      console.error('Connection error:', err);
      cleanup();
      onConnectionChange(false, false);
    }
  }, [config, isSpeakerOff, cleanup, startAudioAnalyser, onConnectionChange, onNodeChange, onSessionStart, isConnected]);

  const disconnect = useCallback(async () => {
    if (sessionId) {
      try {
        await voiceApi.endSession(sessionId);
      } catch {
        // ignore
      }
    }
    cleanup();
    onConnectionChange(false, false);
  }, [sessionId, cleanup, onConnectionChange]);

  const sendDtmf = useCallback(
    (digit: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'dtmf', digit }));
        setDtmfFeedback(digit);
        setTimeout(() => setDtmfFeedback(null), 300);
        setTranscript((prev) => [
          ...prev,
          { speaker: 'dtmf', text: digit, timestamp: new Date().toISOString() },
        ]);
      }
    },
    []
  );

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = isMuted;
      });
    }
    setIsMuted((v) => !v);
  }, [isMuted]);

  // Expose connect to parent via effect
  useEffect(() => {
    if (isConnecting && !isConnected && !pcRef.current) {
      connect();
    }
  }, [isConnecting, isConnected, connect]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#2a2d38]">
        <h2 className="text-[#f1f5f9] font-semibold text-sm flex items-center gap-2">
          <Mic size={16} className={isConnected ? 'text-emerald-400' : 'text-[#475569]'} />
          Voice Interface
          {isConnected && (
            <span className="flex items-center gap-1 ml-auto bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400">Connected</span>
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Audio Waveform */}
        <div>
          <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest mb-2">
            Audio Monitor
          </div>
          <AudioWaveform
            agentLevel={agentLevel}
            customerLevel={customerLevel}
            isConnected={isConnected}
          />
        </div>

        {/* Controls */}
        {isConnected && (
          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                isMuted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-[#111318] border-[#2a2d38] text-[#94a3b8] hover:bg-[#1a1d24]'
              }`}
            >
              {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={() => setIsSpeakerOff((v) => !v)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                isSpeakerOff
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-[#111318] border-[#2a2d38] text-[#94a3b8] hover:bg-[#1a1d24]'
              }`}
            >
              {isSpeakerOff ? <VolumeX size={13} /> : <Volume2 size={13} />}
              Speaker
            </button>
          </div>
        )}

        {/* Transcript */}
        <div>
          <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest mb-2">
            Live Transcript
          </div>
          <div className="bg-[#0a0b0e] rounded-lg border border-[#2a2d38] p-3 h-48 overflow-y-auto">
            <TranscriptPanel entries={transcript} />
          </div>
        </div>

        {/* DTMF Pad */}
        {isConnected && (
          <div>
            <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-widest mb-2 flex items-center gap-1">
              <Hash size={10} />
              DTMF Pad
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DTMF_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => sendDtmf(key)}
                  className={`dtmf-btn py-2.5 rounded-lg border text-sm font-bold font-mono transition-all ${
                    dtmfFeedback === key
                      ? 'bg-indigo-600 border-indigo-500 text-white scale-95'
                      : 'bg-[#111318] border-[#2a2d38] text-[#94a3b8] hover:bg-[#1a1d24] hover:border-indigo-500/50 hover:text-[#f1f5f9]'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Metrics */}
        <MetricsPanel metrics={metrics} isConnected={isConnected} startTime={startTime} />
      </div>

      {/* End Call */}
      {isConnected && (
        <div className="px-4 py-4 border-t border-[#2a2d38]">
          <button
            onClick={disconnect}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 text-sm font-semibold transition-all"
          >
            <PhoneOff size={16} />
            End Call
          </button>
        </div>
      )}
    </div>
  );
}
