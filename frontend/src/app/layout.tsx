import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import AppLayout from '@/components/layout/AppLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Converse - Loan Collection AI',
  description: 'AI-powered voice agent platform for loan collection',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0a0b0e] text-[#f1f5f9]`}>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
