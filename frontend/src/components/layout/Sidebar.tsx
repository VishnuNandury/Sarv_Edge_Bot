'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Mic,
  MessageSquare,
  Users,
  Megaphone,
  BarChart3,
  Settings,
  Phone,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/voice-agent', label: 'Voice Agent', icon: Mic },
  { href: '/agent-flows', label: 'Agent Flows', icon: Network },
  { href: '/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] min-h-screen flex flex-col bg-[#111318] border-r border-[#2a2d38] flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2a2d38]">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-[#f1f5f9] text-base tracking-wider">CONVERSE</div>
            <div className="text-[10px] text-[#475569] tracking-widest uppercase">Loan Collection AI</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-[#94a3b8] hover:bg-[#22262f] hover:text-[#f1f5f9] border border-transparent'
              )}
            >
              <Icon
                className={cn(
                  'w-4.5 h-4.5 flex-shrink-0',
                  isActive ? 'text-indigo-400' : 'text-[#475569]'
                )}
                size={18}
              />
              {item.label}
              {item.href === '/voice-agent' && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom version badge */}
      <div className="px-5 py-4 border-t border-[#2a2d38]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#475569]">Sarvam Bot</span>
          <span className="text-[10px] bg-[#1a1d24] border border-[#2a2d38] rounded px-2 py-0.5 text-[#475569]">
            v0.1.0
          </span>
        </div>
      </div>
    </aside>
  );
}
