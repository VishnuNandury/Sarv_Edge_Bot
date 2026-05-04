'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import AuthGuard from './AuthGuard';

const AUTH_EXACT = ['/'];
const AUTH_PREFIX = ['/login', '/signup'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    AUTH_EXACT.includes(pathname) ||
    AUTH_PREFIX.some(p => pathname.startsWith(p));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-[#0a0b0e] overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto bg-[#0a0b0e]">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
