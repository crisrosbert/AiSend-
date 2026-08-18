"use client";

// src/components/settings/data-export.tsx
//
// Lets a business download everything it has put into AiSend: its
// contacts, its website leads, and every chat message.
//
// ── WHY IT PAGES ─────────────────────────────────────────────────────
// Supabase returns at most 1,000 rows per request, and it does so
// SILENTLY — no error, no flag, just a short array. A merchant with
// 4,000 contacts would get a clean-looking file containing 1,000 of
// them and no reason to suspect anything. So every export loops with
// .range() until a page comes back short.
//
// ── WHY IT RUNS IN THE BROWSER ───────────────────────────────────────
// The queries go through the user's own session, so row-level security
// scopes them to that tenant. An export endpoint using the service key
// would have to re-implement that check correctly, and getting it wrong
// leaks another business's customers.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, Users, Globe, MessageSquare, ShieldCheck } from "lucide-react";
import { toCsv, csvFilename, downloadCsv, type CsvColumn } from "@/lib/export/csv";

const PAGE = 1000;

type Job = "contacts" | "leads" | "chats" | null;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function DataExport() {
  const supabase = createClient();
  const [busy, setBusy] = useState<Job>(null);
  const [progress, setProgress] = useState(0);

  /**
   * Read a whole table, a page at a time.
   *
   * `build` receives a fresh query each round so the caller can express
   * its own filters and ordering without us guessing at them.
   */
  async function fetchAll(
    build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
  ): Promise<Row[]> {
    const all: Row[] = [];
    for (let page = 0; ; page++) {
      const from = page * PAGE;
      const { data, error } = await build(from, from + PAGE - 1);
      if (error) throw error;
      const batch = data ?? [];
      all.push(...batch);
      setProgress(all.length);
      // A short page means we have reached the end.
      if (batch.length < PAGE) break;
      // A guard against an unbounded loop if a filter misbehaves.
      if (page > 500) break;
    }
    return all;
  }

  async function currentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  }

  /* ── Contacts ─────────────────────────────────────────────────── */
  async function exportContacts() {
    setBusy("contacts");
    setProgress(0);
    try {
      const userId = await currentUserId();
      if (!userId) { toast.error("Please sign in again"); return; }

      const rows = await fetchAll((from, to) =>
        supabase
          .from("contacts")
          .select("id, name, phone, email, company, created_at, updated_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .range(from, to),
      );

      const columns: CsvColumn<Row>[] = [
        { header: "Name", value: (r) => r.name },
        { header: "Phone", value: (r) => r.phone },
        { header: "Email", value: (r) => r.email },
        { header: "Company", value: (r) => r.company },
        { header: "Added on", value: (r) => r.created_at },
        { header: "Last updated", value: (r) => r.updated_at },
        { header: "Contact ID", value: (r) => r.id },
      ];

      downloadCsv(csvFilename("contacts"), toCsv(rows, columns));
      toast.success(`${rows.length} contact${rows.length === 1 ? "" : "s"} exported`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  /* ── Website leads ────────────────────────────────────────────── */
  async function exportLeads() {
    setBusy("leads");
    setProgress(0);
    try {
      const userId = await currentUserId();
      if (!userId) { toast.error("Please sign in again"); return; }

      const rows = await fetchAll((from, to) =>
        supabase
          .from("leads")
          .select("id, first_name, last_name, phone, email, company_name, source, status, extra, created_at")
          .eq("tenant_id", userId)
          .order("created_at", { ascending: true })
          .range(from, to),
      );

      const columns: CsvColumn<Row>[] = [
        { header: "First name", value: (r) => r.first_name },
        { header: "Last name", value: (r) => r.last_name },
        { header: "Phone", value: (r) => r.phone },
        { header: "Email", value: (r) => r.email },
        { header: "Company", value: (r) => r.company_name },
        { header: "Source", value: (r) => r.source },
        { header: "Status", value: (r) => r.status },
        // The page they came from lives in `extra`, and it is usually
        // the most useful column in the file.
        { header: "Page", value: (r) => r.extra?.page_url ?? "" },
        { header: "Captured on", value: (r) => r.created_at },
        { header: "Lead ID", value: (r) => r.id },
      ];

      downloadCsv(csvFilename("leads"), toCsv(rows, columns));
      toast.success(`${rows.length} lead${rows.length === 1 ? "" : "s"} exported`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  /* ── Chat history ─────────────────────────────────────────────── */
  async function exportChats() {
    setBusy("chats");
    setProgress(0);
    try {
      const userId = await currentUserId();
      if (!userId) { toast.error("Please sign in again"); return; }

      // Conversations first, so each message can be labelled with the
      // customer it belongs to. A merchant reading an export wants the
      // name and number beside the text, not a conversation UUID.
      const conversations = await fetchAll((from, to) =>
        supabase
          .from("conversations")
          .select("id, status, created_at, contacts(name, phone)")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .range(from, to),
      );

      if (conversations.length === 0) {
        toast.error("No conversations to export yet");
        return;
      }

      const byId = new Map(conversations.map((c) => [c.id, c]));
      const ids = conversations.map((c) => c.id);

      // Messages are fetched per batch of conversations: an `in` filter
      // with thousands of UUIDs makes a URL long enough to be rejected.
      const messages: Row[] = [];
      const CHUNK = 40;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const batch = await fetchAll((from, to) =>
          supabase
            .from("messages")
            .select("id, conversation_id, sender_type, content_type, content_text, media_url, status, created_at")
            .in("conversation_id", slice)
            .order("created_at", { ascending: true })
            .range(from, to),
        );
        messages.push(...batch);
        setProgress(messages.length);
      }

      messages.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

      const columns: CsvColumn<Row>[] = [
        { header: "Date", value: (r) => r.created_at },
        { header: "Customer", value: (r) => byId.get(r.conversation_id)?.contacts?.name ?? "" },
        { header: "Phone", value: (r) => byId.get(r.conversation_id)?.contacts?.phone ?? "" },
        // 'bot' is the word in the database; nobody outside the codebase
        // calls it that.
        {
          header: "Sent by",
          value: (r) =>
            r.sender_type === "customer" ? "Customer"
              : r.sender_type === "bot" ? "AI agent"
              : "Team",
        },
        { header: "Message", value: (r) => r.content_text },
        { header: "Type", value: (r) => r.content_type },
        { header: "Attachment", value: (r) => r.media_url },
        { header: "Delivery", value: (r) => r.status },
        { header: "Conversation", value: (r) => byId.get(r.conversation_id)?.status ?? "" },
        { header: "Conversation ID", value: (r) => r.conversation_id },
      ];

      downloadCsv(csvFilename("chat-history"), toCsv(messages, columns));
      toast.success(
        `${messages.length} message${messages.length === 1 ? "" : "s"} from ${conversations.length} conversation${conversations.length === 1 ? "" : "s"} exported`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  const cards = [
    {
      job: "contacts" as const,
      icon: <Users className="size-4" />,
      title: "Contacts",
      body: "Everyone in your contact list — name, phone, email, company and when they were added.",
      run: exportContacts,
    },
    {
      job: "leads" as const,
      icon: <Globe className="size-4" />,
      title: "Website leads",
      body: "Every lead captured by an agent, with the page it came from, its source and status.",
      run: exportLeads,
    },
    {
      job: "chats" as const,
      icon: <MessageSquare className="size-4" />,
      title: "Chat history",
      body: "Every message, in order, labelled with the customer and whether it came from them, your AI agent or your team.",
      run: exportChats,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-[#0c1f17]">Export your data</h2>
        <p className="mt-1 text-sm text-slate-500">
          Download your records as CSV — open them in Excel, Google Sheets or any
          other tool. This is your data; take a copy whenever you want one.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.job} className="flex flex-col rounded-2xl border border-[#e7ece9] bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                {c.icon}
              </span>
              <h3 className="text-sm font-bold text-[#0c1f17]">{c.title}</h3>
            </div>
            <p className="mb-4 flex-1 text-xs leading-relaxed text-slate-500">{c.body}</p>
            <button
              onClick={c.run}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {busy === c.job ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {progress > 0 ? `${progress.toLocaleString()} rows…` : "Preparing…"}
                </>
              ) : (
                <>
                  <Download className="size-3.5" /> Download CSV
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2.5 rounded-xl border border-[#e7ece9] bg-slate-50 p-3.5">
        <ShieldCheck className="size-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-500">
          Files download straight to this device — nothing is emailed or stored elsewhere.
          Large exports are fetched in batches, so the row count above climbs as it works;
          keep this tab open until it finishes. Exports contain personal information about
          your customers, so treat the file the way you would treat the database.
        </p>
      </div>
    </div>
  );
}
