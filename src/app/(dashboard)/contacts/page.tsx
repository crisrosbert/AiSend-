'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Users, ChevronLeft, ChevronRight, Phone, Mail, Building2,
  MessageSquare, Filter, UserCheck, ShieldOff, ShieldCheck,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';

const PAGE_SIZE = 25;

interface ContactWithTags extends Contact {
  tags?: Tag[];
  opted_out_at?: string | null;
  opt_out_keyword?: string | null;
}

type OptOutFilter = 'all' | 'active' | 'opted_out';

function StatCard({
  icon, label, value, accent,
}: {
  icon: React.ReactNode; label: string; value: number;
  accent: 'emerald' | 'blue' | 'amber' | 'purple' | 'red';
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e7ece9] bg-white px-4 py-3">
      <div className={`flex size-8 items-center justify-center rounded-lg ${colors[accent]}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-[#0c1f17]">{value.toLocaleString()}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const supabase = createClient();

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [optedOutCount, setOptedOutCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [optOutFilter, setOptOutFilter] = useState<OptOutFilter>('active');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingOptOut, setTogglingOptOut] = useState<string | null>(null);

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

    let query = supabase
      .from('contacts')
      .select('*, contact_tags(tag_id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    // Opt-out filter
    if (optOutFilter === 'active') {
      query = query.is('opted_out_at', null);
    } else if (optOutFilter === 'opted_out') {
      query = query.not('opted_out_at', 'is', null);
    }

    const { data, count, error } = await query;
    if (error) { toast.error(error.message); setLoading(false); return; }

    // Count opted-out separately for stats
    const { count: ooCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .not('opted_out_at', 'is', null);
    setOptedOutCount(ooCount ?? 0);

    const enriched: ContactWithTags[] = (data ?? []).map((c) => ({
      ...c,
      tags: ((c.contact_tags as { tag_id: string }[]) ?? [])
        .map((ct) => tagsMap[ct.tag_id])
        .filter(Boolean),
    }));

    setContacts(enriched);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [supabase, page, search, optOutFilter, tagsMap]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTags(); }, [fetchTags]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const displayContacts = tagFilter
    ? contacts.filter((c) => c.tags?.some((t) => t.id === tagFilter))
    : contacts;

  // ── Opt-out toggle ────────────────────────────────────────────────
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

  function openDetail(contactId: string) {
    setDetailContactId(contactId); setDetailOpen(true);
  }

  function confirmDelete(contact: ContactWithTags) {
    setDeleteTarget(contact); setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('contacts').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { toast.error('Failed to delete contact'); return; }
    toast.success('Contact deleted');
    setDeleteConfirmOpen(false); setDeleteTarget(null); fetchContacts();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = (page + 1) * PAGE_SIZE < totalCount;
  const taggedCount = contacts.filter((c) => c.tags && c.tags.length > 0).length;
  const withEmailCount = contacts.filter((c) => c.email).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0c1f17]">Contacts</h1>
          <p className="mt-1 text-sm text-slate-500">Your customer list — segment, message, and grow.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}
            className="border-[#e7ece9] bg-white text-slate-600 hover:bg-slate-50">
            <Upload className="size-4" /> Import CSV
          </Button>
          <Button onClick={openAddForm} className="bg-emerald-500 hover:bg-emerald-600 text-white">
            <Plus className="size-4" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Users className="size-4" />} label="Total Contacts" value={totalCount} accent="emerald" />
        <StatCard icon={<UserCheck className="size-4" />} label="Tagged" value={taggedCount} accent="blue" />
        <StatCard icon={<Mail className="size-4" />} label="With Email" value={withEmailCount} accent="amber" />
        <StatCard icon={<ShieldOff className="size-4" />} label="Opted Out" value={optedOutCount} accent="red" />
      </div>

      {/* Opt-out filter tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-[#e7ece9] bg-white p-1.5 w-fit shadow-sm">
        {([
          { value: 'active',    label: 'Active',     icon: ShieldCheck },
          { value: 'all',       label: 'All',         icon: Users },
          { value: 'opted_out', label: 'Opted Out',   icon: ShieldOff },
        ] as { value: OptOutFilter; label: string; icon: typeof Users }[]).map((tab) => {
          const active = optOutFilter === tab.value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => { setOptOutFilter(tab.value); setPage(0); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
                active ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <Icon className="size-3.5" />
              {tab.label}
              {tab.value === 'opted_out' && optedOutCount > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
                }`}>
                  {optedOutCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + tag filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, phone, or email..."
            className="border-[#e7ece9] bg-white pl-10 text-[#0c1f17] placeholder:text-slate-400"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="size-4 text-slate-400" />
            <button
              onClick={() => setTagFilter(null)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                tagFilter === null ? 'bg-emerald-500 text-white' : 'bg-white border border-[#e7ece9] text-slate-500 hover:border-emerald-400'
              }`}
            >
              All
            </button>
            {allTags.slice(0, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors border ${
                  tagFilter === t.id ? 'border-transparent text-white' : 'border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-400'
                }`}
                style={tagFilter === t.id ? { background: t.color, borderColor: t.color } : {}}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Opted-out info banner */}
      {optOutFilter === 'opted_out' && optedOutCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <ShieldOff className="size-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {optedOutCount} contact{optedOutCount !== 1 ? 's have' : ' has'} opted out
            </p>
            <p className="mt-0.5 text-xs text-red-600">
              These contacts replied STOP or were manually opted out. They are automatically
              skipped in all broadcasts. You can re-subscribe them manually below if they request it.
            </p>
          </div>
        </div>
      )}

      {/* Contacts list */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-emerald-500" />
        </div>
      ) : displayContacts.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-[#e7ece9]">
          <p className="text-sm font-medium text-slate-600">
            {optOutFilter === 'opted_out' ? 'No opted-out contacts' : 'No contacts found'}
          </p>
          {optOutFilter !== 'opted_out' && (
            <p className="mt-1 text-xs text-slate-400">Add contacts or import a CSV to get started.</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e7ece9] bg-white">
          {displayContacts.map((contact, idx) => {
            const isOptedOut = !!contact.opted_out_at;
            const isToggling = togglingOptOut === contact.id;
            return (
              <div
                key={contact.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
                  idx !== 0 ? 'border-t border-[#f0f4f2]' : ''
                }`}
              >
                {/* Select checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(contact.id)}
                  onChange={() => toggleSelect(contact.id)}
                  className="size-4 rounded border-[#e7ece9] text-emerald-500 accent-emerald-500 shrink-0"
                />

                {/* Avatar */}
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: isOptedOut ? '#94a3b8' : '#10b981' }}
                >
                  {(contact.name ?? contact.phone)?.[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openDetail(contact.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isOptedOut ? 'text-slate-400' : 'text-[#0c1f17]'}`}>
                      {contact.name ?? '—'}
                    </span>

                    {/* Opted-out badge */}
                    {isOptedOut && (
                      <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                        <ShieldOff className="size-2.5" />
                        OPTED OUT
                        {contact.opt_out_keyword && (
                          <span className="opacity-70">via {contact.opt_out_keyword.toUpperCase()}</span>
                        )}
                      </span>
                    )}

                    {/* Tags */}
                    {contact.tags?.slice(0, 3).map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" />{contact.phone}
                      </span>
                    )}
                    {contact.email && (
                      <span className="hidden sm:flex items-center gap-1">
                        <Mail className="size-3" />{contact.email}
                      </span>
                    )}
                    {contact.company && (
                      <span className="hidden md:flex items-center gap-1">
                        <Building2 className="size-3" />{contact.company}
                      </span>
                    )}
                    {isOptedOut && contact.opted_out_at && (
                      <span className="text-red-400">
                        Opted out {new Date(contact.opted_out_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {/* Opt-out / Re-subscribe toggle */}
                  <button
                    onClick={() => toggleOptOut(contact)}
                    disabled={isToggling}
                    title={isOptedOut ? 'Re-subscribe this contact' : 'Opt this contact out'}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      isOptedOut
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    {isToggling ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : isOptedOut ? (
                      <><ShieldCheck className="size-3" /> Re-subscribe</>
                    ) : (
                      <ShieldOff className="size-3" />
                    )}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-[#e7ece9]">
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); openDetail(contact.id); }}
                        className="text-slate-700 focus:bg-slate-100"
                      >
                        <MessageSquare className="size-4" /> View Chat
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); openEditForm(contact); }}
                        className="text-slate-700 focus:bg-slate-100"
                      >
                        <Pencil className="size-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[#e7ece9]" />
                      <DropdownMenuItem
                        className="text-red-600 focus:bg-red-50 focus:text-red-700"
                        onClick={(e) => { e.stopPropagation(); confirmDelete(contact); }}
                      >
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)}
            </span> of <span className="font-semibold text-slate-700">{totalCount}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)} className="border-[#e7ece9]">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)} className="border-[#e7ece9]">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
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
      {deleteConfirmOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[#e7ece9] bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0c1f17]">Delete contact?</h3>
            <p className="mt-2 text-sm text-slate-500">
              <strong>{deleteTarget.name ?? deleteTarget.phone}</strong> and all associated data
              will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 border-[#e7ece9]">
                Cancel
              </Button>
              <Button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 text-white hover:bg-red-700">
                {deleting ? <Loader2 className="size-4 animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
