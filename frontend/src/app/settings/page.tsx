'use client';

import { useState } from 'react';
import { Eye, EyeOff, Save, AlertTriangle, Download, Trash2, Bell, Shield, Database, User } from 'lucide-react';

export default function SettingsPage() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    // Account
    companyName: 'Converse Business',
    adminEmail: 'admin@converse.ai',
    timezone: 'Asia/Kolkata',
    // Agent defaults
    defaultLanguage: 'hi-IN',
    maxCallDuration: 600,
    retryAttempts: 3,
    retryDelay: 60,
    // Notifications
    emailAlerts: true,
    callFailureAlerts: true,
    dailySummary: true,
    paymentAlerts: true,
    // Data retention
    retentionDays: 90,
    autoArchive: true,
    keepTranscripts: true,
  });

  const apiKeys = [
    { id: 'sarvam', label: 'Sarvam API Key', value: 'sk-sarvam-xxxxxxxxxxxxxxxxxxxxxxxxxx' },
    { id: 'openai', label: 'OpenAI API Key', value: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxx' },
    { id: 'twilio_sid', label: 'Twilio Account SID', value: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
    { id: 'twilio_token', label: 'Twilio Auth Token', value: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  ];

  const handleSave = (section: string) => {
    setSaved(section);
    setTimeout(() => setSaved(null), 2000);
  };

  const toggleKey = (id: string) => setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));

  const inputClass = 'w-full bg-[#111318] border border-[#2a2d38] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-indigo-500/50';
  const labelClass = 'block text-xs text-[#94a3b8] mb-1.5';

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h2 className="text-[#f1f5f9] text-xl font-bold">Settings</h2>

      {/* Account Info */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
        <div className="px-5 py-4 border-b border-[#2a2d38] flex items-center gap-2">
          <User size={16} className="text-[#475569]" />
          <h3 className="text-[#f1f5f9] font-semibold text-sm">Account Information</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Company Name</label>
              <input className={inputClass} value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Admin Email</label>
              <input type="email" className={inputClass} value={settings.adminEmail} onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Timezone</label>
            <select className={inputClass} value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
            </select>
          </div>
          <button onClick={() => handleSave('account')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-medium transition-colors">
            <Save size={14} />
            {saved === 'account' ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
        <div className="px-5 py-4 border-b border-[#2a2d38] flex items-center gap-2">
          <Shield size={16} className="text-[#475569]" />
          <h3 className="text-[#f1f5f9] font-semibold text-sm">API Keys</h3>
        </div>
        <div className="p-5 space-y-3">
          {apiKeys.map((key) => (
            <div key={key.id}>
              <label className={labelClass}>{key.label}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey[key.id] ? 'text' : 'password'}
                    value={key.value}
                    readOnly
                    className={`${inputClass} font-mono text-xs pr-10`}
                  />
                  <button
                    onClick={() => toggleKey(key.id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8] transition-colors"
                  >
                    {showKey[key.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button className="px-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-xs text-[#94a3b8] hover:bg-[#22262f] transition-colors">
                  Rotate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Settings */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
        <div className="px-5 py-4 border-b border-[#2a2d38]">
          <h3 className="text-[#f1f5f9] font-semibold text-sm">Agent Settings</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Default Language</label>
              <select className={inputClass} value={settings.defaultLanguage} onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}>
                <option value="hi-IN">Hindi (हिन्दी)</option>
                <option value="en-IN">English (India)</option>
                <option value="ta-IN">Tamil (தமிழ்)</option>
                <option value="te-IN">Telugu (తెలుగు)</option>
                <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                <option value="mr-IN">Marathi (मराठी)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Max Call Duration (seconds)</label>
              <input type="number" className={inputClass} value={settings.maxCallDuration} onChange={(e) => setSettings({ ...settings, maxCallDuration: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Retry Attempts</label>
              <input type="number" className={inputClass} value={settings.retryAttempts} min={0} max={5} onChange={(e) => setSettings({ ...settings, retryAttempts: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelClass}>Retry Delay (minutes)</label>
              <input type="number" className={inputClass} value={settings.retryDelay} onChange={(e) => setSettings({ ...settings, retryDelay: Number(e.target.value) })} />
            </div>
          </div>
          <button onClick={() => handleSave('agent')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-medium transition-colors">
            <Save size={14} />
            {saved === 'agent' ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
        <div className="px-5 py-4 border-b border-[#2a2d38] flex items-center gap-2">
          <Bell size={16} className="text-[#475569]" />
          <h3 className="text-[#f1f5f9] font-semibold text-sm">Notifications</h3>
        </div>
        <div className="p-5 space-y-4">
          {[
            { key: 'emailAlerts', label: 'Email Alerts', desc: 'Receive alerts via email' },
            { key: 'callFailureAlerts', label: 'Call Failure Alerts', desc: 'Notify when calls fail repeatedly' },
            { key: 'dailySummary', label: 'Daily Summary', desc: 'Send daily performance report' },
            { key: 'paymentAlerts', label: 'Payment Commitment Alerts', desc: 'Alert when customer commits to payment' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <div className="text-sm text-[#f1f5f9] font-medium">{label}</div>
                <div className="text-xs text-[#475569]">{desc}</div>
              </div>
              <button
                onClick={() => setSettings((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${
                  settings[key as keyof typeof settings] ? 'bg-indigo-600' : 'bg-[#2a2d38]'
                }`}
                style={{ minWidth: 40, height: 22 }}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  settings[key as keyof typeof settings] ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data Retention */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38]">
        <div className="px-5 py-4 border-b border-[#2a2d38] flex items-center gap-2">
          <Database size={16} className="text-[#475569]" />
          <h3 className="text-[#f1f5f9] font-semibold text-sm">Data Retention</h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelClass}>Retention Period (days)</label>
            <input type="number" className={inputClass} value={settings.retentionDays} onChange={(e) => setSettings({ ...settings, retentionDays: Number(e.target.value) })} />
            <p className="text-xs text-[#475569] mt-1">Sessions older than this will be archived</p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { key: 'autoArchive', label: 'Auto-archive old sessions' },
              { key: 'keepTranscripts', label: 'Keep transcripts in archives' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setSettings((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
                    settings[key as keyof typeof settings] ? 'bg-indigo-600 border-indigo-500' : 'border-[#2a2d38] bg-[#111318]'
                  }`}
                >
                  {settings[key as keyof typeof settings] && <div className="w-2 h-2 bg-white rounded-sm" />}
                </div>
                <span className="text-sm text-[#94a3b8]">{label}</span>
              </label>
            ))}
          </div>
          <button onClick={() => handleSave('retention')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-medium transition-colors">
            <Save size={14} />
            {saved === 'retention' ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#1a1d24] rounded-xl border border-red-500/20">
        <div className="px-5 py-4 border-b border-red-500/20 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <h3 className="text-red-400 font-semibold text-sm">Danger Zone</h3>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-[#1e2028]">
            <div>
              <div className="text-sm text-[#f1f5f9] font-medium">Export All Data</div>
              <div className="text-xs text-[#475569]">Download a complete export of your data</div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] hover:bg-[#22262f] transition-colors">
              <Download size={14} />
              Export
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm text-red-400 font-medium">Delete All Data</div>
              <div className="text-xs text-[#475569]">Permanently delete all customers, sessions, and data</div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-500/30 rounded-lg text-sm text-red-400 hover:bg-red-600/20 transition-colors">
              <Trash2 size={14} />
              Delete All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
