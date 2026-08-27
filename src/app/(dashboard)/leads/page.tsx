"use client";

// src/app/(dashboard)/leads/page.tsx
//
// Website Leads — read-only view of conversations captured by the AI
// agent through the website widget (channel='website').
//
// This is NOT an inbox. The AI handles the entire conversation. The
// business reviews what the AI captured: the visitor's questions, the
// AI's answers, any name/phone collected, and booking status.
//
// Serious leads continue on WhatsApp (handled by the widget button) —
// so there is no human-reply box here by design.

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Globe, User, Phone, Loader2, Search, AlertCircle, ChevronRight, X,
  Bot, CalendarCheck, Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useBusiness } from "@/hooks/use-business";

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
      if (!user) { setLeads([]); setLoading(false); return; }
      if (businessLoading) return;
      if (!businessId) { setLeads([]); setLoading(false); return; }

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

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="space-y-5">
      {/* Header + stats — one banner, matching the pattern used on
          Dashboard/Contacts, instead of a separate header card stacked
          on top of a 3-box grid. */}
      <div className="overflow-hidden rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
            <Globe className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
              Website Leads
            </h1>
            <p className="mt-1 max-w-xl text-xs text-slate-500">
              Conversations your AI agent handled on your website. The AI answers questions and
              captures leads automatically — review them here. Serious leads continue on WhatsApp.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-[#d1fae5] pt-4">
          <StatChip icon={Globe} label="Total conversations" value={leads.length} />
          <div className="hidden h-9 w-px bg-[#d1fae5] sm:block" />
          <StatChip icon={AlertCircle} label="Need attention" value={attentionCount} warn={attentionCount > 0} />
          <div className="hidden h-9 w-px bg-[#d1fae5] sm:block" />
          <StatChip icon={Sparkles} label="Named leads" value={namedCount} />
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full rounded-lg border border-[#e7ece9] bg-white py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div className="flex gap-1.5">
          {([["all", "All"], ["attention", "Need attention"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                filter === val
                  ? "border-transparent bg-emerald-500 text-white"
                  : "border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Leads list */}
      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Globe className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No website leads yet</p>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              When a visitor chats with your AI agent on your website, the conversation appears here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#e7ece9]">
            {filtered.map((lead) => {
              const isNamed = lead.contact?.name && !lead.contact.name.startsWith("Website Visitor");
              const initial = isNamed ? lead.contact!.name!.charAt(0).toUpperCase() : "?";
              return (
                <button
                  key={lead.id}
                  onClick={() => openLead(lead)}
                  className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[#f8faf9]"
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isNamed ? "text-white" : "bg-slate-100 text-slate-400"
                    }`}
                    style={isNamed ? { background: "linear-gradient(135deg,#10b981,#059669)" } : undefined}
                  >
                    {isNamed ? initial : <User className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[#0c1f17]">
                        {isNamed ? lead.contact!.name : "Anonymous visitor"}
                      </span>
                      {lead.needs_attention && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                          <AlertCircle className="size-2.5" /> Attention
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {lead.last_message_text || "No messages"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-slate-400">
                      {lead.last_message_at
                        ? formatDistanceToNow(new Date(lead.last_message_at), { addSuffix: true })
                        : ""}
                    </div>
                    <ChevronRight className="ml-auto mt-1 size-4 text-slate-300" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Conversation drawer */}
      {activeLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setActiveLead(null)}>
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-[#e7ece9] p-4">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-emerald-600" />
                <span className="text-sm font-bold text-[#0c1f17]">Website conversation</span>
              </div>
              <button onClick={() => setActiveLead(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-4" />
              </button>
            </div>

            {/* Captured lead details */}
            <div className="space-y-2 border-b border-[#e7ece9] bg-[#f8faf9] p-4">
              {appointment ? (
                <>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <CalendarCheck className="size-4" /> Booking captured
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1"><User className="size-3" /> {appointment.customer_name}</span>
                    <a href={`tel:${appointment.customer_phone}`} className="flex items-center gap-1 hover:text-emerald-600">
                      <Phone className="size-3" /> {appointment.customer_phone}
                    </a>
                  </div>
                  <div className="text-[11px] text-slate-400">Service: {appointment.service} · Status: {appointment.status}</div>
                </>
              ) : (
                <div className="text-xs text-slate-500">
                  {activeLead.contact?.name && !activeLead.contact.name.startsWith("Website Visitor")
                    ? <span className="flex items-center gap-2"><User className="size-3" /> {activeLead.contact.name}</span>
                    : "No name captured yet — AI conversation only"}
                </div>
              )}
              {activeLead.needs_attention && activeLead.handoff_reason && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                  <AlertCircle className="size-3" /> {activeLead.handoff_reason}
                </div>
              )}
            </div>

            {/* Conversation thread (read-only) */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#fafcfb] p-4">
              {drawerLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-emerald-500" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">No messages</p>
              ) : (
                messages.map((m) => {
                  const isVisitor = m.sender_type === "customer";
                  return (
                    <div key={m.id} className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                          isVisitor
                            ? "rounded-br-sm bg-[var(--brand-100,#C8F5D6)] text-[#0c1f17]"
                            : "rounded-bl-sm border border-[#e7ece9] bg-white text-slate-700"
                        }`}
                      >
                        {!isVisitor && (
                          <div className="mb-0.5 flex items-center gap-1 text-[9px] text-slate-400">
                            <Bot className="size-2.5" /> AI
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
            <div className="border-t border-[#e7ece9] bg-white p-3">
              <p className="text-center text-[11px] text-slate-400">
                Read-only. The AI handles website chats. Serious leads continue on WhatsApp.
              </p>
            </div>
          </div>
        </div>
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
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${warn ? "bg-amber-100 text-amber-600" : "bg-white text-emerald-600"}`}>
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-lg font-extrabold leading-none text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
          {value.toLocaleString()}
        </div>
        <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{label}</div>
      </div>
    </div>
  );
}
