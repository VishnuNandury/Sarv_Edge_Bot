'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node, Edge, addEdge, Connection,
  useNodesState, useEdgesState,
  Background, Controls, MiniMap,
  BackgroundVariant, MarkerType,
  NodeProps, Handle, Position,
  ReactFlowProvider, useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Play, Zap, GitBranch, Hash, StopCircle,
  Save, Upload, Download, Trash2, Plus, Check, X,
} from 'lucide-react';

// ── Types & Constants ─────────────────────────────────────────────────────────

type NodeType = 'start' | 'action' | 'decision' | 'dtmf' | 'end';

const STORAGE_KEY = 'sarvam_custom_flows';

const NODE_COLORS: Record<NodeType, { bg: string; border: string; icon: string }> = {
  start:    { bg: '#1e1b4b', border: '#6366f1', icon: '#818cf8' },
  action:   { bg: '#1e293b', border: '#475569', icon: '#94a3b8' },
  decision: { bg: '#1c1408', border: '#d97706', icon: '#f59e0b' },
  dtmf:     { bg: '#052e16', border: '#16a34a', icon: '#4ade80' },
  end:      { bg: '#1f0a0a', border: '#b91c1c', icon: '#f87171' },
};

const NODE_ICONS = {
  start: Play, action: Zap, decision: GitBranch, dtmf: Hash, end: StopCircle,
};

const TOOLBOX_NODES: Array<{ type: NodeType; label: string; desc: string }> = [
  { type: 'start',    label: 'Start',      desc: 'Flow entry point' },
  { type: 'action',   label: 'Action',     desc: 'Agent speaks/acts' },
  { type: 'decision', label: 'Decision',   desc: 'Branch on response' },
  { type: 'dtmf',     label: 'DTMF Input', desc: 'Capture keypad' },
  { type: 'end',      label: 'End',        desc: 'Terminate call' },
];

interface NodeData {
  label: string;
  description: string;
  nodeType: NodeType;
  systemPrompt: string;
  outcome?: string;
}

interface StoredFlow {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
}

// ── Builder Custom Node ───────────────────────────────────────────────────────

function BuilderNode({ data, selected }: NodeProps<NodeData>) {
  const colors = NODE_COLORS[data.nodeType] ?? NODE_COLORS.action;
  const Icon = NODE_ICONS[data.nodeType] ?? NODE_ICONS.action;

  return (
    <div style={{
      background: colors.bg,
      borderColor: selected ? '#6366f1' : colors.border,
      borderWidth: 2, borderStyle: 'solid', borderRadius: 10,
      padding: '7px 10px', minWidth: 130, maxWidth: 180, cursor: 'pointer',
      boxShadow: selected
        ? '0 0 0 2px #6366f1, 0 0 16px rgba(99,102,241,0.25)'
        : `0 0 6px ${colors.border}25`,
    }}>
      <Handle type="target" position={Position.Top}
        style={{ background: colors.border, border: 'none', width: 6, height: 6 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          background: `${colors.icon}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={10} color={colors.icon} />
        </div>
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.label}
          </div>
          {data.description && (
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1, lineHeight: 1.3,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {data.description}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom}
        style={{ background: colors.border, border: 'none', width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = { custom: BuilderNode };

// ── Shared Input Styles ───────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', background: '#0a0b0e', border: '1px solid #2a2d38',
  borderRadius: 6, padding: '5px 8px', color: '#f1f5f9', fontSize: 11,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 500, color: '#94a3b8', marginBottom: 4,
};
const btnSt: React.CSSProperties = {
  background: '#1a1d24', border: '1px solid #2a2d38', borderRadius: 6,
  padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
};

// ── Properties Panels ────────────────────────────────────────────────────────

function NodePanel({ node, onUpdate, onDelete }: {
  node: Node<NodeData>;
  onUpdate: (key: keyof NodeData, value: string) => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>Node Properties</span>
        <button onClick={onDelete} style={{ background: '#7f1d1d30', border: '1px solid #7f1d1d50', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>
          <Trash2 size={11} color="#f87171" />
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelSt}>Type</label>
        <select value={node.data.nodeType} onChange={e => onUpdate('nodeType', e.target.value)} style={inputSt}>
          <option value="start">Start</option>
          <option value="action">Action</option>
          <option value="decision">Decision</option>
          <option value="dtmf">DTMF Input</option>
          <option value="end">End</option>
        </select>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelSt}>Label</label>
        <input value={node.data.label} onChange={e => onUpdate('label', e.target.value)} style={inputSt} placeholder="Node label..." />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelSt}>Description</label>
        <textarea value={node.data.description} onChange={e => onUpdate('description', e.target.value)}
          style={{ ...inputSt, height: 56, resize: 'vertical' }} placeholder="What this node does..." />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelSt}>System Prompt</label>
        <textarea value={node.data.systemPrompt} onChange={e => onUpdate('systemPrompt', e.target.value)}
          style={{ ...inputSt, height: 120, resize: 'vertical' }}
          placeholder={'Agent instructions at this step.\nUse {customer_name}, {outstanding_amount}, etc.'} />
      </div>

      {node.data.nodeType === 'end' && (
        <div style={{ marginBottom: 10 }}>
          <label style={labelSt}>Outcome</label>
          <select value={node.data.outcome ?? 'completed'} onChange={e => onUpdate('outcome', e.target.value)} style={inputSt}>
            <option value="completed">Completed</option>
            <option value="payment_made">Payment Made</option>
            <option value="callback">Callback Scheduled</option>
            <option value="no_answer">No Answer</option>
            <option value="refused">Refused</option>
          </select>
        </div>
      )}

      <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: '#0a0b0e', border: '1px solid #2a2d38', fontSize: 9, color: '#475569', lineHeight: 1.7 }}>
        Available variables: <code style={{ color: '#94a3b8' }}>{'{customer_name}'}</code>,{' '}
        <code style={{ color: '#94a3b8' }}>{'{outstanding_amount}'}</code>,{' '}
        <code style={{ color: '#94a3b8' }}>{'{due_date}'}</code>,{' '}
        <code style={{ color: '#94a3b8' }}>{'{employee_name}'}</code>
      </div>
    </div>
  );
}

function EdgePanel({ edge, onUpdate, onDelete }: {
  edge: Edge;
  onUpdate: (key: string, value: string) => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>Edge Properties</span>
        <button onClick={onDelete} style={{ background: '#7f1d1d30', border: '1px solid #7f1d1d50', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}>
          <Trash2 size={11} color="#f87171" />
        </button>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={labelSt}>Branch Label</label>
        <input value={String(edge.label ?? '')} onChange={e => onUpdate('label', e.target.value)}
          style={inputSt} placeholder="e.g. Yes, No, Payment made..." />
      </div>
      <div style={{ fontSize: 9, color: '#475569', marginTop: 8, lineHeight: 1.6 }}>
        <code style={{ color: '#94a3b8' }}>{edge.source}</code>
        {' → '}
        <code style={{ color: '#94a3b8' }}>{edge.target}</code>
      </div>
    </div>
  );
}

function InfoPanel({ flowName, flowDesc, nodeCount, edgeCount }: {
  flowName: string; flowDesc: string; nodeCount: number; edgeCount: number;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', marginBottom: 10 }}>Flow Info</div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2, fontWeight: 500 }}>{flowName || 'Untitled Flow'}</div>
      {flowDesc && <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>{flowDesc}</div>}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['Nodes', nodeCount], ['Edges', edgeCount]].map(([label, val]) => (
          <div key={String(label)} style={{ flex: 1, padding: '8px', background: '#0a0b0e', borderRadius: 6, border: '1px solid #2a2d38', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{val}</div>
            <div style={{ fontSize: 9, color: '#475569' }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.8 }}>
        <strong style={{ color: '#94a3b8', display: 'block', marginBottom: 4 }}>How to use</strong>
        1. Drag node types from the left panel<br />
        2. Drop onto the canvas to place them<br />
        3. Drag from a node handle to connect<br />
        4. Click a node or edge to edit it<br />
        5. Name your flow and click Save<br />
        6. Saved flows appear in Voice Agent
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>Export Format</div>
        <pre style={{ fontSize: 9, color: '#475569', background: '#0a0b0e', border: '1px solid #2a2d38', borderRadius: 6, padding: 8, overflow: 'auto', lineHeight: 1.5, margin: 0 }}>
{`{
  "name": "My Flow",
  "nodes": [{
    "id": "greeting",
    "label": "Greeting",
    "type": "start",
    "description": "...",
    "system_prompt_snippet": "..."
  }],
  "edges": [{
    "source": "greeting",
    "target": "next",
    "label": "Proceed"
  }]
}`}
        </pre>
      </div>
    </div>
  );
}

// ── Main Builder Canvas (needs ReactFlowProvider context) ─────────────────────

function FlowBuilderCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [flowDesc, setFlowDesc] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [savedFlows, setSavedFlows] = useState<StoredFlow[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState(false);
  const rfWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedFlows(JSON.parse(raw));
    } catch {}
  }, []);

  const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId]);

  // ── Canvas handlers ───────────────────────────────────────────────────────

  const onConnect = useCallback((params: Connection) =>
    setEdges(eds => addEdge({
      ...params, type: 'smoothstep', label: '',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
      style: { stroke: '#475569', strokeWidth: 1.5 },
      labelStyle: { fill: '#94a3b8', fontSize: 10 },
      labelBgStyle: { fill: '#1a1d24', rx: 4 },
    }, eds)), [setEdges]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!rfWrapper.current) return;
    const nodeType = e.dataTransfer.getData('application/reactflow') as NodeType;
    if (!nodeType) return;
    const bounds = rfWrapper.current.getBoundingClientRect();
    const position = project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    setNodes(nds => [...nds, {
      id: genId(), type: 'custom', position,
      data: {
        label: TOOLBOX_NODES.find(t => t.type === nodeType)?.label ?? 'Node',
        description: '', nodeType, systemPrompt: '',
      },
    }]);
  }, [project, setNodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id); setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id); setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null); setSelectedEdgeId(null);
  }, []);

  // ── Data updates ─────────────────────────────────────────────────────────

  const updateNode = useCallback((key: keyof NodeData, value: string) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(n =>
      n.id === selectedNodeId ? { ...n, data: { ...n.data, [key]: value } } : n
    ));
  }, [selectedNodeId, setNodes]);

  const updateEdge = useCallback((key: string, value: string) => {
    if (!selectedEdgeId) return;
    setEdges(eds => eds.map(e => e.id === selectedEdgeId ? { ...e, [key]: value } : e));
  }, [selectedEdgeId, setEdges]);

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
      setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setEdges(eds => eds.filter(e => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges]);

  // ── Save / Load / Delete ─────────────────────────────────────────────────

  const persistFlows = (flows: StoredFlow[]) => {
    setSavedFlows(flows);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flows)); } catch {}
  };

  const saveFlow = useCallback(() => {
    const id = activeFlowId ?? genId();
    const flow: StoredFlow = { id, name: flowName || 'Untitled Flow', description: flowDesc, createdAt: new Date().toISOString(), nodes, edges };
    const updated = savedFlows.some(f => f.id === id) ? savedFlows.map(f => f.id === id ? flow : f) : [...savedFlows, flow];
    persistFlows(updated);
    setActiveFlowId(id);
    setSaveMsg(true);
    setTimeout(() => setSaveMsg(false), 2000);
  }, [activeFlowId, flowName, flowDesc, nodes, edges, savedFlows]);

  const loadFlow = useCallback((flow: StoredFlow) => {
    setNodes(flow.nodes); setEdges(flow.edges);
    setFlowName(flow.name); setFlowDesc(flow.description);
    setActiveFlowId(flow.id); setSelectedNodeId(null); setSelectedEdgeId(null);
  }, [setNodes, setEdges]);

  const deleteFlow = useCallback((id: string) => {
    const updated = savedFlows.filter(f => f.id !== id);
    persistFlows(updated);
    if (activeFlowId === id) {
      setActiveFlowId(null); setNodes([]); setEdges([]);
      setFlowName('Untitled Flow'); setFlowDesc('');
    }
  }, [savedFlows, activeFlowId, setNodes, setEdges]);

  const newFlow = useCallback(() => {
    setNodes([]); setEdges([]); setFlowName('Untitled Flow'); setFlowDesc('');
    setActiveFlowId(null); setSelectedNodeId(null); setSelectedEdgeId(null);
  }, [setNodes, setEdges]);

  // ── Export / Import ──────────────────────────────────────────────────────

  const exportFlow = useCallback(() => {
    const data = {
      id: activeFlowId ?? `flow_${genId()}`,
      name: flowName, description: flowDesc,
      nodes: nodes.map(n => ({
        id: n.id, label: n.data.label, type: n.data.nodeType,
        description: n.data.description, system_prompt_snippet: n.data.systemPrompt,
        position: n.position,
      })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: String(e.label ?? ''), type: 'llm' })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${(flowName || 'flow').replace(/\s+/g, '_')}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [activeFlowId, flowName, flowDesc, nodes, edges]);

  const importFlow = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          setNodes((data.nodes ?? []).map((n: any) => ({
            id: n.id, type: 'custom',
            position: n.position ?? { x: 0, y: 0 },
            data: { label: n.label ?? n.id, description: n.description ?? '', nodeType: n.type ?? 'action', systemPrompt: n.system_prompt_snippet ?? '' },
          })));
          setEdges((data.edges ?? []).map((e: any) => ({
            id: e.id ?? genId(), source: e.source, target: e.target,
            label: e.label ?? '', type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
            style: { stroke: '#475569', strokeWidth: 1.5 },
            labelStyle: { fill: '#94a3b8', fontSize: 10 },
            labelBgStyle: { fill: '#1a1d24', rx: 4 },
          })));
          setFlowName(data.name ?? 'Imported Flow');
          setFlowDesc(data.description ?? '');
          setActiveFlowId(null);
        } catch { alert('Invalid flow JSON'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0b0e' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid #2a2d38', background: '#111318', flexShrink: 0 }}>
        <input value={flowName} onChange={e => setFlowName(e.target.value)}
          style={{ ...inputSt, width: 180, fontWeight: 600, fontSize: 13 }} placeholder="Flow name..." />
        <input value={flowDesc} onChange={e => setFlowDesc(e.target.value)}
          style={{ ...inputSt, flex: 1, color: '#94a3b8' }} placeholder="Description (optional)..." />
        <button onClick={newFlow} title="New flow" style={btnSt}><Plus size={14} color="#94a3b8" /></button>
        <button onClick={saveFlow} title="Save" style={{ ...btnSt, background: saveMsg ? '#14532d' : '#1a1d24', borderColor: saveMsg ? '#16a34a50' : '#2a2d38' }}>
          {saveMsg ? <Check size={14} color="#4ade80" /> : <Save size={14} color="#94a3b8" />}
          <span style={{ fontSize: 11, color: saveMsg ? '#4ade80' : '#94a3b8' }}>{saveMsg ? 'Saved' : 'Save'}</span>
        </button>
        <button onClick={importFlow} title="Import JSON" style={btnSt}><Upload size={14} color="#94a3b8" /><span style={{ fontSize: 11, color: '#94a3b8' }}>Import</span></button>
        <button onClick={exportFlow} title="Export JSON" style={btnSt}><Download size={14} color="#94a3b8" /><span style={{ fontSize: 11, color: '#94a3b8' }}>Export</span></button>
        {(selectedNodeId || selectedEdgeId) && (
          <button onClick={deleteSelected} title="Delete selected" style={{ ...btnSt, background: '#450a0a', borderColor: '#7f1d1d50' }}>
            <Trash2 size={14} color="#f87171" />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: Toolbox + Saved Flows */}
        <div style={{ width: 188, flexShrink: 0, borderRight: '1px solid #2a2d38', background: '#111318', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Node Toolbox */}
          <div style={{ padding: '10px 8px 6px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Node Types</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {TOOLBOX_NODES.map(({ type, label, desc }) => {
                const c = NODE_COLORS[type];
                const Icon = NODE_ICONS[type];
                return (
                  <div key={type} draggable
                    onDragStart={e => { e.dataTransfer.setData('application/reactflow', type); e.dataTransfer.effectAllowed = 'move'; }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 7,
                      border: `1px solid ${c.border}40`, background: c.bg, cursor: 'grab', userSelect: 'none' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: `${c.icon}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={10} color={c.icon} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#f1f5f9' }}>{label}</div>
                      <div style={{ fontSize: 9, color: '#475569' }}>{desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height: 1, background: '#2a2d38', margin: '4px 10px' }} />

          {/* Saved Flows */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#475569', letterSpacing: 2, textTransform: 'uppercase' }}>
                Saved ({savedFlows.length})
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 6px 8px' }}>
              {savedFlows.length === 0 ? (
                <div style={{ padding: '10px 6px', color: '#2a2d38', fontSize: 11, textAlign: 'center' }}>No saved flows yet</div>
              ) : savedFlows.map(flow => (
                <div key={flow.id} style={{
                  padding: '7px 10px', borderRadius: 8, marginBottom: 3,
                  border: `1px solid ${activeFlowId === flow.id ? '#6366f1' : '#2a2d38'}`,
                  background: activeFlowId === flow.id ? '#1e1b4b30' : '#0a0b0e',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <div onClick={() => loadFlow(flow)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flow.name}</div>
                    <div style={{ fontSize: 9, color: '#475569' }}>{flow.nodes.length} nodes · {flow.edges.length} edges</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteFlow(flow.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                    <X size={11} color="#475569" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '8px 10px', borderTop: '1px solid #2a2d38' }}>
            <div style={{ fontSize: 9, color: '#2a2d38', lineHeight: 1.6 }}>
              Drag nodes · Connect handles · Click to edit
            </div>
          </div>
        </div>

        {/* Center: Canvas */}
        <div ref={rfWrapper} style={{ flex: 1, position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            deleteKeyCode="Delete"
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e2028" />
            <Controls style={{ background: '#1a1d24', border: '1px solid #2a2d38', borderRadius: 8 }} />
            <MiniMap
              style={{ background: '#111318', border: '1px solid #2a2d38', borderRadius: 8 }}
              nodeColor={n => (NODE_COLORS[(n.data as NodeData)?.nodeType] ?? NODE_COLORS.action).border}
            />
          </ReactFlow>
          {nodes.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.15 }}>⬡</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2a2d38' }}>Drag nodes from the left panel</div>
                <div style={{ fontSize: 12, color: '#1e2028', marginTop: 4 }}>Connect them to build your flow</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Properties */}
        <div style={{ width: 256, flexShrink: 0, borderLeft: '1px solid #2a2d38', background: '#111318', overflow: 'auto', padding: 12 }}>
          {selectedNode
            ? <NodePanel node={selectedNode} onUpdate={updateNode} onDelete={deleteSelected} />
            : selectedEdge
            ? <EdgePanel edge={selectedEdge} onUpdate={updateEdge} onDelete={deleteSelected} />
            : <InfoPanel flowName={flowName} flowDesc={flowDesc} nodeCount={nodes.length} edgeCount={edges.length} />}
        </div>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowBuilderCanvas />
    </ReactFlowProvider>
  );
}
