"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface ContactSidebarProps {
  contact: Contact | null;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, and tags in parallel
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
  }, [contact]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote]);

  if (!contact) {
    return (
      <div className="flex h-full w-[280px] items-center justify-center border-l border-[#e7ece9] bg-white">
        <p className="text-sm text-slate-400">Select a conversation</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-[280px] flex-col border-l border-[#e7ece9] bg-[#f8faf9]">
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {/* Contact Info */}
          <div className="flex flex-col items-center rounded-2xl border border-[#e7ece9] bg-white p-4 text-center shadow-sm">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm ring-4 ring-emerald-50"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
            >
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-bold text-[#0c1f17]">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-slate-400">{contact.company}</p>
            )}

            {/* Phone / email */}
            <div className="mt-3 w-full space-y-1 border-t border-[#e7ece9] pt-3">
              <button
                onClick={handleCopyPhone}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition-colors hover:bg-[#f2f4f7]"
              >
                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="flex-1 truncate text-left">{contact.phone}</span>
                {copied ? (
                  <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3 shrink-0 text-slate-400" />
                )}
              </button>

              {contact.email && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-500">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-2xl border border-[#e7ece9] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <TagIcon className="h-3 w-3" />
              Tags
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.length === 0 ? (
                <div className="w-full rounded-lg border border-dashed border-[#e7ece9] py-2 text-center text-[11px] text-slate-400">
                  No tags yet
                </div>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{
                      backgroundColor: `${tag.color}18`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Active Deals */}
          <div className="rounded-2xl border border-[#e7ece9] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <DollarSign className="h-3 w-3" />
              Active Deals
            </div>
            <div className="mt-2.5 space-y-2">
              {deals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#e7ece9] py-2 text-center text-[11px] text-slate-400">
                  No deals yet
                </div>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-xl bg-[#f8faf9] px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold text-[#0c1f17]">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-emerald-700">
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            backgroundColor: `${deal.stage.color}18`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-[#e7ece9] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <StickyNote className="h-3 w-3" />
              Notes
            </div>
            <div className="mt-2.5">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-[#e7ece9] bg-[#f8faf9] px-3 py-2 text-xs text-[#0c1f17] placeholder-slate-400 outline-none transition-colors focus:border-emerald-500/60 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                />
                <Button
                  size="sm"
                  className="h-auto self-stretch bg-emerald-600 px-2.5 hover:bg-emerald-500"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mt-2.5 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border-l-2 border-emerald-300 bg-[#f8faf9] px-3 py-2.5"
                  >
                    <p className="whitespace-pre-wrap text-xs text-slate-600">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-slate-400">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
