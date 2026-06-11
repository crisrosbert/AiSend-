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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, Plus, Upload, MoreHorizontal, Pencil, Trash2, Loader2,
  Users, ChevronLeft, ChevronRight, Phone, Mail, Building2,
  MessageSquare, Send, Filter, Download, UserCheck,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';

const PAGE_SIZE = 25;

interface ContactWithTags extends Contact {
  tags?: Tag[];
}

export default function ContactsPage() {
  const supabase = createClient();

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const [allTags, setAllTags] = useState<Tag[]>([]);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      const map: Record<string, Tag> = {};
      data.forEach((t) => { map[t.id] = t; });
      setTagsMap(map);
      setAllTags(data);
    }
  }, [supabase]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
    }

    const { data, count, error } = await query;
    if (error) { toast.error('Failed to load contacts'); setLoading(false); return; }

    setTotalCount(count ?? 0);
    if (!data || data.length === 0) { setContacts([]); setLoading(false); return; }

    const contactIds = data.map((c) => c.id);
    const { data: contactTags } = await supabase
      .from('contact_tags').select('contact_id, tag_id').in('contact_id', contactIds);

    const tagsByContact: Record<string, string[]> = {};
    contactTags?.forEach((ct) => {
      if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
      tagsByContact[ct.contact_id].push(ct.tag_id);
    });

    const enriched: ContactWithTags[] = data.map((c) => ({
      ...c,
      tags: (tagsByContact[c.id] ?? []).map((tid) => tagsMap[tid]).filter(Boolean),
    }));

    setContacts(enriched);
    setLoading(false);
  }, [supabase, page, search, tagsMap]);

  useEffect(() => { fetchTags(); }, [fetchTags]);
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Filter contacts client-side by tag (in addition to server search)
  const displayContacts = tagFilter
    ? contacts.filter((c) => c.tags?.some((t) => t.id === tagFilter))
    : contacts;

  function openAddForm() {
    setEditContact(null); setEditContactTags([]); setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data: ct } = await supabase
      .from('contact_tags').select('*').eq('contact_id', contact.id);
    setEditContact(contact); setEditContactTags(ct ?? []); setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId); setDetailOpen(true);
  }

  function confirmDelete(contact: Contact) {
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

  function toggleSelectAll() {
    if (selectedIds.size === displayContacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayContacts.map((c) => c.id)));
  }

  function clearSelection() { setSelectedIds(new Set()); }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = (page + 1) * PAGE_SIZE < totalCount;
  const allSelected = displayContacts.length > 0 && selectedIds.size === displayContacts.length;

  // Real metrics from the data
  const taggedCount = contacts.filter((c) => c.tags && c.tags.length > 0).length;
  const withEmailCount = contacts.filter((c) => c.email).length;

  return (
    <div className="space-y-6">
      {/* Header — clean and distinct */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
            Contacts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your customer list — segment, message, and grow.
          </p>
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

      {/* Stat strip — small, glanceable metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Users className="size-4" />} label="Total Contacts" value={totalCount} accent="emerald" />
        <StatCard icon={<UserCheck className="size-4" />} label="Tagged" value={taggedCount} accent="blue" />
        <StatCard icon={<Mail className="size-4" />} label="With Email" value={withEmailCount} accent="amber" />
        <StatCard icon={<MessageSquare className="size-4" />} label="On This Page" value={displayContacts.length} accent="purple" />
      </div>

      {/* Search + tag filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, phone, or email..."
            className="border-[#e7ece9] bg-white pl-10 text-[#0c1f17] placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
          />
        </div>
        {/* Tag chips */}
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
                style={tagFilter === t.id ? { backgroundColor: t.color } : {}}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk-action bar (appears when contacts selected) */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-3 text-sm font-semibold text-emerald-800">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs">
              {selectedIds.size}
            </span>
            {selectedIds.size === 1 ? 'contact selected' : 'contacts selected'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white">
              <Send className="size-3.5" /> Broadcast
            </Button>
            <Button size="sm" variant="outline" className="border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100">
              <Download className="size-3.5" /> Export
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} className="text-slate-500 hover:text-slate-700">
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Card-row layout (not a dense table) */}
      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        {/* Column headers */}
        <div className="grid grid-cols-[40px_1.5fr_1fr_1.4fr_1fr_120px_40px] gap-3 border-b border-[#e7ece9] bg-[#f8faf9] px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <div>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="size-4 accent-emerald-500 cursor-pointer"
            />
          </div>
          <div>Name</div>
          <div>Phone</div>
          <div className="hidden md:block">Email</div>
          <div className="hidden md:block">Tags</div>
          <div className="hidden lg:block">Added</div>
          <div></div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-emerald-500" />
            <p className="mt-2 text-sm text-slate-400">Loading contacts...</p>
          </div>
        ) : displayContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Users className="size-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {search || tagFilter ? 'No contacts match your filters' : 'No contacts yet'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {search || tagFilter ? 'Try clearing the filters.' : 'Add your first contact or import a CSV.'}
            </p>
            {!search && !tagFilter && (
              <div className="mt-4 flex gap-2">
                <Button onClick={openAddForm} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  <Plus className="size-4" /> Add Contact
                </Button>
                <Button variant="outline" onClick={() => setImportOpen(true)}
                  className="border-[#e7ece9] text-slate-600 hover:bg-slate-50">
                  <Upload className="size-4" /> Import CSV
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {displayContacts.map((contact) => {
              const selected = selectedIds.has(contact.id);
              const initial = (contact.name || contact.phone || '?').charAt(0).toUpperCase();
              return (
                <div
                  key={contact.id}
                  onClick={() => openDetail(contact.id)}
                  className={`group grid grid-cols-[40px_1.5fr_1fr_1.4fr_1fr_120px_40px] gap-3 items-center border-b border-[#e7ece9] px-5 py-3 cursor-pointer transition-colors last:border-b-0 ${
                    selected ? 'bg-emerald-50/60' : 'hover:bg-[#f8faf9]'
                  }`}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelect(contact.id)}
                      className="size-4 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  {/* Name + avatar */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-200 to-emerald-500 text-white font-bold text-sm shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#0c1f17]">
                        {contact.name || <span className="italic text-slate-400">Unnamed</span>}
                      </div>
                      {contact.company && (
                        <div className="truncate text-[11px] text-slate-400 flex items-center gap-1">
                          <Building2 className="size-3" /> {contact.company}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Phone */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono min-w-0">
                    <Phone className="size-3 shrink-0 text-emerald-500" />
                    <span className="truncate">{contact.phone}</span>
                  </div>
                  {/* Email */}
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                    {contact.email ? (
                      <>
                        <Mail className="size-3 shrink-0 text-slate-400" />
                        <span className="truncate">{contact.email}</span>
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>
                  {/* Tags */}
                  <div className="hidden md:flex flex-wrap gap-1 min-w-0">
                    {contact.tags && contact.tags.length > 0 ? (
                      <>
                        {contact.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                            style={{ backgroundColor: tag.color + '15', color: tag.color, borderColor: tag.color + '40' }}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {contact.tags.length > 2 && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            +{contact.tags.length - 2}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </div>
                  {/* Added date */}
                  <div className="hidden lg:block text-xs text-slate-400">
                    {new Date(contact.created_at).toLocaleDateString('en-IN', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                  {/* Actions */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm"
                            className="text-slate-400 hover:bg-slate-100 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                        }
                      >
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
                          variant="destructive"
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)}</span> of{' '}
            <span className="font-semibold text-slate-700">{totalCount}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="border-[#e7ece9] text-slate-500 hover:bg-slate-50 disabled:opacity-30">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-3 text-xs font-semibold text-slate-600">
              Page {page + 1} of {totalPages}
            </span>
            <Button variant="outline" size="icon-sm" disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="border-[#e7ece9] text-slate-500 hover:bg-slate-50 disabled:opacity-30">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Existing dialogs — unchanged */}
      <ContactForm
        open={formOpen} onOpenChange={setFormOpen}
        contact={editContact} contactTags={editContactTags}
        onSaved={() => { fetchContacts(); fetchTags(); }}
      />
      <ContactDetailView
        open={detailOpen} onOpenChange={setDetailOpen}
        contactId={detailContactId} onUpdated={fetchContacts}
      />
      <ImportModal
        open={importOpen} onOpenChange={setImportOpen}
        onImported={fetchContacts}
      />
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-white border-[#e7ece9] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#0c1f17]">Delete Contact</DialogTitle>
            <DialogDescription className="text-slate-500">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-[#0c1f17]">
                {deleteTarget?.name || deleteTarget?.phone}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}
              className="border-[#e7ece9] text-slate-600 hover:bg-slate-50">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: number;
  accent: 'emerald' | 'blue' | 'amber' | 'purple';
}) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="rounded-xl border border-[#e7ece9] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`flex size-8 items-center justify-center rounded-lg ${styles[accent]}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-extrabold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
        {value.toLocaleString('en-IN')}
      </div>
      <div className="mt-0.5 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}
