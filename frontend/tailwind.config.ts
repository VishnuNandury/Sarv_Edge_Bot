import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0b0e',
        'bg-secondary': '#111318',
        'bg-card': '#1a1d24',
        'bg-hover': '#22262f',
        'border-default': '#2a2d38',
        'border-subtle': '#1e2028',
        'accent': '#6366f1',
        'accent-hover': '#4f46e5',
        'accent-subtle': '#1e1b4b',
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        'text-muted': '#475569',
        'success': '#10b981',
        'warning': '#f59e0b',
        'danger': '#ef4444',
        'info': '#3b82f6',
      },
      animation: {
        'node-pulse': 'node-pulse 2s infinite',
        'audio-wave': 'audio-wave 1s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'ping-slow': 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
      },
      keyframes: {
        'node-pulse': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(99,102,241,0.4)' },
          '50%': { boxShadow: '0 0 25px rgba(99,102,241,0.9), 0 0 50px rgba(99,102,241,0.3)' },
        },
        'audio-wave': {
          '0%, 100%': { transform: 'scaleY(0.5)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
