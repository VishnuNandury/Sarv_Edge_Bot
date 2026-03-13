import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1a1d24] border border-[#2a2d38] flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[#475569]" />
      </div>
      <h3 className="text-[#f1f5f9] font-medium text-base mb-1">{title}</h3>
      <p className="text-[#475569] text-sm max-w-sm mb-4">{description}</p>
      {action && action}
    </div>
  );
}
