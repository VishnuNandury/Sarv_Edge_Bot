import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN');
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getDpdColor(dpd: number): string {
  if (dpd <= 7) return 'text-emerald-400';
  if (dpd <= 30) return 'text-amber-400';
  return 'text-red-400';
}

export function getDpdBgColor(dpd: number): string {
  if (dpd <= 7) return 'bg-emerald-400/10 text-emerald-400';
  if (dpd <= 30) return 'bg-amber-400/10 text-amber-400';
  return 'bg-red-400/10 text-red-400';
}

export function getLatencyColor(ms: number, type: 'stt' | 'llm' | 'tts' | 'total'): string {
  const thresholds = {
    stt: { good: 300, ok: 500 },
    llm: { good: 500, ok: 1000 },
    tts: { good: 300, ok: 500 },
    total: { good: 1000, ok: 2000 },
  };
  const t = thresholds[type];
  if (ms <= t.good) return 'text-emerald-400';
  if (ms <= t.ok) return 'text-amber-400';
  return 'text-red-400';
}

export function getOutcomeColor(outcome: string): string {
  const map: Record<string, string> = {
    commitment: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    payment_made: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    refused: 'bg-red-400/10 text-red-400 border-red-400/20',
    voicemail: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    callback: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    no_answer: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
    completed: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20',
    failed: 'bg-red-500/10 text-red-500 border-red-500/20',
    active: 'bg-green-400/10 text-green-400 border-green-400/20',
  };
  return map[outcome] || 'bg-slate-400/10 text-slate-400 border-slate-400/20';
}

export function getSegmentColor(segment: string): string {
  const map: Record<string, string> = {
    prime: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    standard: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    risky: 'bg-red-400/10 text-red-400 border-red-400/20',
  };
  return map[segment] || 'bg-slate-400/10 text-slate-400';
}

export function getCampaignStatusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
    active: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    paused: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    completed: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20',
  };
  return map[status] || 'bg-slate-400/10 text-slate-400';
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '…';
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
