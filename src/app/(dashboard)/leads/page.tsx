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
  Globe, User, Phone, Clock, Loader2, Search, MessageSquare,
  CheckCircle2, AlertCircle, ChevronRight, X, Bot, CalendarCheck,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

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

      const { data, error } = await supabase
        .from("conversations")
        .select(`id, contact_id, status, needs_attention, handoff_reason,
                 last_message_text, last_message_at, created_at,
                 contact:contacts(name, phone)`)
        .eq("user_id", user.id)
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
  }, [supabase]);

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-[#dbeafe] bg-gradient-to-br from-white to-sky-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-md">
            <Globe className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
              Website Leads
            </h1>
            <p className="mt-1 text-xs text-slate-500 max-w-xl">
              Conversations your AI agent handled on your website. The AI answers questions and
              captures leads automatically — review them here. Serious leads continue on WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#e7ece9] bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-[#0c1f17]">{leads.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total conversations</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="text-2xl font-bold text-amber-700">{attentionCount}</div>
          <div className="text-xs text-amber-600 mt-0.5">Need attention</div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="text-2xl font-bold text-sky-700">
            {leads.filter((l) => l.contact?.name && !l.contact.name.startsWith("Website Visitor")).length}
          </div>
          <div className="text-xs text-sky-600 mt-0.5">Named leads</div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full rounded-lg border border-[#e7ece9] bg-white py-2 pl-10 pr-3 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {([["all", "All"], ["attention", "Need attention"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors border ${
                filter === val
                  ? "bg-sky-500 text-white border-transparent"
                  : "border-[#e7ece9] bg-white text-slate-500 hover:border-sky-400"
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
            <Loader2 className="size-6 animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-500">
              <Globe className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No website leads yet</p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              When a visitor chats with your AI agent on your website, the conversation appears here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#e7ece9]">
            {filtered.map((lead) => {
              const isNamed = lead.contact?.name && !lead.contact.name.startsWith("Website Visitor");
              return (
                <button
                  key={lead.id}
                  onClick={() => openLead(lead)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-[#f8faf9] transition-colors text-left"
                >
                  <div className={`flex size-9 items-center justify-center rounded-full shrink-0 ${
                    isNamed ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-400"
                  }`}>
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#0c1f17] truncate">
                        {isNamed ? lead.contact!.name : "Anonymous visitor"}
                      </span>
                      {lead.needs_attention && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                          <AlertCircle className="size-2.5" /> Attention
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {lead.last_message_text || "No messages"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-400">
                      {lead.last_message_at
                        ? formatDistanceToNow(new Date(lead.last_message_at), { addSuffix: true })
                        : ""}
                    </div>
                    <ChevronRight className="size-4 text-slate-300 ml-auto mt-1" />
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
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-[#e7ece9] p-4">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-sky-500" />
                <span className="font-bold text-sm text-[#0c1f17]">Website conversation</span>
              </div>
              <button onClick={() => setActiveLead(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-4" />
              </button>
            </div>

            {/* Captured lead details */}
            <div className="border-b border-[#e7ece9] p-4 bg-[#f8faf9] space-y-2">
              {appointment ? (
                <>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <CalendarCheck className="size-4" /> Booking captured
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1"><User className="size-3" /> {appointment.customer_name}</span>
                    <a href={`tel:${appointment.customer_phone}`} className="flex items-center gap-1 hover:text-sky-600">
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
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
                  <AlertCircle className="size-3" /> {activeLead.handoff_reason}
                </div>
              )}
            </div>

            {/* Conversation thread (read-only) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafcfb]">
              {drawerLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-sky-500" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No messages</p>
              ) : (
                messages.map((m) => {
                  const isVisitor = m.sender_type === "customer";
                  return (
                    <div key={m.id} className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                        isVisitor
                          ? "bg-sky-500 text-white rounded-br-sm"
                          : "bg-white border border-[#e7ece9] text-slate-700 rounded-bl-sm"
                      }`}>
                        {!isVisitor && (
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 mb-0.5">
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
            <div className="border-t border-[#e7ece9] p-3 bg-white">
              <p className="text-[11px] text-center text-slate-400">
                Read-only. The AI handles website chats. Serious leads continue on WhatsApp.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
