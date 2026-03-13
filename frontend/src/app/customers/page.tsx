'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Upload, ChevronLeft, ChevronRight, Phone, ExternalLink } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { customersApi } from '@/lib/api';
import { formatCurrency, formatDate, getDpdBgColor } from '@/lib/utils';
import type { Customer } from '@/lib/types';

// Import modal components lazily
interface CustomerFormProps {
  customer?: Customer | null;
  onSave: (data: Partial<Customer>) => Promise<void>;
  onClose: () => void;
}

function CustomerForm({ customer, onSave, onClose }: CustomerFormProps) {
  const [form, setForm] = useState<Partial<Customer>>(customer || {
    name: '', phone: '', email: '', loan_amount: 0, outstanding_amount: 0,
    dpd: 0, segment: 'standard', preferred_language: 'hi-IN', status: 'active',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const inputClass = 'w-full bg-[#111318] border border-[#2a2d38] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-indigo-500/50';
  const labelClass = 'block text-xs text-[#94a3b8] mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1d24] border border-[#2a2d38] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-[#f1f5f9] font-semibold text-lg mb-5">
          {customer ? 'Edit Customer' : 'Add Customer'}
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Full Name *</label>
              <input className={inputClass} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Phone *</label>
              <input className={inputClass} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Loan Amount (₹)</label>
              <input type="number" className={inputClass} value={form.loan_amount || 0} onChange={(e) => setForm({ ...form, loan_amount: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelClass}>Outstanding (₹)</label>
              <input type="number" className={inputClass} value={form.outstanding_amount || 0} onChange={(e) => setForm({ ...form, outstanding_amount: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>DPD</label>
              <input type="number" className={inputClass} value={form.dpd || 0} onChange={(e) => setForm({ ...form, dpd: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelClass}>Segment</label>
              <select className={inputClass} value={form.segment || 'standard'} onChange={(e) => setForm({ ...form, segment: e.target.value as Customer['segment'] })}>
                <option value="prime">Prime</option>
                <option value="standard">Standard</option>
                <option value="risky">Risky</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Language</label>
              <select className={inputClass} value={form.preferred_language || 'hi-IN'} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
                <option value="hi-IN">Hindi</option>
                <option value="en-IN">English</option>
                <option value="ta-IN">Tamil</option>
                <option value="te-IN">Telugu</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="date" className={inputClass} value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[#2a2d38] text-[#94a3b8] text-sm hover:bg-[#22262f] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : customer ? 'Update' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ onClose, onUpload }: { onClose: () => void; onUpload: (f: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported?: number; errors?: number; message?: string } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await customersApi.upload(file);
      setResult(res.data);
      onUpload(file);
    } catch {
      setResult({ message: 'Upload failed. Please check your CSV format.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1d24] border border-[#2a2d38] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-[#f1f5f9] font-semibold text-lg mb-2">Upload Customers CSV</h3>
        <p className="text-[#475569] text-sm mb-5">
          CSV must have: name, phone, loan_amount, outstanding_amount, dpd, segment, preferred_language
        </p>

        {!result ? (
          <>
            <div
              className="border-2 border-dashed border-[#2a2d38] rounded-xl p-8 text-center hover:border-indigo-500/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('csv-input')?.click()}
            >
              <Upload className="mx-auto mb-3 text-[#475569]" size={32} />
              <p className="text-[#94a3b8] text-sm">{file ? file.name : 'Click to select CSV file'}</p>
              <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[#2a2d38] text-[#94a3b8] text-sm hover:bg-[#22262f] transition-colors">Cancel</button>
              <button onClick={handleUpload} disabled={!file || uploading} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`rounded-xl p-4 mb-5 ${result.imported ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              {result.imported !== undefined && <p className="text-emerald-400 text-sm">✓ {result.imported} customers imported</p>}
              {result.errors !== undefined && result.errors > 0 && <p className="text-amber-400 text-sm mt-1">⚠ {result.errors} rows had errors</p>}
              {result.message && <p className="text-[#94a3b8] text-sm mt-1">{result.message}</p>}
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const MOCK_CUSTOMERS: Customer[] = Array.from({ length: 15 }, (_, i) => ({
  id: `cus-${i + 1}`,
  name: ['Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sunita Verma', 'Deepak Singh', 'Kavita Rao', 'Suresh Gupta', 'Meera Iyer'][i % 8],
  phone: `+91 9${String(8 - i % 3)}${String(i + 1).padStart(2, '0')} 765432`,
  loan_amount: 100000 + i * 25000,
  outstanding_amount: 10000 + i * 5000,
  dpd: [3, 12, 45, 7, 28, 60, 2, 15][i % 8],
  segment: (['prime', 'standard', 'risky', 'standard', 'risky', 'risky', 'prime', 'standard'] as Customer['segment'][])[i % 8],
  preferred_language: ['hi-IN', 'en-IN', 'ta-IN'][i % 3],
  status: (['active', 'active', 'active', 'inactive', 'completed'] as Customer['status'][])[i % 5],
  created_at: new Date(Date.now() - i * 86400000).toISOString(),
  tags: (['urgent', 'vip', 'follow-up', 'disputed'][i % 4] ? [['urgent', 'vip', 'follow-up', 'disputed'][i % 4]] : []) as string[],
}));

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [status, setStatus] = useState('');
  const [dpdMin, setDpdMin] = useState('');
  const [dpdMax, setDpdMax] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const limit = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customersApi.list({
        search: search || undefined, segment: segment || undefined,
        status: status || undefined,
        dpd_min: dpdMin ? Number(dpdMin) : undefined,
        dpd_max: dpdMax ? Number(dpdMax) : undefined,
        page, limit,
      });
      const data = res.data as { items?: Customer[]; total?: number };
      setCustomers(data?.items || MOCK_CUSTOMERS);
      setTotal(data?.total || MOCK_CUSTOMERS.length);
    } catch {
      setCustomers(MOCK_CUSTOMERS);
      setTotal(MOCK_CUSTOMERS.length);
    } finally {
      setLoading(false);
    }
  }, [search, segment, status, dpdMin, dpdMax, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async (data: Partial<Customer>) => {
    await customersApi.create(data);
    setShowForm(false);
    fetch();
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5">
      {showForm && <CustomerForm onSave={handleCreate} onClose={() => setShowForm(false)} />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUpload={() => { setShowUpload(false); fetch(); }} />}

      <div className="flex items-center justify-between">
        <h2 className="text-[#f1f5f9] text-xl font-bold">Customers</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1d24] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] hover:bg-[#22262f] transition-colors"
          >
            <Upload size={14} />
            Upload CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus size={14} />
            Add Customer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] w-4 h-4" />
            <input
              type="text" placeholder="Search name or phone..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <select value={segment} onChange={(e) => { setSegment(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] focus:outline-none focus:border-indigo-500/50">
            <option value="">All Segments</option>
            <option value="prime">Prime</option>
            <option value="standard">Standard</option>
            <option value="risky">Risky</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] focus:outline-none focus:border-indigo-500/50">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="completed">Completed</option>
          </select>
          <div className="flex gap-2 items-center">
            <input type="number" placeholder="DPD min" value={dpdMin} onChange={(e) => { setDpdMin(e.target.value); setPage(1); }}
              className="w-20 px-2 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] focus:outline-none focus:border-indigo-500/50" />
            <span className="text-[#475569] text-xs">–</span>
            <input type="number" placeholder="max" value={dpdMax} onChange={(e) => { setDpdMax(e.target.value); setPage(1); }}
              className="w-20 px-2 py-2 bg-[#111318] border border-[#2a2d38] rounded-lg text-sm text-[#94a3b8] focus:outline-none focus:border-indigo-500/50" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d24] rounded-xl border border-[#2a2d38] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d38]">
                {['Name', 'Phone', 'Loan Amount', 'Outstanding', 'DPD', 'Segment', 'Status', 'Added', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2028]">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded" style={{ width: `${50 + Math.random() * 40}%` }} /></td>
                    ))}
                  </tr>
                ))
              ) : customers.map((c) => (
                <tr key={c.id} className="hover:bg-[#111318] cursor-pointer transition-colors" onClick={() => router.push(`/customers/${c.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#22262f] flex items-center justify-center text-xs font-bold text-[#94a3b8] flex-shrink-0">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-[#f1f5f9] font-medium text-sm">{c.name}</div>
                        {c.loan_id && <div className="text-[#475569] text-[10px] font-mono">{c.loan_id}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <Phone size={11} className="text-[#475569]" />
                      {c.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">{formatCurrency(c.loan_amount)}</td>
                  <td className="px-4 py-3 text-[#f1f5f9] font-mono text-xs font-medium">{formatCurrency(c.outstanding_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${getDpdBgColor(c.dpd)}`}>
                      {c.dpd}d
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge status={c.segment} /></td>
                  <td className="px-4 py-3"><Badge status={c.status} /></td>
                  <td className="px-4 py-3 text-[#475569] text-xs whitespace-nowrap">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/customers/${c.id}`); }}
                      className="p-1.5 rounded hover:bg-[#22262f] text-[#475569] hover:text-[#94a3b8] transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="px-4 py-3 border-t border-[#2a2d38] flex items-center justify-between">
            <span className="text-xs text-[#475569]">
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded border border-[#2a2d38] text-[#94a3b8] hover:bg-[#22262f] disabled:opacity-40 transition-colors">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded border text-xs font-medium transition-colors ${page === p ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-[#2a2d38] text-[#94a3b8] hover:bg-[#22262f]'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-1.5 rounded border border-[#2a2d38] text-[#94a3b8] hover:bg-[#22262f] disabled:opacity-40 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
