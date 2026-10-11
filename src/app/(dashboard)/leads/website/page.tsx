"use client";

// src/app/(dashboard)/leads/website/page.tsx
//
// ────────────────────────────────────────────────────────────────────────────
// Website Leads — Design System v2 (rebuilt 2026-10-11)
// ────────────────────────────────────────────────────────────────────────────
// Read-only view of conversations captured by the AI agent through the
// website widget (channel='website').
//
// This is NOT an inbox. The AI handles the entire conversation; the business
// reviews what the AI captured: the visitor's questions, the AI's answers,
// any name/phone collected, and booking status.
//
// Serious leads continue on WhatsApp (handled by the widget button) — so
// there is no human-reply box here by design.
//
// LAYOUT CONTRACT (matches the Design System v2 preview artifact)
// ---------------------------------------------------------------
//   [PageHead]  title + sub
//   [LeadsTabs] sub-nav
//   [StatCard row — 3 up] Total · Need attention · Named leads
//   [Panel]     search + filter chips
//   [Panel]     list of conversations (click → drawer)
//   [Drawer]    captured lead details + appointment + read-only transcript
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useBusiness } from "@/hooks/use-business";

// ── Shared design-system components ──
import { PageHead } from "@/components/ui/page-head";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { StatCard } from "@/components/ui/stat";

import {
  Globe,
  User,
  Phone,
  Loader2,
  Search,
  AlertCircle,
  ChevronRight,
  X,
  Bot,
  CalendarCheck,
  Sparkles,
} from "lucide-react";

interface LeadConversation {
  id: string;
  contact_id: string;
  status: string;
  needs_attention: boolean;
  handoff_reason: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  created_at: string;
  contact: { name: string | null; phone: string | null } | null;
}

interface Message {
  id: string;
  sender_type: string;
  content_text: string | null;
  created_at: string;
}

interface Appointment {
  customer_name: string;
  customer_phone: string;
  service: string;
  status: string;
}

export default function LeadsPage() {
  const supabase = createClient();
  const { businessId, loading: businessLoading } = useBusiness();
  const [leads, setLeads] = useState<LeadConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "attention" | "booked">("all");

  // Drawer state
  const [activeLead, setActiveLead] = useState<LeadConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLeads([]);
        setLoading(false);
        return;
      }
      if (businessLoading) return;
      if (!businessId) {
        setLeads([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("conversations")
        .select(`id, contact_id, status, needs_attention, handoff_reason,
                 last_message_text, last_message_at, created_at,
                 contact:contacts(name, phone)`)
        .eq("user_id", user.id)
        .eq("business_id", businessId)
        .eq("channel", "website")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);

      if (error) {
        console.warn("leads query error:", error.message);
        setLeads([]);
      } else {
        setLeads((data ?? []) as unknown as LeadConversation[]);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, businessId, businessLoading]);

  useEffect(() => {
    load();
  }, [load]);

  async function openLead(lead: LeadConversation) {
    setActiveLead(lead);
    setDrawerLoading(true);
    setMessages([]);
    setAppointment(null);
    try {
      // Load full conversation
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_type, content_text, created_at")
        .eq("conversation_id", lead.id)
        .order("created_at", { ascending: true });
      setMessages((msgs ?? []) as Message[]);

      // Check if this lead booked an appointment
      const { data: appt } = await supabase
        .from("agent_appointments")
        .select("customer_name, customer_phone, service, status")
        .eq("conversation_id", lead.id)
        .maybeSingle();
      if (appt) setAppointment(appt as Appointment);
    } finally {
      setDrawerLoading(false);
    }
  }

  const filtered = leads.filter((l) => {
    if (filter === "attention" && !l.needs_attention) return false;
    if (filter === "booked") return false; // handled below via appointment check is async; keep simple
    if (search) {
      const q = search.toLowerCase();
      return (
        l.contact?.name?.toLowerCase().includes(q) ||
        l.contact?.phone?.includes(q) ||
        l.last_message_text?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const attentionCount = leads.filter((l) => l.needs_attention).length;
  const namedCount = leads.filter(
    (l) => l.contact?.name && !l.contact.name.startsWith("Website Visitor"),
  ).length;

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-5 pb-20 pt-5 sm:px-7 lg:px-10 lg:pb-10">
      <PageHead
        title="Website chats"
        subtitle="Conversations your AI agent handled on your website. The AI answers questions and captures leads automatically — review them here. Serious leads continue on WhatsApp."
      />

      <div className="mb-6">
        <LeadsTabs active="website" />
      </div>

      {/* KPI row — 3 up (named leads is the "quality" indicator) */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total conversations"
          value={leads.length.toLocaleString("en-IN")}
          icon={<Globe size={12} aria-hidden />}
        />
        <StatCard
          label="Need attention"
          value={attentionCount.toLocaleString("en-IN")}
          icon={<AlertCircle size={12} aria-hidden />}
          delta={
            attentionCount > 0
              ? { label: "unread", tone: "down" }
              : undefined
          }
        />
        <StatCard
          label="Named leads"
          value={namedCount.toLocaleString("en-IN")}
          icon={<Sparkles size={12} aria-hidden />}
        />
      </div>

      {/* Search + filter chips */}
      <Panel className="mb-6">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2"
              style={{ color: "var(--ink-3)" }}
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads…"
              className="w-full rounded-[9px] border py-2 pl-10 pr-3 text-[13px] outline-none transition-colors"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            />
          </div>
          <div className="flex gap-1.5">
            {([["all", "All"], ["attention", "Need attention"]] as const).map(([val, label]) => (
              <FilterChip
                key={val}
                label={label}
                active={filter === val}
                onClick={() => setFilter(val)}
              />
            ))}
          </div>
        </div>
      </Panel>

      {/* Leads list */}
      <Panel>
        <PanelHead
          title={`${filtered.length} conversation${filtered.length === 1 ? "" : "s"}`}
          subtitle={
            filter === "attention"
              ? "Filtered to conversations that need your attention"
              : undefined
          }
        />
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2
              className="size-6 animate-spin"
              style={{ color: "var(--brand)" }}
              aria-hidden
            />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAnyRows={leads.length > 0} />
        ) : (
          <div
            className="divide-y"
            style={{ borderColor: "var(--line)" }}
          >
            {filtered.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                onOpen={() => openLead(lead)}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* Conversation drawer */}
      {activeLead && (
        <ConversationDrawer
          lead={activeLead}
          messages={messages}
          appointment={appointment}
          loading={drawerLoading}
          onClose={() => setActiveLead(null)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LOCAL COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

/** Dark-pill-when-active filter chip — matches other leads sub-pages. */
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors"
      style={{
        background: active ? "var(--ink)" : "var(--surface)",
        color: active ? "#fff" : "var(--ink-2)",
        border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
      }}
    >
      {label}
    </button>
  );
}

/** Single lead row — click opens the drawer. */
function LeadRow({
  lead,
  onOpen,
}: {
  lead: LeadConversation;
  onOpen: () => void;
}) {
  const isNamed =
    !!lead.contact?.name && !lead.contact.name.startsWith("Website Visitor");
  const initial = isNamed ? lead.contact!.name!.charAt(0).toUpperCase() : "?";

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[color:var(--surface-2)]"
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
        style={
          isNamed
            ? {
                background:
                  "linear-gradient(135deg,var(--brand),var(--brand-deep))",
                color: "#fff",
              }
            : {
                background: "var(--canvas)",
                color: "var(--ink-3)",
              }
        }
      >
        {isNamed ? initial : <User className="size-4" aria-hidden />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="truncate text-[13.5px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            {isNamed ? lead.contact!.name : "Anonymous visitor"}
          </span>
          {lead.needs_attention && (
            <Pill tone="sched">
              <AlertCircle className="size-2.5" aria-hidden /> Attention
            </Pill>
          )}
        </div>
        <p
          className="mt-0.5 truncate text-[11.5px]"
          style={{ color: "var(--ink-3)" }}
        >
          {lead.last_message_text || "No messages"}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <div
          className="text-[10.5px] tabular-nums"
          style={{ color: "var(--ink-3)" }}
        >
          {lead.last_message_at
            ? formatDistanceToNow(new Date(lead.last_message_at), { addSuffix: true })
            : ""}
        </div>
        <ChevronRight
          className="ml-auto mt-1 size-4"
          style={{ color: "var(--ink-4)" }}
          aria-hidden
        />
      </div>
    </button>
  );
}

/** Empty state for both "no rows" and "filter mismatch". */
function EmptyState({ hasAnyRows }: { hasAnyRows: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div
        className="mb-1 flex size-14 items-center justify-center rounded-2xl"
        style={{
          background: "var(--brand-50)",
          color: "var(--brand-deep)",
        }}
      >
        <Globe className="size-6" strokeWidth={1.6} aria-hidden />
      </div>
      <p
        className="text-[15px] font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--ink)",
        }}
      >
        {hasAnyRows ? "No conversations match this filter" : "No website leads yet"}
      </p>
      {!hasAnyRows && (
        <p
          className="max-w-[380px] text-[13px] leading-relaxed"
          style={{ color: "var(--ink-2)" }}
        >
          When a visitor chats with your AI agent on your website, the conversation appears here.
        </p>
      )}
    </div>
  );
}

/**
 * Slide-in drawer with the full conversation. Read-only by design: the AI
 * handles website chats, so there's no human-reply input here.
 */
function ConversationDrawer({
  lead,
  messages,
  appointment,
  loading,
  onClose,
}: {
  lead: LeadConversation;
  messages: Message[];
  appointment: Appointment | null;
  loading: boolean;
  onClose: () => void;
}) {
  const isNamed =
    !!lead.contact?.name && !lead.contact.name.startsWith("Website Visitor");

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(14,31,24,.4)" }}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col shadow-2xl"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between border-b p-4"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex items-center gap-2">
            <Globe
              className="size-4"
              style={{ color: "var(--brand-deep)" }}
              aria-hidden
            />
            <span
              className="text-[13.5px] font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
            >
              Website conversation
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 transition-colors"
            style={{ color: "var(--ink-3)" }}
            aria-label="Close drawer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Captured lead details */}
        <div
          className="space-y-2 border-b p-4"
          style={{
            borderColor: "var(--line)",
            background: "var(--surface-2)",
          }}
        >
          {appointment ? (
            <>
              <div
                className="flex items-center gap-2 text-[12px] font-bold"
                style={{ color: "var(--brand-deep)" }}
              >
                <CalendarCheck className="size-4" aria-hidden /> Booking captured
              </div>
              <div
                className="flex flex-wrap items-center gap-4 text-[12px]"
                style={{ color: "var(--ink-2)" }}
              >
                <span className="flex items-center gap-1">
                  <User className="size-3" aria-hidden />
                  {appointment.customer_name}
                </span>
                <a
                  href={`tel:${appointment.customer_phone}`}
                  className="flex items-center gap-1 transition-colors"
                  style={{ color: "var(--ink-2)" }}
                >
                  <Phone className="size-3" aria-hidden />
                  <span style={{ fontFamily: "var(--font-mono)" }}>
                    {appointment.customer_phone}
                  </span>
                </a>
              </div>
              <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                Service: {appointment.service} · Status: {appointment.status}
              </div>
            </>
          ) : (
            <div className="text-[12px]" style={{ color: "var(--ink-2)" }}>
              {isNamed ? (
                <span className="flex items-center gap-2">
                  <User className="size-3" aria-hidden /> {lead.contact?.name}
                </span>
              ) : (
                "No name captured yet — AI conversation only"
              )}
            </div>
          )}
          {lead.needs_attention && lead.handoff_reason && (
            <div
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px]"
              style={{
                background: "var(--amber-50)",
                color: "var(--amber)",
              }}
            >
              <AlertCircle className="size-3" aria-hidden /> {lead.handoff_reason}
            </div>
          )}
        </div>

        {/* Conversation thread (read-only) */}
        <div
          className="flex-1 space-y-3 overflow-y-auto p-4"
          style={{ background: "var(--canvas)" }}
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2
                className="size-5 animate-spin"
                style={{ color: "var(--brand)" }}
                aria-hidden
              />
            </div>
          ) : messages.length === 0 ? (
            <p
              className="py-8 text-center text-[12px]"
              style={{ color: "var(--ink-3)" }}
            >
              No messages
            </p>
          ) : (
            messages.map((m) => {
              const isVisitor = m.sender_type === "customer";
              return (
                <div
                  key={m.id}
                  className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                      isVisitor ? "rounded-br-sm" : "rounded-bl-sm"
                    }`}
                    style={
                      isVisitor
                        ? {
                            background: "var(--brand-100)",
                            color: "var(--ink)",
                          }
                        : {
                            background: "var(--surface)",
                            color: "var(--ink-2)",
                            border: "1px solid var(--line)",
                          }
                    }
                  >
                    {!isVisitor && (
                      <div
                        className="mb-0.5 flex items-center gap-1 text-[9px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        <Bot className="size-2.5" aria-hidden /> AI
                      </div>
                    )}
                    {m.content_text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer note — no reply box by design */}
        <div
          className="border-t p-3"
          style={{
            borderColor: "var(--line)",
            background: "var(--surface)",
          }}
        >
          <p
            className="text-center text-[11px]"
            style={{ color: "var(--ink-3)" }}
          >
            Read-only. The AI handles website chats. Serious leads continue on WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
