'use client';

import dynamic from 'next/dynamic';

const FlowBuilder = dynamic(
  () => import('@/components/agent-flows/FlowBuilder'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0b0e]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#475569] text-sm">Loading flow builder...</p>
        </div>
      </div>
    ),
  }
);

export default function AgentFlowsPage() {
  return (
    <div className="h-full overflow-hidden">
      <FlowBuilder />
    </div>
  );
}
