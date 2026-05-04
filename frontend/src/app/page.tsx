'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth';

const features = [
  {
    icon: '🎙️',
    title: 'Multilingual Voice AI',
    desc: 'Native support for Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, and more. Customers hear a voice that feels local.',
  },
  {
    icon: '🔀',
    title: 'Visual Flow Builder',
    desc: 'Drag-and-drop conversation designer. Build tier-based collection flows with zero code — deploy in seconds.',
  },
  {
    icon: '🧠',
    title: 'Smart LLM Engine',
    desc: 'Switch between Sarvam AI and Groq/OpenAI mid-campaign. Each node can run a different model.',
  },
  {
    icon: '📊',
    title: 'Real-time Analytics',
    desc: 'Live STT/LLM/TTS latency metrics, commitment rates, and recovery dashboards updated per call.',
  },
  {
    icon: '📣',
    title: 'Campaign Management',
    desc: 'Segment customers by DPD, outstanding amount, or tags. Schedule bulk outreach with a single click.',
  },
  {
    icon: '🔒',
    title: 'Compliant by Design',
    desc: 'Full call transcripts, audit trails, and per-user data isolation — ready for RBI digital lending guidelines.',
  },
];

const steps = [
  { n: '01', title: 'Upload Customers', desc: 'Import via CSV or add individually. Segment by DPD, loan amount, and language preference.' },
  { n: '02', title: 'Build Your Flow', desc: 'Use the visual builder to define conversation tiers, fallback paths, and commitment triggers.' },
  { n: '03', title: 'Launch & Track', desc: 'Start a campaign, monitor live calls, and watch real-time recovery metrics roll in.' },
];

const languages = ['Hindi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Malayalam', 'Odia'];

const stats = [
  { value: '< 500ms', label: 'End-to-end latency' },
  { value: '10+', label: 'Indian languages' },
  { value: '3-tier', label: 'Escalation logic' },
  { value: '100%', label: 'Calls transcribed' },
];

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0a0b0e]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">C</div>
            <span className="font-semibold text-lg">Converse</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#languages" className="hover:text-white transition-colors">Languages</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded-lg font-medium">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            AI-powered loan collection for Indian lenders
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            Recover loans faster with{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              multilingual voice AI
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Build, deploy, and monitor AI voice agents that call borrowers in their native language —
            no engineering team required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 transition-colors px-8 py-3.5 rounded-xl font-semibold text-base">
              Start free →
            </Link>
            <Link href="/login" className="w-full sm:w-auto border border-white/10 hover:border-white/20 transition-colors px-8 py-3.5 rounded-xl font-medium text-base text-gray-300">
              Sign in to dashboard
            </Link>
          </div>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {stats.map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Everything you need</h2>
            <p className="text-gray-400">Built for the realities of Indian loan collection</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <div key={f.title} className="bg-white/[0.03] border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Up and running in minutes</h2>
            <p className="text-gray-400">Three steps from zero to live calls</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map(s => (
              <div key={s.n} className="relative">
                <div className="text-5xl font-bold text-white/5 mb-4">{s.n}</div>
                <h3 className="font-semibold text-base mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages */}
      <section id="languages" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-3">Speaks India&apos;s languages</h2>
          <p className="text-gray-400 mb-10">Your agents adapt to the borrower&apos;s preferred language automatically</p>
          <div className="flex flex-wrap justify-center gap-3">
            {languages.map(lang => (
              <span key={lang} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/5 rounded-full px-4 py-2 text-sm text-gray-300">
                <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-2xl p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">Ready to automate collections?</h2>
            <p className="text-gray-400 mb-8">Sign in with the default credentials or create your own account to get started.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 transition-colors px-8 py-3.5 rounded-xl font-semibold">
                Create account →
              </Link>
              <Link href="/login" className="w-full sm:w-auto text-gray-400 hover:text-white transition-colors px-8 py-3.5 rounded-xl border border-white/10 hover:border-white/20">
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-xs text-gray-600">Default: admin / converse1</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">C</div>
            <span>Converse Business — AI Voice Agent Platform</span>
          </div>
          <span>Built with Pipecat · Sarvam AI · Next.js · FastAPI</span>
        </div>
      </footer>
    </div>
  );
}
