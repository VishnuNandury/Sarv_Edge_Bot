'use client';

import { useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Zap, GitBranch, Hash, StopCircle, type LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

interface FlowVisualizerProps {
  flowId: string;
  currentNodeId?: string;
}

type NodeType = 'start' | 'action' | 'decision' | 'dtmf' | 'end';

const NODE_COLORS: Record<NodeType, { bg: string; border: string; icon: string; glow: string }> = {
  start: { bg: '#1e1b4b', border: '#6366f1', icon: '#818cf8', glow: 'rgba(99,102,241,0.6)' },
  action: { bg: '#1e293b', border: '#475569', icon: '#94a3b8', glow: 'rgba(71,85,105,0.6)' },
  decision: { bg: '#1c1408', border: '#d97706', icon: '#f59e0b', glow: 'rgba(217,119,6,0.6)' },
  dtmf: { bg: '#052e16', border: '#16a34a', icon: '#4ade80', glow: 'rgba(22,163,74,0.6)' },
  end: { bg: '#1f0a0a', border: '#b91c1c', icon: '#f87171', glow: 'rgba(185,28,28,0.6)' },
};

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>;
const NODE_ICONS: Record<NodeType, LucideIcon> = {
  start: Play,
  action: Zap,
  decision: GitBranch,
  dtmf: Hash,
  end: StopCircle,
};

interface CustomNodeData {
  label: string;
  description: string;
  nodeType: NodeType;
  isActive: boolean;
}

function CustomNode({ data }: NodeProps<CustomNodeData>) {
  const colors = NODE_COLORS[data.nodeType] || NODE_COLORS.action;
  const Icon = NODE_ICONS[data.nodeType] || NODE_ICONS.action;

  return (
    <div
      className={`relative px-4 py-3 rounded-xl border-2 transition-all duration-300 min-w-[160px] max-w-[200px]`}
      style={{
        background: colors.bg,
        borderColor: data.isActive ? '#6366f1' : colors.border,
        boxShadow: data.isActive
          ? `0 0 20px rgba(99,102,241,0.8), 0 0 40px rgba(99,102,241,0.3)`
          : `0 0 8px ${colors.glow}30`,
        transform: data.isActive ? 'scale(1.05)' : 'scale(1)',
        animation: data.isActive ? 'node-pulse 2s infinite' : 'none',
      }}
    >
      {/* Active pulse ring */}
      {data.isActive && (
        <div
          className="absolute inset-0 rounded-xl border-2 border-indigo-400"
          style={{
            animation: 'pulse-ring-flow 2s ease-out infinite',
          }}
        />
      )}

      <Handle
        type="target"
        position={Position.Top}
        style={{ background: colors.border, border: 'none', width: 8, height: 8 }}
      />

      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${colors.icon}20` }}
        >
          <Icon size={14} color={colors.icon} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[#f1f5f9] leading-tight truncate">
            {data.label}
          </div>
          {data.description && (
            <div className="text-[10px] text-[#94a3b8] mt-0.5 leading-tight line-clamp-2">
              {data.description}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: colors.border, border: 'none', width: 8, height: 8 }}
      />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

// Pre-defined flow layouts
const FLOW_DEFINITIONS: Record<string, { nodes: Array<{ id: string; label: string; type: NodeType; description: string; x: number; y: number }>; edges: Array<{ id: string; source: string; target: string; label: string }> }> = {
  flow_basic: {
    nodes: [
      { id: 'start', label: 'Intro', type: 'start', description: 'Greet & identify customer', x: 100, y: 0 },
      { id: 'verify', label: 'Verify Identity', type: 'action', description: 'Confirm customer details', x: 100, y: 120 },
      { id: 'inform', label: 'Inform Due Amount', type: 'action', description: 'State outstanding balance', x: 100, y: 240 },
      { id: 'ask_payment', label: 'Request Payment', type: 'decision', description: 'Ask for payment commitment', x: 100, y: 360 },
      { id: 'committed', label: 'Commitment', type: 'action', description: 'Record promise to pay', x: -80, y: 480 },
      { id: 'declined', label: 'Declined', type: 'action', description: 'Note refusal reason', x: 280, y: 480 },
      { id: 'end', label: 'Close Call', type: 'end', description: 'Thank & disconnect', x: 100, y: 600 },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'verify', label: '' },
      { id: 'e2', source: 'verify', target: 'inform', label: '' },
      { id: 'e3', source: 'inform', target: 'ask_payment', label: '' },
      { id: 'e4', source: 'ask_payment', target: 'committed', label: 'Yes' },
      { id: 'e5', source: 'ask_payment', target: 'declined', label: 'No' },
      { id: 'e6', source: 'committed', target: 'end', label: '' },
      { id: 'e7', source: 'declined', target: 'end', label: '' },
    ],
  },
  flow_standard: {
    nodes: [
      { id: 'start', label: 'Intro', type: 'start', description: 'Greet & identify', x: 150, y: 0 },
      { id: 'verify', label: 'Verify', type: 'action', description: 'Confirm identity', x: 150, y: 110 },
      { id: 'inform', label: 'Inform Balance', type: 'action', description: 'Share due amount & date', x: 150, y: 220 },
      { id: 'negotiate', label: 'Negotiate', type: 'decision', description: 'Offer payment options', x: 150, y: 330 },
      { id: 'full_pay', label: 'Full Payment', type: 'action', description: 'Confirm full settlement', x: 0, y: 440 },
      { id: 'partial', label: 'Part Payment', type: 'dtmf', description: 'Enter partial amount', x: 150, y: 440 },
      { id: 'callback', label: 'Callback', type: 'action', description: 'Schedule follow-up', x: 300, y: 440 },
      { id: 'confirm', label: 'Confirm Details', type: 'action', description: 'Confirm payment plan', x: 150, y: 550 },
      { id: 'end', label: 'Close', type: 'end', description: 'End call with summary', x: 150, y: 660 },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'verify', label: '' },
      { id: 'e2', source: 'verify', target: 'inform', label: '' },
      { id: 'e3', source: 'inform', target: 'negotiate', label: '' },
      { id: 'e4', source: 'negotiate', target: 'full_pay', label: 'Full' },
      { id: 'e5', source: 'negotiate', target: 'partial', label: 'Partial' },
      { id: 'e6', source: 'negotiate', target: 'callback', label: 'Later' },
      { id: 'e7', source: 'full_pay', target: 'confirm', label: '' },
      { id: 'e8', source: 'partial', target: 'confirm', label: '' },
      { id: 'e9', source: 'callback', target: 'confirm', label: '' },
      { id: 'e10', source: 'confirm', target: 'end', label: '' },
    ],
  },
  flow_advanced: {
    nodes: [
      { id: 'start', label: 'Intro', type: 'start', description: 'Greet & identify', x: 180, y: 0 },
      { id: 'verify', label: 'Verify', type: 'action', description: 'Multi-factor verify', x: 180, y: 100 },
      { id: 'assess', label: 'Assess Risk', type: 'decision', description: 'Check DPD & segment', x: 180, y: 200 },
      { id: 'low_risk', label: 'Soft Ask', type: 'action', description: 'Gentle payment request', x: 30, y: 310 },
      { id: 'high_risk', label: 'Legal Notice', type: 'action', description: 'Mention legal action', x: 330, y: 310 },
      { id: 'negotiate', label: 'Negotiate', type: 'decision', description: 'Offer EMI restructure', x: 180, y: 310 },
      { id: 'dtmf_amount', label: 'Enter Amount', type: 'dtmf', description: 'DTMF payment amount', x: 60, y: 430 },
      { id: 'waiver', label: 'Offer Waiver', type: 'action', description: 'Partial interest waiver', x: 300, y: 430 },
      { id: 'escalate', label: 'Escalate', type: 'action', description: 'Transfer to supervisor', x: 180, y: 540 },
      { id: 'commitment', label: 'Commitment', type: 'action', description: 'Record PTP details', x: 60, y: 540 },
      { id: 'end', label: 'Close', type: 'end', description: 'Summary & close', x: 180, y: 650 },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'verify', label: '' },
      { id: 'e2', source: 'verify', target: 'assess', label: '' },
      { id: 'e3', source: 'assess', target: 'low_risk', label: 'Low DPD' },
      { id: 'e4', source: 'assess', target: 'negotiate', label: 'Mid' },
      { id: 'e5', source: 'assess', target: 'high_risk', label: 'High DPD' },
      { id: 'e6', source: 'low_risk', target: 'negotiate', label: '' },
      { id: 'e7', source: 'negotiate', target: 'dtmf_amount', label: 'Accept' },
      { id: 'e8', source: 'negotiate', target: 'waiver', label: 'Hesitant' },
      { id: 'e9', source: 'negotiate', target: 'escalate', label: 'Refuse' },
      { id: 'e10', source: 'dtmf_amount', target: 'commitment', label: '' },
      { id: 'e11', source: 'waiver', target: 'commitment', label: '' },
      { id: 'e12', source: 'high_risk', target: 'escalate', label: '' },
      { id: 'e13', source: 'commitment', target: 'end', label: '' },
      { id: 'e14', source: 'escalate', target: 'end', label: '' },
    ],
  },
};

export default function FlowVisualizer({ flowId, currentNodeId }: FlowVisualizerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const buildGraph = useCallback(
    (fId: string, activeNodeId?: string) => {
      const def = FLOW_DEFINITIONS[fId] || FLOW_DEFINITIONS.flow_basic;

      const rfNodes: Node[] = def.nodes.map((n) => ({
        id: n.id,
        type: 'custom',
        position: { x: n.x, y: n.y },
        data: {
          label: n.label,
          description: n.description,
          nodeType: n.type,
          isActive: n.id === activeNodeId,
        },
      }));

      const rfEdges: Edge[] = def.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#2a2d38' },
        style: { stroke: '#2a2d38', strokeWidth: 1.5 },
        labelStyle: { fill: '#475569', fontSize: 10 },
        labelBgStyle: { fill: '#1a1d24', rx: 4 },
        animated: e.source === activeNodeId,
      }));

      setNodes(rfNodes);
      setEdges(rfEdges);
    },
    [setNodes, setEdges]
  );

  useEffect(() => {
    buildGraph(flowId, currentNodeId);
  }, [flowId, currentNodeId, buildGraph]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  return (
    <div className="w-full h-full relative">
      <style jsx global>{`
        @keyframes pulse-ring-flow {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.3); }
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={proOptions}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e2028" />
        <Controls
          style={{
            background: '#1a1d24',
            border: '1px solid #2a2d38',
            borderRadius: 8,
          }}
        />
      </ReactFlow>

      {/* Flow label */}
      <div className="absolute top-3 left-3 bg-[#1a1d24]/90 border border-[#2a2d38] rounded-lg px-3 py-1.5 backdrop-blur-sm">
        <div className="text-[10px] text-[#475569] uppercase tracking-widest">Active Flow</div>
        <div className="text-xs font-semibold text-[#f1f5f9]">
          {flowId === 'flow_basic' ? 'Basic (Tier 1)' : flowId === 'flow_standard' ? 'Standard (Tier 2)' : 'Advanced (Tier 3)'}
        </div>
      </div>

      {currentNodeId && (
        <div className="absolute top-3 right-3 bg-indigo-600/20 border border-indigo-500/40 rounded-lg px-3 py-1.5 backdrop-blur-sm flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs text-indigo-300 font-medium">Live</span>
        </div>
      )}
    </div>
  );
}
