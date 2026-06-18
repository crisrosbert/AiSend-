"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Search, Loader2, Phone, MessageSquare, Megaphone, Bot,
  User, Filter, Clock, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 25;

// One "event" per contact — the most recent thing that happened to them.
type EventSource = "user_message" | "agent_message" | "bot_message" | "broadcast" | "automation";

interface RecentRow {
  contact_id: string;
  contact_name: string | null;
  contact_phone: string;
  event_source: EventSource;
  event_label: string;   // the human-readable line like "Send Brochure"
  event_kind: "USER" | "SYSTEM"; // shown in subtitle prefix
  event_time: string;    // ISO timestamp
  conversation_id?: string | null;
}

const KIND_STYLES: Record<EventSource, { text: string; bg: string; icon: typeof MessageSquare }> = {
  user_message:  { text: "text-blue-700",    bg: "bg-blue-50 border-blue-200",     icon: MessageSquare },
  agent_message: { text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: User },
  bot_message:   { text: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   icon: Bot },
  broadcast:     { text: "text-purple-700",  bg: "bg-purple-50 border-purple-200", icon: Megaphone },
  automation:    { text: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   icon: Bot },
};

const FILTERS: { value: "all" | EventSource | "USER" | "SYSTEM"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "USER", label: "User Actions" },
  { value: "SYSTEM", label: "System Events" },
];

// Minimal shapes for the joined rows returned by Supabase. Nested relations
// can come back as either a single object or an array, so accept both.
type ContactRel = { id: string; name: string | null; phone: string } | null;
type MaybeArray<T> = T | T[] | null;

interface MessageRow {
  conversation_id: string;
  sender_type: string;
  content_type: string | null;
  content_text: string | null;
  template_name: string | null;
  created_at: string;
  conversations: MaybeArray<{ id: string; user_id: string; contact_id: string; contacts: ContactRel }>;
}

interface BroadcastRow {
  contact_id: string;
  sent_at: string | null;
  delivered_at: string | null;
  status: string | null;
  contacts: ContactRel;
  broadcasts: MaybeArray<{ user_id: string; name: string | null }>;
}

interface AutomationRow {
  contact_id: string;
  trigger_event: string | null;
  created_at: string;
  status: string | null;
  contacts: ContactRel;
  automations: MaybeArray<{ name: string | null }>;
}

// Collapse a possibly-array relation to a single record.
function one<T>(rel: MaybeArray<T>): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

export default function RecentPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<typeof FILTERS[number]["value"]>("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setRows([]); setLoading(false); return; }

      // 1. Fetch latest 200 messages with conversation+contact joined
      const { data: messages } = await supabase
        .from("messages")
        .select(`
          conversation_id, sender_type, content_type, content_text,
          template_name, created_at,
          conversations!inner ( id, user_id, contact_id,
            contacts ( id, name, phone )
          )
        `)
        .eq("conversations.user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      // 2. Fetch latest broadcast recipients
      const { data: broadcasts } = await supabase
        .from("broadcast_recipients")
        .select(`
          contact_id, sent_at, delivered_at, status,
          contacts ( id, name, phone ),
          broadcasts!inner ( user_id, name )
        `)
        .eq("broadcasts.user_id", user.id)
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(200);

      // 3. Fetch latest automation logs
      const { data: automations } = await supabase
        .from("automation_logs")
        .select(`
          contact_id, trigger_event, created_at, status,
          contacts ( id, name, phone ),
          automations ( name )
        `)
        .eq("user_id", user.id)
        .not("contact_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      // —— Build candidate events from all three sources ——
      const events: RecentRow[] = [];

      (messages as MessageRow[] | null)?.forEach((m) => {
        const contact = one(one(m.conversations)?.contacts ?? null);
        if (!contact) return;
        const isCustomer = m.sender_type === "customer";
        const isBot = m.sender_type === "bot";
        let label = "Sent message";
        if (m.content_type === "template" && m.template_name) {
          label = `Template: ${m.template_name}`;
        } else if (m.content_type === "image") label = "Sent image";
        else if (m.content_type === "document") label = "Sent document";
        else if (m.content_type === "audio") label = "Sent voice note";
        else if (m.content_type === "video") label = "Sent video";
        else if (m.content_text) label = m.content_text.length > 40
          ? m.content_text.slice(0, 40) + "…"
          : m.content_text;

        events.push({
          contact_id: contact.id,
          contact_name: contact.name,
          contact_phone: contact.phone,
          event_source: isCustomer ? "user_message" : isBot ? "bot_message" : "agent_message",
          event_label: label,
          event_kind: isCustomer ? "USER" : "SYSTEM",
          event_time: m.created_at,
          conversation_id: m.conversation_id,
        });
      });

      (broadcasts as BroadcastRow[] | null)?.forEach((b) => {
        const contact = one(b.contacts);
        if (!contact) return;
        events.push({
          contact_id: contact.id,
          contact_name: contact.name,
          contact_phone: contact.phone,
          event_source: "broadcast",
          event_label: `Broadcast: ${one(b.broadcasts)?.name || "Campaign"}`,
          event_kind: "SYSTEM",
          event_time: b.sent_at || b.delivered_at || new Date().toISOString(),
        });
      });

      (automations as AutomationRow[] | null)?.forEach((a) => {
        const contact = one(a.contacts);
        if (!contact) return;
        events.push({
          contact_id: contact.id,
          contact_name: contact.name,
          contact_phone: contact.phone,
          event_source: "automation",
          event_label: `Flow: ${one(a.automations)?.name || a.trigger_event || "Automation"}`,
          event_kind: "SYSTEM",
          event_time: a.created_at,
        });
      });

      // Keep only the latest event PER contact
      const byContact = new Map<string, RecentRow>();
      events
        .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())
        .forEach((ev) => {
          if (!byContact.has(ev.contact_id)) byContact.set(ev.contact_id, ev);
        });

      const allRows = Array.from(byContact.values());
      setTotalCount(allRows.length);
      setRows(allRows);
    } catch (err) {
      console.error("Recent load error:", err);
      toast.error("Failed to load recent activity");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Client-side filter + paginate
  const filtered = useMemo(() => {
    let r = rows;
    if (filter === "USER" || filter === "SYSTEM") {
      r = r.filter((x) => x.event_kind === filter);
    } else if (filter !== "all") {
      r = r.filter((x) => x.event_source === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        (x.contact_name || "").toLowerCase().includes(q) ||
        x.contact_phone.toLowerCase().includes(q) ||
        x.event_label.toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, filter, search]);

  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const hasNext = (page + 1) * PAGE_SIZE < filtered.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
            Recent
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Latest activity across all your contacts — messages, broadcasts, and bot flows.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm">
          <Clock className="size-3.5 text-emerald-500" />
          {totalCount.toLocaleString("en-IN")} active contacts
        </div>
      </div>

      {/* Search + filter pills */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search name, phone, or activity..."
            className="w-full rounded-lg border border-[#e7ece9] bg-white py-2.5 pl-10 pr-4 text-sm text-[#0c1f17] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="size-4 text-slate-400" />
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setPage(0); }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                filter === f.value
                  ? "bg-emerald-500 text-white"
                  : "border border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-emerald-500" />
            <p className="mt-2 text-sm text-slate-400">Loading activity...</p>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Clock className="size-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {search || filter !== "all" ? "No matching activity" : "No recent activity yet"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {search || filter !== "all"
                ? "Try changing the search or filter."
                : "Activity from messages, broadcasts, and automations will appear here."}
            </p>
          </div>
        ) : (
          <div>
            {paged.map((row) => {
              const style = KIND_STYLES[row.event_source];
              const Icon = style.icon;
              const displayName = row.contact_name || row.contact_phone;
              const initial = displayName.charAt(0).toUpperCase();
              const timeAgo = formatDistanceToNow(new Date(row.event_time), { addSuffix: true });

              return (
                <Link
                  key={row.contact_id}
                  href={`/inbox${row.conversation_id ? `?c=${row.conversation_id}` : ""}`}
                  className="group flex items-center gap-4 border-b border-[#e7ece9] px-5 py-3.5 transition-colors last:border-b-0 hover:bg-[#f8faf9]"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-200 to-emerald-500 text-sm font-bold text-white shadow-sm">
                      {initial}
                    </div>
                    {/* Small icon badge for event source */}
                    <div className={`absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-white ${style.bg.split(" ")[0]} ${style.text}`}>
                      <Icon className="size-2.5" />
                    </div>
                  </div>

                  {/* Name + activity subtitle */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold uppercase text-[#0c1f17] tracking-wide">
                        {displayName}
                      </h3>
                      {row.contact_name && (
                        <span className="flex items-center gap-0.5 text-[11px] text-slate-400 font-mono">
                          <Phone className="size-2.5" /> {row.contact_phone}
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 truncate text-xs font-semibold ${style.text}`}>
                      <span className="inline-block min-w-[55px] uppercase tracking-wider">
                        {row.event_kind}:
                      </span>{" "}
                      <span className="text-slate-600 font-medium">{row.event_label}</span>
                    </p>
                  </div>

                  {/* Right: time + chevron */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden text-[11px] font-medium text-slate-400 sm:inline">
                      {timeAgo}
                    </span>
                    <ChevronRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}
            </span>{" "}
            of <span className="font-semibold text-slate-700">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-[#e7ece9] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-30 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#e7ece9] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-30 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
