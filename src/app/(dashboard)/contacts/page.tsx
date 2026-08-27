'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Search, Plus, Upload, MoreHorizontal, Pencil, Trash2, Loader2,
  ChevronLeft, ChevronRight, ChevronDown, Mail, MessageSquare, Filter,
  ShieldOff, ShieldCheck, Send, Bot, UserPlus, Radio, Download,
  X, Users,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import { useBusiness } from '@/hooks/use-business';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

interface ContactWithTags extends Contact {
  tags?: Tag[];
  opted_out_at?: string | null;
  opt_out_keyword?: string | null;
}

type OptOutFilter = 'all' | 'active' | 'opted_out';

/** Compact shortcut chips shown alongside the real contact stats. */
const NEXT_ACTIONS = [
  { href: '/broadcasts/new', icon: Send, label: 'Broadcast campaign' },
  { href: '/agents', icon: Bot, label: 'AI Agent' },
  { href: '/ads', icon: Radio, label: 'WhatsApp Ads' },
  { href: '/leads', icon: UserPlus, label: 'Capture leads' },
] as const;

/** This project's DropdownMenuTrigger renders its own element, so it is styled
 *  directly rather than wrapping a <Button> via asChild. */
const OUTLINE_TRIGGER =
  'flex h-8 items-center gap-1 rounded-md border border-emerald-500 bg-white px-3 ' +
  'text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50';

export default function ContactsPage() {
  const supabase = createClient();
  const { businessId, loading: businessLoading } = useBusiness();

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [optedOutCount, setOptedOutCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [optOutFilter, setOptOutFilter] = useState<OptOutFilter>('active');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<ContactWithTags | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactWithTags | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingOptOut, setTogglingOptOut] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce search so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*').order('name');
    const tags = (data ?? []) as Tag[];
    setAllTags(tags);
    const map: Record<string, Tag> = {};
    tags.forEach((t) => { map[t.id] = t; });
    setTagsMap(map);
  }, [supabase]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);

    // Wait for the business rather than listing the account's contacts
    // and correcting a moment later. On a paginated list the correction
    // also resets the page count under the reader.
    if (businessLoading) return;
    if (!businessId) { setContacts([]); setTotalCount(0); setLoading(false); return; }

    let query = supabase
      .from('contacts')
      .select('*, contact_tags(tag_id)', { count: 'exact' })
      .eq('business_id', businessId)
      // Website widget visitors are stored as contacts too (there's
      // nowhere else to attach their conversation to), with a phone
      // starting "web_" because there is no real number yet. They
      // already have a home — Website Leads and the inbox thread —
      // so they don't belong in the real, message-able contact list.
      .not('phone', 'ilike', 'web%')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (debouncedSearch.trim()) {
      const term = debouncedSearch.replace(/[%,]/g, '');
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
    }

    if (optOutFilter === 'active') query = query.is('opted_out_at', null);
    else if (optOutFilter === 'opted_out') query = query.not('opted_out_at', 'is', null);

    const { data, count, error } = await query;
    if (error) { toast.error(error.message); setLoading(false); return; }

    const { count: ooCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .not('phone', 'ilike', 'web%')
      .not('opted_out_at', 'is', null);
    setOptedOutCount(ooCount ?? 0);

    setContacts((data ?? []).map((c) => ({
      ...c,
      tags: ((c.contact_tags as { tag_id: string }[]) ?? [])
        .map((ct) => tagsMap[ct.tag_id])
        .filter(Boolean),
    })));
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [supabase, page, pageSize, debouncedSearch, optOutFilter, tagsMap, businessId, businessLoading]);

  useEffect(() => { fetchTags(); }, [fetchTags]);
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const displayContacts = useMemo(
    () => (tagFilter ? contacts.filter((c) => c.tags?.some((t) => t.id === tagFilter)) : contacts),
    [contacts, tagFilter],
  );

  const allOnPageSelected =
    displayContacts.length > 0 && displayContacts.every((c) => selectedIds.has(c.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) displayContacts.forEach((c) => next.delete(c.id));
      else displayContacts.forEach((c) => next.add(c.id));
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleOptOut(contact: ContactWithTags) {
    const action = contact.opted_out_at ? 'opt_in' : 'opt_out';
    setTogglingOptOut(contact.id);
    try {
      const res = await fetch('/api/contacts/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contact.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        action === 'opt_out'
          ? `${contact.name ?? contact.phone} opted out`
          : `${contact.name ?? contact.phone} re-subscribed`,
      );
      fetchContacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update opt-out status');
    } finally {
      setTogglingOptOut(null);
    }
  }

  function openAddForm() {
    setEditContact(null); setEditContactTags([]); setFormOpen(true);
  }

  async function openEditForm(contact: ContactWithTags) {
    const { data: ct } = await supabase
      .from('contact_tags').select('*').eq('contact_id', contact.id);
    setEditContact(contact); setEditContactTags(ct ?? []); setFormOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('contacts').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error('Failed to delete contact'); return; }
    toast.success('Contact deleted');
    setDeleteTarget(null);
    fetchContacts();
  }

  async function handleBulkDelete() {
    setDeleting(true);
    const ids = [...selectedIds];
    const { error } = await supabase.from('contacts').delete().in('id', ids);
    setDeleting(false);
    if (error) { toast.error('Failed to delete contacts'); return; }
    toast.success(`${ids.length} contact${ids.length !== 1 ? 's' : ''} deleted`);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    fetchContacts();
  }

  /** Export every contact matching the current filters, not just this page. */
  async function handleExport() {
    setExporting(true);
    try {
      if (!businessId) { toast.error('Still loading your business — try again in a moment'); return; }

      let query = supabase
        .from('contacts')
        .select('phone, name, email, company, opted_out_at, created_at')
        .eq('business_id', businessId)
        .not('phone', 'ilike', 'web%')
        .order('created_at', { ascending: false });

      if (optOutFilter === 'active') query = query.is('opted_out_at', null);
      else if (optOutFilter === 'opted_out') query = query.not('opted_out_at', 'is', null);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) { toast.error('Nothing to export'); return; }

      const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        ['phone', 'name', 'email', 'company', 'status', 'created_at'].map(escape).join(','),
        ...data.map((c) => [
          c.phone, c.name, c.email, c.company,
          c.opted_out_at ? 'Opted out' : 'Active',
          c.created_at,
        ].map(escape).join(',')),
      ].join('\r\n');

      const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${data.length} contacts exported`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min((page + 1) * pageSize, totalCount);
  const activeFilterCount = (tagFilter ? 1 : 0) + (optOutFilter !== 'active' ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* ── Audience overview — real numbers first, shortcuts second.
          Deliberately not a "here's what to try next" nudge panel: the
          hero is what your audience actually looks like right now. */}
      <div className="overflow-hidden rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <StatChip icon={Users} label="Total contacts" value={totalCount} />
          <div className="hidden h-9 w-px bg-[#d1fae5] sm:block" />
          <StatChip icon={ShieldCheck} label="Active" value={Math.max(0, totalCount - optedOutCount)} />
          <div className="hidden h-9 w-px bg-[#d1fae5] sm:block" />
          <StatChip icon={ShieldOff} label="Opted out" value={optedOutCount} warn={optedOutCount > 0} />

          <button
            onClick={() => setImportOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <Upload className="size-3.5" /> Import CSV / Excel
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#d1fae5] pt-4">
          {NEXT_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e7ece9] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700"
            >
              <action.icon className="size-3.5" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or mobile number"
            className="border-[#e7ece9] bg-[#f4f6f5] pl-10 text-[#0c1f17] placeholder:text-slate-400"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => setShowFilters((v) => !v)}
          className="relative border-[#e7ece9] bg-white text-slate-600 hover:bg-slate-50"
        >
          <Filter className="size-4" /> Filter
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>

        <div className="flex-1" />

        <Button
          size="sm"
          disabled={selectedIds.size === 0}
          onClick={() => toast.info('Select a template on the broadcast screen to message these contacts.')}
          className="bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40"
        >
          BROADCAST {selectedIds.size > 0 && `(${selectedIds.size})`}
        </Button>

        <Button size="sm" variant="outline" onClick={openAddForm}
          className="border-emerald-500 bg-white text-emerald-700 hover:bg-emerald-50">
          <Plus className="size-4" /> Add Contact
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className={OUTLINE_TRIGGER}>
            Import <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-[#e7ece9] bg-white">
            <DropdownMenuItem onClick={() => setImportOpen(true)} className="text-slate-700 focus:bg-slate-100">
              <Upload className="size-4" /> Import Contacts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={OUTLINE_TRIGGER}>
            Actions <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-[#e7ece9] bg-white">
            <DropdownMenuItem onClick={handleExport} disabled={exporting}
              className="text-slate-700 focus:bg-slate-100">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Export
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#e7ece9]" />
            <DropdownMenuItem
              disabled={selectedIds.size === 0}
              onClick={() => setBulkDeleteOpen(true)}
              className="text-red-600 focus:bg-red-50 focus:text-red-700"
            >
              <Trash2 className="size-4" /> Delete selected
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#e7ece9] bg-white px-4 py-3">
          <div className="flex items-center gap-1">
            {([
              { value: 'active', label: 'Active', icon: ShieldCheck },
              { value: 'all', label: 'All', icon: Filter },
              { value: 'opted_out', label: 'Opted Out', icon: ShieldOff },
            ] as { value: OptOutFilter; label: string; icon: typeof Filter }[]).map((tab) => {
              const active = optOutFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => { setOptOutFilter(tab.value); setPage(0); }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    active ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-emerald-50'
                  }`}
                >
                  <tab.icon className="size-3.5" /> {tab.label}
                  {tab.value === 'opted_out' && optedOutCount > 0 && (
                    <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                      active ? 'bg-white/20' : 'bg-red-100 text-red-600'
                    }`}>{optedOutCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          {allTags.length > 0 && (
            <>
              <span className="h-5 w-px bg-[#e7ece9]" />
              <div className="flex flex-wrap items-center gap-1.5">
                {allTags.slice(0, 8).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      tagFilter === t.id ? 'border-transparent text-white' : 'border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-400'
                    }`}
                    style={tagFilter === t.id ? { background: t.color, borderColor: t.color } : {}}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setTagFilter(null); setOptOutFilter('active'); setPage(0); }}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              <X className="size-3.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* ── Selection banner ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <p className="text-sm font-semibold text-emerald-800">
            {selectedIds.size} selected
          </p>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-[#e7ece9] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-[#e7ece9] bg-[#f7faf8]">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all contacts on this page"
                    className="size-4 rounded border-[#e7ece9] accent-emerald-500"
                  />
                </th>
                {['Name', 'Mobile Number', 'Tags', 'Email', 'Company', 'Status', 'Created', ''].map((h, i) => (
                  <th key={i} className="px-3 py-3 text-left text-xs font-bold text-emerald-800">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-emerald-500" />
                  </td>
                </tr>
              ) : displayContacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <p className="text-sm font-medium text-slate-600">
                      {optOutFilter === 'opted_out' ? 'No opted-out contacts' : 'No contacts found'}
                    </p>
                    {optOutFilter !== 'opted_out' && (
                      <p className="mt-1 text-xs text-slate-400">
                        Add a contact or import an Excel/CSV file to get started.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                displayContacts.map((contact) => {
                  const isOptedOut = !!contact.opted_out_at;
                  const isToggling = togglingOptOut === contact.id;
                  return (
                    <tr key={contact.id} className="border-b border-[#f0f4f2] transition-colors last:border-0 hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(contact.id)}
                          onChange={() => toggleSelect(contact.id)}
                          aria-label={`Select ${contact.name ?? contact.phone}`}
                          className="size-4 rounded border-[#e7ece9] accent-emerald-500"
                        />
                      </td>

                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => { setDetailContactId(contact.id); setDetailOpen(true); }}
                          className="flex items-center gap-2.5 text-left"
                        >
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ background: isOptedOut ? '#94a3b8' : '#10b981' }}
                          >
                            {(contact.name ?? contact.phone)?.[0]?.toUpperCase() ?? '?'}
                          </span>
                          <span className={`font-semibold ${isOptedOut ? 'text-slate-400' : 'text-[#0c1f17]'} hover:underline`}>
                            {contact.name ?? '—'}
                          </span>
                        </button>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{contact.phone}</td>

                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags?.slice(0, 2).map((tag) => (
                            <span key={tag.id}
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                              style={{ background: tag.color }}>
                              {tag.name}
                            </span>
                          ))}
                          {(contact.tags?.length ?? 0) > 2 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              +{(contact.tags?.length ?? 0) - 2}
                            </span>
                          )}
                          {!contact.tags?.length && <span className="text-xs text-slate-300">—</span>}
                        </div>
                      </td>

                      <td className="max-w-[180px] truncate px-3 py-2.5 text-slate-600">
                        {contact.email ?? <span className="text-slate-300">—</span>}
                      </td>

                      <td className="max-w-[160px] truncate px-3 py-2.5 text-slate-600">
                        {contact.company ?? <span className="text-slate-300">—</span>}
                      </td>

                      <td className="px-3 py-2.5">
                        {isOptedOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                            <ShieldOff className="size-2.5" />
                            OPTED OUT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <ShieldCheck className="size-2.5" /> ACTIVE
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-400">
                        {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : '—'}
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleOptOut(contact)}
                            disabled={isToggling}
                            title={isOptedOut ? 'Re-subscribe this contact' : 'Opt this contact out'}
                            className={`rounded-lg p-1.5 transition-colors ${
                              isOptedOut
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                            }`}
                          >
                            {isToggling ? <Loader2 className="size-4 animate-spin" />
                              : isOptedOut ? <ShieldCheck className="size-4" />
                              : <ShieldOff className="size-4" />}
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-[#e7ece9] bg-white">
                              <DropdownMenuItem
                                onClick={() => { setDetailContactId(contact.id); setDetailOpen(true); }}
                                className="text-slate-700 focus:bg-slate-100">
                                <MessageSquare className="size-4" /> View Chat
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditForm(contact)}
                                className="text-slate-700 focus:bg-slate-100">
                                <Pencil className="size-4" /> Edit
                              </DropdownMenuItem>
                              {contact.email && (
                                <DropdownMenuItem
                                  onClick={() => { window.location.href = `mailto:${contact.email}`; }}
                                  className="text-slate-700 focus:bg-slate-100">
                                  <Mail className="size-4" /> Send Email
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-[#e7ece9]" />
                              <DropdownMenuItem
                                className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                onClick={() => setDeleteTarget(contact)}>
                                <Trash2 className="size-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer pagination ── */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#e7ece9] bg-white px-4 py-2.5">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-4" />
          </button>

          <span className="text-xs text-slate-600">
            {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()}
          </span>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages}
            aria-label="Next page"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-4" />
          </button>

          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            aria-label="Rows per page"
            className="rounded-lg border border-[#e7ece9] bg-white px-2 py-1 text-xs text-slate-600 focus:border-emerald-500 focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size} per page</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Modals ── */}
      {formOpen && (
        <ContactForm
          open={formOpen}
          onOpenChange={setFormOpen}
          contact={editContact}
          contactTags={editContactTags}
          onSaved={() => { setFormOpen(false); fetchContacts(); }}
        />
      )}
      {detailOpen && detailContactId && (
        <ContactDetailView
          open={detailOpen}
          onOpenChange={setDetailOpen}
          contactId={detailContactId}
          onUpdated={fetchContacts}
        />
      )}
      {importOpen && (
        <ImportModal
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => { setImportOpen(false); fetchContacts(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete contact?"
          body={
            <>
              <strong>{deleteTarget.name ?? deleteTarget.phone}</strong> and all associated data
              will be permanently deleted. This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDialog
          title={`Delete ${selectedIds.size} contacts?`}
          body="These contacts and all their associated data will be permanently deleted. This cannot be undone."
          confirmLabel={`Delete ${selectedIds.size}`}
          busy={deleting}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  );
}

function StatChip({
  icon: Icon, label, value, warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${warn ? 'bg-amber-100 text-amber-600' : 'bg-white text-emerald-600'}`}>
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-lg font-extrabold leading-none text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
          {value.toLocaleString()}
        </div>
        <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title, body, confirmLabel, busy, onCancel, onConfirm,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-[#e7ece9] bg-white p-6 shadow-xl">
        <h3 className="text-base font-bold text-[#0c1f17]">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{body}</p>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1 border-[#e7ece9]">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="flex-1 bg-red-600 text-white hover:bg-red-700">
            {busy ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
