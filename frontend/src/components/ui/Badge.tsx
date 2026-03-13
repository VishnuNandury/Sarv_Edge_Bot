import { cn } from '@/lib/utils';

interface BadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

const statusMap: Record<string, string> = {
  // Call outcomes
  commitment: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  payment_made: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  refused: 'bg-red-400/10 text-red-400 border-red-400/20',
  voicemail: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  callback: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  no_answer: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
  // Session status
  active: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  completed: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  // Customer status
  inactive: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
  // Campaign status
  draft: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
  paused: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  // Segment
  prime: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  standard: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  risky: 'bg-red-400/10 text-red-400 border-red-400/20',
  // Agent type
  sarvam: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20',
  whisper_edge: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  // Tier
  tier_1: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  tier_2: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  tier_3: 'bg-red-400/10 text-red-400 border-red-400/20',
};

const labelMap: Record<string, string> = {
  commitment: 'Committed',
  payment_made: 'Paid',
  refused: 'Refused',
  voicemail: 'Voicemail',
  callback: 'Callback',
  no_answer: 'No Answer',
  whisper_edge: 'Whisper Edge',
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};

export default function Badge({ status, className, size = 'sm' }: BadgeProps) {
  const colorClass = statusMap[status] || 'bg-slate-400/10 text-slate-400 border-slate-400/20';
  const label = labelMap[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium capitalize',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}
