export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loan_amount: number;
  outstanding_amount: number;
  dpd: number;
  due_date?: string;
  loan_id?: string;
  segment: 'prime' | 'standard' | 'risky';
  preferred_language: string;
  status: 'active' | 'inactive' | 'completed';
  tags?: string[];
  created_at: string;
}

export interface CallSession {
  id: string;
  customer_id: string;
  customer?: Customer;
  campaign_id?: string;
  agent_type: 'sarvam' | 'whisper_edge';
  flow_id: string;
  status: 'active' | 'completed' | 'failed' | 'voicemail' | 'no_answer';
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  tier: 'tier_1' | 'tier_2' | 'tier_3';
  outcome?: string;
  commitment_amount?: number;
  commitment_date?: string;
  payment_made?: boolean;
  payment_amount?: number;
  receipt_confirmed?: boolean;
  notes?: string;
  created_at: string;
}

export interface Transcript {
  id: string;
  session_id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: string;
  confidence?: number;
  language?: string;
  turn_index: number;
}

export interface SessionMetrics {
  id: string;
  session_id: string;
  stt_latency_ms?: number;
  llm_latency_ms?: number;
  tts_latency_ms?: number;
  total_latency_ms?: number;
  tokens_input?: number;
  tokens_output?: number;
  cost_usd?: number;
  ttfb_ms?: number;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  agent_type: 'sarvam' | 'whisper_edge';
  flow_id: string;
  schedule_time?: string;
  total_customers: number;
  called: number;
  connected: number;
  committed: number;
  created_at: string;
}

export interface FlowNode {
  id: string;
  label: string;
  type: 'start' | 'action' | 'decision' | 'dtmf' | 'end';
  description: string;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
}

export interface ConversationFlow {
  id: string;
  name: string;
  description: string;
  tier: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// WebSocket event types — backend may send flat fields or nested under `data`
export type WSEvent = {
  type: string;
  // flat fields (actual backend format)
  speaker?: string;
  text?: string;
  timestamp?: string;
  turn_index?: number;
  node_id?: string;
  node?: { id: string; label?: string };
  level?: number;
  digit?: string;
  message?: string;
  status?: string;
  outcome?: string;
  // nested data (legacy / fallback)
  data?: {
    speaker?: string;
    text?: string;
    timestamp?: string;
    turn_index?: number;
    node_id?: string;
    node_label?: string;
    stt_latency_ms?: number;
    llm_latency_ms?: number;
    tts_latency_ms?: number;
    total_latency_ms?: number;
    tokens_input?: number;
    tokens_output?: number;
    digit?: string;
    level?: number;
    reason?: string;
    outcome?: string;
    message?: string;
  };
  // metrics flat fields
  stt_latency_ms?: number;
  llm_latency_ms?: number;
  tts_latency_ms?: number;
  total_latency_ms?: number;
  tokens_input?: number;
  tokens_output?: number;
};

export type LLMProvider = 'groq' | 'sarvam' | 'openai';

export interface AgentConfig {
  customerName: string;
  customerId?: string;
  loanAmount: number;
  outstandingAmount: number;
  dpd: number;
  dueDate: string;
  flowId: string;
  agentType: 'sarvam' | 'whisper_edge';
  language: string;
  voice: string;
  llmProvider: LLMProvider;
  llmMaxTokens: number;
}

export interface DashboardStats {
  total_customers: number;
  active_campaigns: number;
  calls_today: number;
  calls_this_week: number;
  payment_rate: number;
  avg_call_duration: number;
  total_committed_today: number;
  calls_by_outcome: Record<string, number>;
  recent_sessions: Array<CallSession & { customer_name: string }>;
  hourly_calls: Array<{ hour: string; count: number }>;
}

export interface AnalyticsOverview {
  total_calls: number;
  total_connected: number;
  total_committed: number;
  total_payments: number;
  avg_stt_latency: number;
  avg_llm_latency: number;
  avg_tts_latency: number;
  daily_calls: Array<{ date: string; total: number; commitment: number; refused: number; voicemail: number; callback: number }>;
  agent_comparison: Array<{ agent: string; calls: number; success_rate: number; avg_latency: number }>;
  flow_performance: Array<{ flow: string; calls: number; completion_rate: number }>;
  latency_trends: Array<{ date: string; stt: number; llm: number; tts: number }>;
  dpd_distribution: Array<{ range: string; count: number }>;
  outcome_breakdown: Record<string, number>;
}
