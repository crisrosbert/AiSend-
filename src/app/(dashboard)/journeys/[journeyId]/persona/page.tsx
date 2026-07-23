"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, Save, Loader2, RefreshCw, FileCode, Layers,
  Briefcase, Mic, Target, Shield, Plus, X,
} from "lucide-react";

interface PersonaState {
  id?: string;
  business_context: string;
  tone: string;
  goals: string[];
  guardrails: string[];
  escalation_rules: string[];
  raw_prompt?: string;
}

const EMPTY: PersonaState = {
  business_context: "",
  tone: "",
  goals: [],
  guardrails: [],
  escalation_rules: [],
};

type ViewMode = "sections" | "raw";

export default function PersonaPage() {
  const params = useParams<{ journeyId: string }>();
  const supabase = createClient();
  const journeyId = params.journeyId;

  const [persona, setPersona] = useState<PersonaState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState<ViewMode>("sections");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("user_id", user.id)
        .eq("journey_id", journeyId)
        .maybeSingle();

      if (error) {
        console.warn("personas table not provisioned:", error.message);
        setPersona(EMPTY);
      } else if (data) {
        setPersona({
          id: data.id,
          business_context: data.business_context ?? "",
          tone: data.tone ?? "",
          goals: data.goals ?? [],
          guardrails: data.guardrails ?? [],
          escalation_rules: data.escalation_rules ?? [],
          raw_prompt: data.raw_prompt ?? "",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, journeyId]);

  useEffect(() => { load(); }, [load]);

  // Compile sections into a raw system prompt
  function compilePrompt(p: PersonaState): string {
    const parts: string[] = [];
    if (p.business_context.trim()) {
      parts.push(`## Business Context\n${p.business_context.trim()}`);
    }
    if (p.tone.trim()) {
      parts.push(`## Tone & Voice\n${p.tone.trim()}`);
    }
    if (p.goals.length) {
      parts.push(`## Goals\n${p.goals.map((g) => `- ${g}`).join("\n")}`);
    }
    if (p.guardrails.length) {
      parts.push(`## Guardrails\n${p.guardrails.map((g) => `- ${g}`).join("\n")}`);
    }
    if (p.escalation_rules.length) {
      parts.push(`## When to Escalate\n${p.escalation_rules.map((r) => `- ${r}`).join("\n")}`);
    }
    return parts.join("\n\n");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in required"); return; }

      const payload = {
        user_id: user.id,
        journey_id: journeyId,
        business_context: persona.business_context,
        tone: persona.tone,
        goals: persona.goals,
        guardrails: persona.guardrails,
        escalation_rules: persona.escalation_rules,
        raw_prompt: view === "raw" ? persona.raw_prompt : compilePrompt(persona),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = persona.id
        ? await supabase.from("personas").update(payload).eq("id", persona.id).select().single()
        : await supabase.from("personas").insert(payload).select().single();

      if (error || !data) {
        toast.error("Couldn't save. Run the personas migration.");
        return;
      }
      setPersona((p) => ({ ...p, id: data.id }));
      toast.success("Persona saved");
    } finally {
      setSaving(false);
    }
  }

  async function generateFromBrainActions() {
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      toast.info("AI generation from Brain + Actions comes online in Phase 3");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const compiled = compilePrompt(persona);

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-violet-600 text-white shadow-md">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
                Agent personality
              </h2>
              <p className="mt-1 text-xs text-slate-500 max-w-xl">
                Define how your AI agent behaves, sounds, and what it should never do.
              </p>
            </div>
          </div>
          <button
            onClick={generateFromBrainActions}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-50"
          >
            {generating ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            Generate from Brain + Actions
          </button>
        </div>
      </div>

      {/* View toggle + Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-xl border border-[#e7ece9] bg-white p-1 shadow-sm">
          <ViewBtn active={view === "sections"} onClick={() => setView("sections")} icon={Layers}>Sections</ViewBtn>
          <ViewBtn active={view === "raw"} onClick={() => setView("raw")} icon={FileCode}>Raw</ViewBtn>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white"
          style={{
            background: "linear-gradient(135deg,#10b981,#059669)",
            boxShadow: "0 4px 12px rgba(16,185,129,.3)",
          }}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save Persona
        </button>
      </div>

      {view === "sections" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard
            icon={Briefcase}
            title="Business context"
            description="What you do, who you serve, key offerings."
            accent="#10b981"
          >
            <textarea
              value={persona.business_context}
              onChange={(e) => setPersona({ ...persona, business_context: e.target.value })}
              placeholder="We're Glow Salon in Jaipur, offering haircuts, color, facials, and bridal packages. Open Tue-Sun, 10 AM - 8 PM..."
              rows={6}
              className={inputCls}
            />
          </SectionCard>

          <SectionCard
            icon={Mic}
            title="Tone & voice"
            description="How the agent should sound when replying."
            accent="#3b82f6"
          >
            <textarea
              value={persona.tone}
              onChange={(e) => setPersona({ ...persona, tone: e.target.value })}
              placeholder="Warm, friendly, professional. Use simple language. Sprinkle a few light emojis for offers but avoid them in serious moments."
              rows={6}
              className={inputCls}
            />
          </SectionCard>

          <SectionCard
            icon={Target}
            title="Goals"
            description="What the agent should accomplish per conversation."
            accent="#f59e0b"
          >
            <ListEditor
              items={persona.goals}
              onChange={(items) => setPersona({ ...persona, goals: items })}
              placeholder="Book an appointment within 3 messages"
            />
          </SectionCard>

          <SectionCard
            icon={Shield}
            title="Guardrails & escalation"
            description="What the agent must never do or say. When to hand off to a human."
            accent="#ef4444"
          >
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Never do this
                </div>
                <ListEditor
                  items={persona.guardrails}
                  onChange={(items) => setPersona({ ...persona, guardrails: items })}
                  placeholder="Never quote prices without checking with owner"
                />
              </div>
              <div className="border-t border-[#e7ece9] pt-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Escalate to human when
                </div>
                <ListEditor
                  items={persona.escalation_rules}
                  onChange={(items) => setPersona({ ...persona, escalation_rules: items })}
                  placeholder="Customer is upset or complaining"
                />
              </div>
            </div>
          </SectionCard>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e7ece9] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#e7ece9] bg-[#f8faf9] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="size-4 text-slate-400" />
              <h3 className="text-sm font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
                Compiled system prompt
              </h3>
            </div>
            <button
              onClick={() => setPersona({ ...persona, raw_prompt: compiled })}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
            >
              <RefreshCw className="size-3" />
              Recompile from sections
            </button>
          </div>
          <div className="p-1">
            <textarea
              value={persona.raw_prompt ?? compiled}
              onChange={(e) => setPersona({ ...persona, raw_prompt: e.target.value })}
              placeholder="Your compiled system prompt will appear here. Edit it directly for fine-grained control."
              rows={20}
              className="w-full bg-white p-4 text-[13px] font-mono text-[#0c1f17] focus:outline-none resize-none"
            />
          </div>
          <div className="border-t border-[#e7ece9] bg-amber-50 px-5 py-2.5">
            <p className="text-[11px] text-amber-700">
              <strong>Note:</strong> Editing raw mode overrides the compiled output from sections.
              Switching back to Sections won&apos;t lose your raw edits, but Recompile will.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  icon: Icon, title, description, accent, children,
}: {
  icon: typeof Briefcase; title: string; description: string;
  accent: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#e7ece9] bg-white p-5 shadow-sm overflow-hidden relative">
      <span className="absolute left-0 right-0 top-0 h-[3px]" style={{ background: accent }} />
      <div className="mb-3 flex items-start gap-2.5">
        <div
          className="flex size-9 items-center justify-center rounded-lg text-white shrink-0"
          style={{
            background: `linear-gradient(135deg,${accent},${accent}dd)`,
            boxShadow: `0 4px 10px ${accent}55`,
          }}
        >
          <Icon className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ListEditor({
  items, onChange, placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function addItem() {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="group flex items-center gap-2 rounded-lg border border-[#e7ece9] bg-[#f8faf9] px-3 py-2"
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                {idx + 1}
              </span>
              <span className="flex-1 text-xs text-[#0c1f17]">{item}</span>
              <button
                onClick={() => removeItem(idx)}
                className="rounded-md p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs text-[#0c1f17] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <button
          onClick={addItem}
          className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
        >
          <Plus className="size-3" /> Add
        </button>
      </div>
    </div>
  );
}

function ViewBtn({
  active, onClick, icon: Icon, children,
}: {
  active: boolean; onClick: () => void;
  icon: typeof Layers; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
        active
          ? "bg-emerald-500 text-white shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-[#e7ece9] bg-white p-3 text-sm text-[#0c1f17] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
