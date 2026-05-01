'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { setAuth } from '@/lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', phone: '', password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.signup({
        username: form.username,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      setAuth(res.data.access_token, res.data.user);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-[#0a0b0e] border border-[#2a2d38] rounded-lg px-4 py-2.5 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-indigo-500/70 transition-colors';

  return (
    <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-[#f1f5f9] text-lg tracking-wider">CONVERSE</div>
              <div className="text-[10px] text-[#475569] tracking-widest uppercase">Loan Collection AI</div>
            </div>
          </div>
        </div>

        <div className="bg-[#111318] border border-[#2a2d38] rounded-2xl p-8">
          <h1 className="text-[#f1f5f9] font-bold text-xl mb-1">Create account</h1>
          <p className="text-[#475569] text-sm mb-6">Get started with Converse</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Username *</label>
              <input type="text" className={inputCls} value={form.username} onChange={set('username')} placeholder="johndoe" required />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Email *</label>
              <input type="email" className={inputCls} value={form.email} onChange={set('email')} placeholder="john@company.com" required />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Phone (optional)</label>
              <input type="tel" className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+91 9876543210" />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Password *</label>
              <input type="password" className={inputCls} value={form.password} onChange={set('password')} placeholder="••••••••" required minLength={6} />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Confirm Password *</label>
              <input type="password" className={inputCls} value={form.confirm_password} onChange={set('confirm_password')} placeholder="••••••••" required />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-wait text-white font-semibold rounded-lg text-sm transition-colors"
            >
              {loading ? <><Loader2 size={15} className="animate-spin" />Creating account...</> : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#475569]">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
