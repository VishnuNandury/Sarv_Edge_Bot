'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Search, ChevronDown, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearAuth } from '@/lib/auth';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/voice-agent': 'Voice Agent',
  '/conversations': 'Conversations',
  '/customers': 'Customers',
  '/campaigns': 'Campaigns',
  '/analytics': 'Analytics',
  '/agent-flows': 'Agent Flows',
  '/settings': 'Settings',
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const segment = '/' + (pathname.split('/')[1] || 'dashboard');
  const title = pageTitles[segment] || 'Converse';

  const user = getUser();
  const initials = user?.username?.slice(0, 2).toUpperCase() || 'A';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.replace('/login');
  };

  return (
    <header className="h-14 border-b border-[#2a2d38] bg-[#111318] flex items-center px-6 gap-4 flex-shrink-0">
      <h1 className="text-[#f1f5f9] font-semibold text-lg flex-1">{title}</h1>

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        <Search className="absolute left-3 text-[#475569] w-4 h-4" />
        <input
          type="text"
          placeholder="Search..."
          className="pl-9 pr-4 py-1.5 bg-[#1a1d24] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] placeholder-[#475569] focus:outline-none focus:border-indigo-500/50 w-52"
        />
      </div>

      {/* Notifications */}
      <button className="relative w-9 h-9 rounded-lg bg-[#1a1d24] border border-[#2a2d38] flex items-center justify-center hover:bg-[#22262f] transition-colors">
        <Bell className="w-4 h-4 text-[#94a3b8]" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
      </button>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1d24] border border-[#2a2d38] hover:bg-[#22262f] transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
          <span className="text-sm text-[#94a3b8] hidden sm:block">{user?.username || 'Admin'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#1a1d24] border border-[#2a2d38] rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2d38]">
              <div className="text-xs font-medium text-[#f1f5f9] truncate">{user?.username}</div>
              <div className="text-[10px] text-[#475569] truncate">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
