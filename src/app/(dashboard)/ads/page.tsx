"use client";

// src/app/(dashboard)/ads/page.tsx
//
// Client-facing Ads Agent page. The client turns their Meta-ads AI agent
// on/off, picks which agent answers ad leads, and sees leads captured
// from their Meta ads. Self-serve — the platform owner doesn't set this
// up per client.

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Megaphone, Loader2, Save, Bot, Phone, ExternalLink, Sparkles,
} from "lucide-react";

interface Agent { id: string; name: string }
interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  source: string;
  ad_headline: string | null;
  last_message: string | null;
  status: string;
  updated_at: string;
}

export default function AdsAgentPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [agentId, setAgentId] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [{ data: ag }, { data: cfg }, { data: ld }] = await Promise.all([
      supabase.from("agents").select("id, name").eq("tenant_id", user.id).order("name"),
      supabase.from("whatsapp_config").select("ads_agent_enabled, ads_agent_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("leads").select("*").eq("tenant_id", user.id).eq("source", "meta_ads").order("updated_at", { ascending: false }).limit(50),
    ]);

    setAgents(ag || []);
    if (cfg) {
      setHasConfig(true);
      setEnabled(!!cfg.ads_agent_enabled);
      setAgentId(cfg.ads_agent_id || "");
    }
    setLeads(ld || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_config")
        .update({ ads_agent_enabled: enabled, ads_agent_id: agentId || null })
        .eq("user_id", userId);
      if (error) { toast.error(error.message); return; }
      toast.success("Ads agent settings saved");
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
            <Megaphone className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]">Meta Ads AI Agent</h1>
            <p className="text-xs text-slate-500">When someone clicks your WhatsApp ad, your AI agent chats instantly and captures the lead.</p>
          </div>
        </div>
      </div>

      {!hasConfig && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Connect your WhatsApp Business number first (Settings → WhatsApp) to use the ads agent.
        </div>
      )}

      {/* Config */}
      <div className="rounded-2xl border border-[#e7ece9] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-[#0c1f17]">Ads agent</div>
            <div className="text-xs text-slate-500">Turn on to let AI answer leads from your Meta ads.</div>
          </div>
          <button onClick={() => setEnabled(!enabled)} className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-slate-200"}`}>
            <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {enabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Bot className="size-3.5 text-emerald-500" /> Which agent answers ad leads?</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-full rounded-lg border border-[#e7ece9] bg-white p-2.5 text-sm text-[#0c1f17] focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
              <option value="">— select an agent —</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <p className="text-[11px] text-slate-400">The agent uses its own persona + knowledge. Add knowledge in the Brain page and media in the Media page.</p>
          </div>
        )}

        <button onClick={save} disabled={saving || !hasConfig} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-[#e7ece9] bg-white p-5">
        <div className="text-sm font-bold text-[#0c1f17] mb-2 flex items-center gap-1.5"><Sparkles className="size-4 text-emerald-500" /> How it works</div>
        <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
          <li>Run a <b>Click-to-WhatsApp</b> ad on Meta pointing to your connected number.</li>
          <li>A person taps the ad and messages you — this opens a 24-hour window (compliant, no template needed).</li>
          <li>Your AI agent replies instantly, answers questions, and captures the lead.</li>
          <li>Every ad lead appears below, tagged by the ad it came from.</li>
        </ol>
      </div>

      {/* Ad leads */}
      <div>
        <h3 className="text-sm font-bold text-[#0c1f17] mb-3">Ad leads ({leads.length})</h3>
        {leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e7ece9] bg-white p-8 text-center text-sm text-slate-400">No ad leads yet. They&apos;ll appear here once your ads are live.</div>
        ) : (
          <div className="space-y-2">
            {leads.map((l) => (
              <div key={l.id} className="rounded-xl border border-[#e7ece9] bg-white p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#0c1f17]">{l.name || l.phone || "Lead"}</span>
                    {l.status === "hot" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">HOT</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{l.last_message || "—"}</div>
                  {l.ad_headline && <div className="text-[10px] text-emerald-600 truncate">from ad: {l.ad_headline}</div>}
                </div>
                {l.phone && (
                  <a href={`https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 shrink-0">
                    <Phone className="size-3.5" /> Chat
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
