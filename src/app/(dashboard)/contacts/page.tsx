'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Search, UserPlus, Upload, Download, Filter, MoreHorizontal,
  Phone, Tag, Trash2, Send, X, ChevronLeft, ChevronRight,
  Users, UserCheck, UserX, TrendingUp, Check, Loader2,
  SlidersHorizontal, MessageSquare, RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  tags: string[] | null;
  source: string | null;
  opted_out: boolean | null;
  created_at: string;
  notes: string | null;
}

const PAGE_SIZES = [25, 50, 100];

export default function ContactsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [drawer, setDrawer] = useState<Contact | null>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, optedOut: 0, thisMonth: 0 });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add form state
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addTags, setAddTags] = useState('');
  const [addSource, setAddSource] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let q = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search.trim()) {
        q = q.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`);
      }

      const { data, count, error } = await q;
      if (error) throw error;
      setContacts((data || []) as Contact[]);
      setTotal(count ?? 0);
    } catch (err) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [user, page, pageSize, search, supabase]);

  const loadStats = useCallback(async () => {
    if (!user) return;
    try {
      const [{ count: tot }, { count: opted }, { count: month }] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('opted_out', true),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);
      setStats({ total: tot ?? 0, active: (tot ?? 0) - (opted ?? 0), optedOut: opted ?? 0, thisMonth: month ?? 0 });
    } catch {}
  }, [user, supabase]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const handleSearch = (v: string) => {
    setSearchInput(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(v); setPage(0); }, 350);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map(c => c.id)));
  };

  const handleAdd = async () => {
    if (!user || !addPhone.trim()) return;
    setAddSaving(true);
    try {
      const tags = addTags.split(',').map(t => t.trim()).filter(Boolean);
      const { error } = await supabase.from('contacts').insert({
        user_id: user.id,
        name: addName.trim() || null,
        phone_number: addPhone.replace(/\D/g, ''),
        tags: tags.length ? tags : null,
        source: addSource.trim() || 'MANUAL',
        opted_out: false,
      });
      if (error) throw error;
      toast.success('Contact added');
      setShowAdd(false);
      setAddName(''); setAddPhone(''); setAddTags(''); setAddSource('');
      load(); loadStats();
    } catch (err) {
      toast.error('Failed to add contact');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} contact(s)?`)) return;
    try {
      const { error } = await supabase.from('contacts').delete().in('id', [...selected]);
      if (error) throw error;
      toast.success(`Deleted ${selected.size} contact(s)`);
      setSelected(new Set());
      load(); loadStats();
    } catch { toast.error('Delete failed'); }
  };

  const handleExport = () => {
    const rows = [['Name', 'Phone', 'Tags', 'Source', 'Opted Out', 'Added']];
    contacts.forEach(c => rows.push([
      c.name || '', c.phone_number, (c.tags || []).join(';'),
      c.source || '', c.opted_out ? 'Yes' : 'No',
      new Date(c.created_at).toLocaleDateString('en-IN'),
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('Export started');
  };

  const handleImport = async () => {
    if (!importFile || !user) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(Boolean);
      const header = lines[0].toLowerCase();
      const hasHeader = header.includes('name') || header.includes('phone');
      const rows = hasHeader ? lines.slice(1) : lines;
      const batch: Record<string, unknown>[] = [];
      for (const line of rows) {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const phone = (cols[1] || cols[0] || '').replace(/\D/g, '');
        if (phone.length < 10) continue;
        batch.push({ user_id: user.id, name: cols[0] || null, phone_number: phone, source: 'IMPORTED', opted_out: false });
      }
      if (!batch.length) { toast.error('No valid contacts found in file'); setImporting(false); return; }
      const { error } = await supabase.from('contacts').insert(batch);
      if (error) throw error;
      toast.success(`Imported ${batch.length} contacts`);
      setShowImport(false);
      setImportFile(null);
      load(); loadStats();
    } catch (err) {
      toast.error('Import failed — check file format');
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  const initials = (name: string | null, phone: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return phone.slice(-2);
  };

  const avatarColor = (str: string) => {
    const colors = ['#059669','#0891b2','#7c3aed','#db2777','#d97706','#16a34a','#dc2626'];
    let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % colors.length;
    return colors[h];
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f6faf8]">

      {/* ── PAGE HEADER ── */}
      <div className="shrink-0 border-b border-[#e7ece9] bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
              Contacts
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">Manage your WhatsApp contact list</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport}
              className="flex items-center gap-1.5 rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-600">
              <UserPlus className="h-3.5 w-3.5" /> Add Contact
            </button>
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Users, label: 'Total Contacts', value: stats.total.toLocaleString('en-IN'), color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: UserCheck, label: 'Active', value: stats.active.toLocaleString('en-IN'), color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: UserX, label: 'Opted Out', value: stats.optedOut.toLocaleString('en-IN'), color: 'text-red-500', bg: 'bg-red-50' },
            { icon: TrendingUp, label: 'Added This Month', value: stats.thisMonth.toLocaleString('en-IN'), color: 'text-violet-600', bg: 'bg-violet-50' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-[#e7ece9] bg-white px-4 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.bg} ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>{s.value}</p>
                <p className="text-[11px] text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="shrink-0 border-b border-[#e7ece9] bg-white px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-lg border border-[#e7ece9] bg-white px-3 py-2 focus-within:border-emerald-400 w-64">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input value={searchInput} onChange={e => handleSearch(e.target.value)}
                placeholder="Search name or phone…"
                className="flex-1 border-0 bg-transparent text-xs outline-none placeholder:text-slate-400" />
              {searchInput && (
                <button onClick={() => { handleSearch(''); setSearchInput(''); }}>
                  <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700" />
                </button>
              )}
            </div>
            <button className="flex items-center gap-1.5 rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
            </button>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {selected.size} selected
                </span>
                <button className="flex items-center gap-1.5 rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <Send className="h-3.5 w-3.5" /> Broadcast
                </button>
                <button className="flex items-center gap-1.5 rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <Tag className="h-3.5 w-3.5" /> Tag
                </button>
                <button onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
            <button onClick={() => load()}
              className="flex items-center gap-1.5 rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-500" /> Loading contacts…
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
              <Users className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-base font-bold text-[#0c1f17]">
              {search ? 'No contacts match your search' : 'No contacts yet'}
            </p>
            <p className="text-sm text-slate-400">
              {search ? 'Try a different name or number' : 'Add your first contact or import a CSV to get started.'}
            </p>
            {!search && (
              <button onClick={() => setShowAdd(true)}
                className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">
                <UserPlus className="h-4 w-4" /> Add Contact
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e7ece9] bg-white">
                <th className="w-10 px-4 py-3 text-left">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="h-3.5 w-3.5 accent-emerald-500" />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-700 uppercase tracking-wider text-slate-400">Contact</th>
                <th className="px-4 py-3 text-left text-[11px] font-700 uppercase tracking-wider text-slate-400">Phone</th>
                <th className="px-4 py-3 text-left text-[11px] font-700 uppercase tracking-wider text-slate-400">Tags</th>
                <th className="px-4 py-3 text-left text-[11px] font-700 uppercase tracking-wider text-slate-400">Source</th>
                <th className="px-4 py-3 text-left text-[11px] font-700 uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-700 uppercase tracking-wider text-slate-400">Added</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => {
                const sel = selected.has(c.id);
                const color = avatarColor(c.id);
                return (
                  <tr key={c.id}
                    className={`border-b border-[#e7ece9] transition-colors ${sel ? 'bg-emerald-50' : i % 2 === 0 ? 'bg-white' : 'bg-[#fafcfb]'} hover:bg-emerald-50/60 cursor-pointer`}
                    onClick={() => setDrawer(c)}
                  >
                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(c.id); }}>
                      <input type="checkbox" checked={sel} onChange={() => toggleSelect(c.id)}
                        className="h-3.5 w-3.5 accent-emerald-500" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: color }}>
                          {initials(c.name, c.phone_number)}
                        </div>
                        <span className="font-semibold text-[#0c1f17]">
                          {c.name || <span className="text-slate-400 font-normal">—</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">+{c.phone_number}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).slice(0, 2).map(t => (
                          <span key={t} className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {t}
                          </span>
                        ))}
                        {(c.tags || []).length > 2 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                            +{(c.tags || []).length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.source ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {c.source}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.opted_out ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" /> Opted out
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── PAGINATION ── */}
      {!loading && total > 0 && (
        <div className="shrink-0 border-t border-[#e7ece9] bg-white px-6 py-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(0); }}
                className="rounded-lg border border-[#e7ece9] bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none">
                {PAGE_SIZES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <span className="text-xs text-slate-400">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e7ece9] bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-3 font-semibold text-[#0c1f17]">{page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e7ece9] bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACT DRAWER ── */}
      {drawer && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setDrawer(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-[#e7ece9] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e7ece9] px-5 py-4">
              <h2 className="text-sm font-bold text-[#0c1f17]">Contact Details</h2>
              <button onClick={() => setDrawer(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-5 flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white"
                  style={{ background: avatarColor(drawer.id) }}>
                  {initials(drawer.name, drawer.phone_number)}
                </div>
                <div>
                  <p className="text-base font-bold text-[#0c1f17]">{drawer.name || 'Unknown'}</p>
                  <p className="text-xs text-slate-400 font-mono">+{drawer.phone_number}</p>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600">
                    <MessageSquare className="h-3.5 w-3.5" /> Message
                  </button>
                  <button className="flex items-center gap-1.5 rounded-xl border border-[#e7ece9] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    <Send className="h-3.5 w-3.5" /> Broadcast
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {[
                  { label: 'Phone', value: `+${drawer.phone_number}`, mono: true },
                  { label: 'Source', value: drawer.source || '—' },
                  { label: 'Status', value: drawer.opted_out ? 'Opted Out' : 'Active' },
                  { label: 'Added', value: new Date(drawer.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
                ].map(f => (
                  <div key={f.label} className="flex justify-between rounded-lg bg-[#f6faf8] px-3 py-2.5">
                    <span className="text-xs text-slate-400">{f.label}</span>
                    <span className={`text-xs font-semibold text-[#0c1f17] ${f.mono ? 'font-mono' : ''}`}>{f.value}</span>
                  </div>
                ))}
                {(drawer.tags || []).length > 0 && (
                  <div className="rounded-lg bg-[#f6faf8] px-3 py-2.5">
                    <p className="mb-2 text-xs text-slate-400">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(drawer.tags || []).map(t => (
                        <span key={t} className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {drawer.notes && (
                  <div className="rounded-lg bg-[#f6faf8] px-3 py-2.5">
                    <p className="mb-1 text-xs text-slate-400">Notes</p>
                    <p className="text-xs text-slate-600">{drawer.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ADD CONTACT MODAL ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[420px] max-w-[92vw] rounded-2xl border border-[#e7ece9] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>Add Contact</h2>
              <button onClick={() => setShowAdd(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Full Name', placeholder: 'Rahul Sharma', value: addName, set: setAddName, req: false },
                { label: 'WhatsApp Number', placeholder: '91xxxxxxxxxx', value: addPhone, set: setAddPhone, req: true },
                { label: 'Tags (comma-separated)', placeholder: 'Lead, Customer', value: addTags, set: setAddTags, req: false },
                { label: 'Source', placeholder: 'MANUAL', value: addSource, set: setAddSource, req: false },
              ].map(f => (
                <div key={f.label}>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    {f.label} {f.req && <span className="text-red-500">*</span>}
                  </label>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    className="w-full rounded-xl border border-[#e7ece9] px-3 py-2.5 text-sm text-[#0c1f17] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)}
                className="rounded-xl border border-[#e7ece9] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={!addPhone.trim() || addSaving}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
                {addSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {addSaving ? 'Adding…' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT MODAL ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[440px] max-w-[92vw] rounded-2xl border border-[#e7ece9] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>Import Contacts</h2>
              <button onClick={() => { setShowImport(false); setImportFile(null); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-4 rounded-xl border border-[#e7ece9] bg-[#f6faf8] p-4 text-xs text-slate-500">
              <p className="mb-1 font-semibold text-slate-700">CSV format expected:</p>
              <p className="font-mono">Name, Phone Number (with country code)</p>
              <p className="mt-1 text-slate-400">Example: Rahul Sharma, 919876543210</p>
            </div>
            <input ref={importInputRef} type="file" accept=".csv" className="hidden"
              onChange={e => setImportFile(e.target.files?.[0] || null)} />
            <button onClick={() => importInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#e7ece9] bg-white py-8 text-sm font-semibold text-slate-500 transition hover:border-emerald-400 hover:text-emerald-700">
              <Upload className="h-5 w-5" />
              {importFile ? importFile.name : 'Click to select CSV file'}
            </button>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowImport(false); setImportFile(null); }}
                className="rounded-xl border border-[#e7ece9] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleImport} disabled={!importFile || importing}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {importing ? 'Importing…' : 'Import Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
