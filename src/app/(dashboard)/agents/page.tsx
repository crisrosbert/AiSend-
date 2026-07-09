"use client";

// src/app/(dashboard)/agents/page.tsx
//
// Agents — the hub for managing every AI agent. Lists all agents, and
// lets you edit each one's identity, persona, and capability flags, plus
// jump to its knowledge, media, and embed code. No SQL needed.

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Bot, Loader2, Save, Plus, Image as ImageIcon, Brain,
  Calendar, CreditCard, MessageSquare, Code, X, Sparkles,
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  agent_type: string;
  industry: string | null;
  persona: string | null;
  quick_replies_enabled: boolean;
  lead_form_enabled: boolean;
  lead_form_mode: string;
  booking_enabled: boolean;
  media_enabled: boolean;
  payment_enabled: boolean;
  is_active: boolean;
  journey_id: string | null;
}

const TYPES = ["sales", "marketing", "creative", "social", "support", "realestate", "other"];

export default function AgentsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("tenant_id", user.id)
      .order("created_at");
    setAgents(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function saveAgent() {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agents")
        .update({
          name: editing.name,
          agent_type: editing.agent_type,
          industry: editing.industry,
          persona: editing.persona,
          quick_replies_enabled: editing.quick_replies_enabled,
          lead_form_enabled: editing.lead_form_enabled,
          lead_form_mode: editing.lead_form_mode,
          booking_enabled: editing.booking_enabled,
          media_enabled: editing.media_enabled,
          payment_enabled: editing.payment_enabled,
          is_active: editing.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Agent saved");
      setEditing(null);
      load();
    } finally { setSaving(false); }
  }

  async function createAgent() {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("agents")
        .insert({
          tenant_id: userId,
          name: "New Agent",
          agent_type: "sales",
          persona: "You are a helpful assistant. Be warm and concise.",
          quick_replies_enabled: true,
          booking_enabled: true,
          is_active: true,
        })
        .select("*")
        .single();
      if (error) { toast.error(error.message); return; }
      toast.success("Agent created");
      load();
      setEditing(data);
    } finally { setCreating(false); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
            <Bot className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]">Agents</h1>
            <p className="text-xs text-slate-500">Create and configure your AI agents.</p>
          </div>
        </div>
        <button onClick={createAgent} disabled={creating} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New Agent
        </button>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((a) => (
          <div key={a.id} className="rounded-2xl border border-[#e7ece9] bg-white p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-sm font-bold text-[#0c1f17]">{a.name}</div>
                <div className="text-[11px] text-slate-400 capitalize">{a.agent_type}{a.industry ? " · " + a.industry : ""}</div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${a.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                {a.is_active ? "Active" : "Off"}
              </span>
            </div>
            {/* Capability chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {a.booking_enabled && <Chip icon={<Calendar className="size-3" />} label="Booking" />}
              {a.media_enabled && <Chip icon={<ImageIcon className="size-3" />} label="Media" />}
              {a.lead_form_enabled && <Chip icon={<MessageSquare className="size-3" />} label="Lead form" />}
              {a.payment_enabled && <Chip icon={<CreditCard className="size-3" />} label="Payments" />}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(a)} className="flex-1 rounded-lg bg-emerald-50 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Configure</button>
              <a href="/media" className="rounded-lg border border-[#e7ece9] p-1.5 text-slate-500 hover:bg-slate-50" title="Media"><ImageIcon className="size-4" /></a>
              <a href={a.journey_id ? `/journeys/${a.journey_id}/brain` : "/journeys"} className="rounded-lg border border-[#e7ece9] p-1.5 text-slate-500 hover:bg-slate-50" title="Knowledge"><Brain className="size-4" /></a>
            </div>
            {/* Embed code */}
            <div className="mt-2">
              <code className="block rounded bg-[#0c1f17] p-2 text-[9px] text-emerald-300 font-mono break-all">
                {`<script src="https://app.performancemktg.net/widget.js" data-org="${userId}" data-agent="${a.id}"></script>`}
              </code>
            </div>
          </div>
        ))}
      </div>

      {/* Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setEditing(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0c1f17]">Configure agent</h2>
              <button onClick={() => setEditing(null)}><X className="size-5 text-slate-400" /></button>
            </div>

            <Field label="Name">
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inp} />
            </Field>
            <Field label="Type">
              <select value={editing.agent_type} onChange={(e) => setEditing({ ...editing, agent_type: e.target.value })} className={inp}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Industry">
              <input value={editing.industry || ""} onChange={(e) => setEditing({ ...editing, industry: e.target.value })} className={inp} placeholder="e.g. Real Estate" />
            </Field>
            <Field label="Persona (the AI's personality + rules)">
              <textarea value={editing.persona || ""} onChange={(e) => setEditing({ ...editing, persona: e.target.value })} rows={8} className={inp} />
            </Field>

            <div className="mt-3 mb-1 text-xs font-bold text-slate-600 flex items-center gap-1.5"><Sparkles className="size-3.5 text-emerald-500" /> Capabilities</div>
            <Toggle label="Quick-reply buttons" on={editing.quick_replies_enabled} set={(v) => setEditing({ ...editing, quick_replies_enabled: v })} />
            <Toggle label="Appointment booking" on={editing.booking_enabled} set={(v) => setEditing({ ...editing, booking_enabled: v })} />
            <Toggle label="Media (images/PDFs/videos)" on={editing.media_enabled} set={(v) => setEditing({ ...editing, media_enabled: v })} />
            <Toggle label="Lead-capture form" on={editing.lead_form_enabled} set={(v) => setEditing({ ...editing, lead_form_enabled: v })} />
            {editing.lead_form_enabled && (
              <Field label="Lead form mode">
                <select value={editing.lead_form_mode} onChange={(e) => setEditing({ ...editing, lead_form_mode: e.target.value })} className={inp}>
                  <option value="progressive">Progressive (chat first)</option>
                  <option value="gate">Gate (form before chat)</option>
                </select>
              </Field>
            )}
            <Toggle label="Payment links" on={editing.payment_enabled} set={(v) => setEditing({ ...editing, payment_enabled: v })} />
            <Toggle label="Agent active" on={editing.is_active} set={(v) => setEditing({ ...editing, is_active: v })} />

            <button onClick={saveAgent} disabled={saving} className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save agent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-lg border border-[#e7ece9] bg-white p-2.5 text-sm text-[#0c1f17] focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 mb-3"><label className="text-xs font-bold text-slate-600">{label}</label>{children}</div>;
}
function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">{icon}{label}</span>;
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className="w-full flex items-center justify-between py-2 border-b border-[#f1f5f3]">
      <span className="text-sm text-[#0c1f17]">{label}</span>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
