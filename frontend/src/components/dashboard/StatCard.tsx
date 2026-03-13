import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;
  changeType?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'indigo' | 'orange' | 'red' | 'purple';
  subtitle?: string;
  loading?: boolean;
}

const colorMap = {
  blue: 'bg-blue-500/10 text-blue-400',
  green: 'bg-emerald-500/10 text-emerald-400',
  indigo: 'bg-indigo-500/10 text-indigo-400',
  orange: 'bg-orange-500/10 text-orange-400',
  red: 'bg-red-500/10 text-red-400',
  purple: 'bg-purple-500/10 text-purple-400',
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'neutral',
  color = 'indigo',
  subtitle,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-10 w-10 rounded-lg" />
        </div>
        <div className="skeleton h-8 w-32 rounded mb-2" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-5 hover:border-[#3a3d4a] transition-all">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[#94a3b8] text-sm font-medium">{title}</p>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colorMap[color])}>
          <Icon size={20} />
        </div>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <p className="text-[#f1f5f9] text-2xl font-bold tracking-tight">{value}</p>
        {change !== undefined && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium mb-0.5',
              changeType === 'up' && 'text-emerald-400',
              changeType === 'down' && 'text-red-400',
              changeType === 'neutral' && 'text-[#475569]'
            )}
          >
            {changeType === 'up' && <TrendingUp size={12} />}
            {changeType === 'down' && <TrendingDown size={12} />}
            {changeType === 'neutral' && <Minus size={12} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      {subtitle && <p className="text-[#475569] text-xs mt-1">{subtitle}</p>}
    </div>
  );
}
