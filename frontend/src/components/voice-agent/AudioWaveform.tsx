'use client';

import { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  agentLevel: number;
  customerLevel: number;
  isConnected: boolean;
}

export default function AudioWaveform({ agentLevel, customerLevel, isConnected }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const agentHistoryRef = useRef<number[]>(new Array(60).fill(0));
  const customerHistoryRef = useRef<number[]>(new Array(60).fill(0));

  useEffect(() => {
    // Push new levels
    agentHistoryRef.current.push(agentLevel * 0.8 + Math.random() * agentLevel * 0.2);
    agentHistoryRef.current.shift();
    customerHistoryRef.current.push(customerLevel * 0.8 + Math.random() * customerLevel * 0.2);
    customerHistoryRef.current.shift();
  }, [agentLevel, customerLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0a0b0e';
      ctx.fillRect(0, 0, W, H);

      // Center line
      ctx.strokeStyle = '#1e2028';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      if (!isConnected) {
        // Show flatline when not connected
        ctx.strokeStyle = '#2a2d38';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Agent waveform (indigo, upper half)
      const agentData = agentHistoryRef.current;
      ctx.beginPath();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 8;

      for (let i = 0; i < agentData.length; i++) {
        const x = (i / agentData.length) * W;
        const amp = agentData[i] * (H / 4);
        const y = H / 2 - amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Agent waveform fill
      ctx.shadowBlur = 0;
      const agentGrad = ctx.createLinearGradient(0, 0, 0, H / 2);
      agentGrad.addColorStop(0, 'rgba(99,102,241,0.3)');
      agentGrad.addColorStop(1, 'rgba(99,102,241,0)');
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      for (let i = 0; i < agentData.length; i++) {
        const x = (i / agentData.length) * W;
        const amp = agentData[i] * (H / 4);
        ctx.lineTo(x, H / 2 - amp);
      }
      ctx.lineTo(W, H / 2);
      ctx.closePath();
      ctx.fillStyle = agentGrad;
      ctx.fill();

      // Customer waveform (emerald, lower half)
      const custData = customerHistoryRef.current;
      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;

      for (let i = 0; i < custData.length; i++) {
        const x = (i / custData.length) * W;
        const amp = custData[i] * (H / 4);
        const y = H / 2 + amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Customer waveform fill
      ctx.shadowBlur = 0;
      const custGrad = ctx.createLinearGradient(0, H / 2, 0, H);
      custGrad.addColorStop(0, 'rgba(16,185,129,0)');
      custGrad.addColorStop(1, 'rgba(16,185,129,0.3)');
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      for (let i = 0; i < custData.length; i++) {
        const x = (i / custData.length) * W;
        const amp = custData[i] * (H / 4);
        ctx.lineTo(x, H / 2 + amp);
      }
      ctx.lineTo(W, H / 2);
      ctx.closePath();
      ctx.fillStyle = custGrad;
      ctx.fill();

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isConnected]);

  return (
    <div className="relative bg-[#0a0b0e] rounded-lg border border-[#2a2d38] overflow-hidden">
      <canvas
        ref={canvasRef}
        width={280}
        height={80}
        className="w-full h-20"
        style={{ display: 'block' }}
      />
      {/* Labels */}
      <div className="absolute top-1 left-2 flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-indigo-400" />
        <span className="text-[9px] text-indigo-400">Agent</span>
      </div>
      <div className="absolute bottom-1 left-2 flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-[9px] text-emerald-400">Customer</span>
      </div>
      {isConnected && (
        <div className="absolute top-1 right-2 flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded px-1.5 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[9px] text-red-400 font-bold">LIVE</span>
        </div>
      )}
    </div>
  );
}
