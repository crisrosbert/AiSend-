"use client";

// src/app/(dashboard)/bookings/page.tsx
//
// Shows consultation/appointment requests captured by the AI agent
// (from agent_appointments). This is where the clinic sees leads the
// website widget booked autonomously.

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarCheck, Phone, User, Clock, Loader2, Search,
  CheckCircle2, XCircle, CalendarClock, MessageSquare,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  service: string;
  appointment_at: string | null;
  notes: string | null;
  status: string;
  conversation_id: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; class: string }> = {
  requested: { label: "New Request", class: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed: { label: "Confirmed",   class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed",   class: "bg-blue-50 text-blue-700 border-blue-200" },
  cancelled: { label: "Cancelled",   class: "bg-red-50 text-red-700 border-red-200" },
  no_show:   { label: "No Show",     class: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function BookingsPage() {
  const supabase = createClient();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAppointments([]); setLoading(false); return; }

      const { data, error } = await supabase
        .from("agent_appointments")
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("agent_appointments not available:", error.message);
        setAppointments([]);
      } else {
        setAppointments((data ?? []) as Appointment[]);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("agent_appointments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    }
  }

  const filtered = appointments.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.customer_name?.toLowerCase().includes(q) ||
        a.customer_phone?.includes(q) ||
        a.service?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: appointments.length,
    requested: appointments.filter((a) => a.status === "requested").length,
    confirmed: appointments.filter((a) => a.status === "confirmed").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
            <CalendarCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
              Bookings & Leads
            </h1>
            <p className="mt-1 text-xs text-slate-500 max-w-xl">
              Consultation requests captured by your AI agent — from your website widget and WhatsApp.
              Follow up to confirm exact times.
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#e7ece9] bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-[#0c1f17]">{counts.all}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total leads</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="text-2xl font-bold text-amber-700">{counts.requested}</div>
          <div className="text-xs text-amber-600 mt-0.5">New — need follow-up</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-2xl font-bold text-emerald-700">{counts.confirmed}</div>
          <div className="text-xs text-emerald-600 mt-0.5">Confirmed</div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or service..."
            className="w-full rounded-lg border border-[#e7ece9] bg-white py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "requested", "confirmed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-2 text-xs font-bold capitalize transition-colors border ${
                statusFilter === s
                  ? "bg-emerald-500 text-white border-transparent"
                  : "border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-400"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-emerald-500" />
            <p className="mt-2 text-sm text-slate-400">Loading bookings...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <CalendarCheck className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No bookings yet</p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              When your AI agent captures a consultation request, it appears here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#e7ece9]">
            {filtered.map((apt) => {
              const status = STATUS_META[apt.status] ?? STATUS_META.requested;
              return (
                <div key={apt.id} className="p-4 hover:bg-[#f8faf9] transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Left: customer info */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <User className="size-4" />
                        </div>
                        <span className="font-bold text-sm text-[#0c1f17]">{apt.customer_name}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${status.class}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 ml-10">
                        <a href={`tel:${apt.customer_phone}`} className="flex items-center gap-1 hover:text-emerald-600">
                          <Phone className="size-3" /> {apt.customer_phone}
                        </a>
                        <span className="flex items-center gap-1">
                          <CalendarClock className="size-3" /> {apt.service}
                        </span>
                        {apt.notes && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <MessageSquare className="size-3" /> {apt.notes}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 ml-10 mt-1">
                        Requested {formatDistanceToNow(new Date(apt.created_at), { addSuffix: true })}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://wa.me/${apt.customer_phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
                      >
                        <MessageSquare className="size-3" /> WhatsApp
                      </a>
                      {apt.status === "requested" && (
                        <button
                          onClick={() => updateStatus(apt.id, "confirmed")}
                          className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                        >
                          <CheckCircle2 className="size-3" /> Confirm
                        </button>
                      )}
                      {apt.status !== "cancelled" && apt.status !== "completed" && (
                        <button
                          onClick={() => updateStatus(apt.id, "cancelled")}
                          className="rounded-lg border border-[#e7ece9] bg-white p-1.5 text-slate-400 hover:border-red-300 hover:text-red-600"
                        >
                          <XCircle className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
