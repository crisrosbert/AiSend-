"use client";

// Shown on Website chatbot settings when the visitor built a chatbot with the
// free tool before signing up. One card takes them from "draft" to "live":
// copy the look, train an agent on their site, switch it on, copy the code.

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useScopedBusinessId } from "@/hooks/use-business";
import { clearDraft, readDraft, type ChatbotDraft } from "@/lib/tools/chatbot/draft";

export function ChatbotDraftBanner({
  onApply,
}: {
  onApply: (look: { bot_name: string; welcome_message: string; primary_color: string }) => void;
}) {
  const supabase = createClient();
  const businessId = useScopedBusinessId();
  const [draft, setDraft] = useState<ChatbotDraft | null>(null);
  const [busy, setBusy] = useState<"train" | "live" | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [trained, setTrained] = useState<number | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => setDraft(readDraft()), []);
  if (!draft) return null;

  function apply() {
    if (!draft) return;
    onApply({ bot_name: draft.name, welcome_message: draft.greeting, primary_color: draft.color });
    toast.success("Look applied. Press Save below to keep it.");
  }

  async function train() {
    if (!draft || !businessId) return;
    setBusy("train");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please sign in again"); return; }

      let id = agentId;
      if (!id) {
        const { data: existing } = await supabase
          .from("agents").select("id")
          .eq("tenant_id", user.id).eq("business_id", businessId)
          .order("created_at").limit(1).maybeSingle();
        id = existing?.id ?? null;
      }
      if (!id) {
        const { data: created, error } = await supabase
          .from("agents")
          .insert({
            tenant_id: user.id, business_id: businessId, name: draft.name, agent_type: "sales",
            persona: "You are a helpful assistant. Be warm and concise.",
            quick_replies_enabled: true, media_enabled: true,
            lead_form_enabled: true, lead_form_mode: "progressive", is_active: false,
          })
          .select("id").single();
        if (error) { toast.error(error.message); return; }
        id = created.id;
      }
      setAgentId(id);

      const res = await fetch("/api/agent/train-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: id, url: `https://${draft.site}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Could not read that website"); return; }
      setTrained(data.chunks ?? 0);
      toast.success(`Learned ${data.chunks ?? 0} sections from ${draft.site}`);
    } finally {
      setBusy(null);
    }
  }

  async function goLive() {
    if (!agentId) return;
    setBusy("live");
    try {
      const { error } = await supabase.from("agents").update({ is_active: true }).eq("id", agentId);
      if (error) { toast.error(error.message); return; }
      setLive(true);
      toast.success("Your chatbot is on");
    } finally {
      setBusy(null);
    }
  }

  function dismiss() {
    clearDraft();
    setDraft(null);
  }

  const step = "flex items-center gap-2 text-sm";
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 size-5 text-emerald-600" />
          <div>
            <h2 className="text-sm font-bold text-[#0c1f17]">Your chatbot for {draft.site} is ready to go live</h2>
            <p className="text-xs text-slate-600">You built it with our free tool. Finish in three clicks.</p>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button>
      </div>

      <ol className="mt-4 space-y-3">
        <li className={step}>
          <button onClick={apply} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100">1. Apply name, greeting and colour</button>
        </li>
        <li className={step}>
          <button onClick={train} disabled={busy !== null || !businessId} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy === "train" ? <Loader2 className="size-3.5 animate-spin" /> : trained !== null ? <Check className="size-3.5" /> : null}
            2. Teach it from {draft.site}
          </button>
          {trained !== null ? <span className="text-xs text-slate-600">{trained} sections learned. Review the wording in <Link href="/agents" className="font-semibold text-emerald-700 underline">Agents</Link>.</span> : null}
        </li>
        <li className={step}>
          <button onClick={goLive} disabled={!agentId || trained === null || busy !== null || live} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-50">
            {busy === "live" ? <Loader2 className="size-3.5 animate-spin" /> : live ? <Check className="size-3.5" /> : null}
            3. Turn the chatbot on
          </button>
          {live ? <span className="text-xs text-slate-600">Now copy the embed code below and paste it before <code>&lt;/body&gt;</code> on your website. Chats and leads appear in <Link href="/leads/website" className="font-semibold text-emerald-700 underline">Leads → Website chats</Link>.</span> : null}
        </li>
      </ol>
    </section>
  );
}
