"use client";

// Quick Setup: one text box, one button.
//
// The owner types plain-language rules (Hindi / English / Hinglish), checks
// what AiSend understood, tries the assistant in a test chat (nothing is
// sent on WhatsApp, nothing is saved), then presses "Save & Activate".
//
// It saves into the normal AI Agents list, so everything here can be
// refined later on the AI Agents page. The logic lives in
// src/lib/quick-setup/* and the three routes under src/app/api/quick-setup/*.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useScopedBusinessId } from "@/hooks/use-business";
import { LANGUAGE_HINT, SETUP_EXAMPLES, TEST_MESSAGE_SUGGESTIONS } from "@/lib/quick-setup/examples";
import { MAX_SETUP_CHARS, MIN_SETUP_CHARS } from "@/lib/quick-setup/limits";
import { extractOwnerText, QUICK_SETUP_MARKER } from "@/lib/quick-setup/prompt";
import type { ExtractedFacts, SummaryLine } from "@/lib/quick-setup/facts";

interface ChatLine {
  role: "user" | "model";
  text: string;
  events?: Array<{ kind: string; detail: string }>;
}

interface SaveResult {
  agent_id: string;
  is_active: boolean;
  created: boolean;
  whatsapp: "assigned" | "not_connected" | "kept_other" | "skipped";
  other_active_agents?: number;
  notes: string[];
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Network problem. Please check your internet and try again." } as T & { error?: string } };
  }
}

const card = "rounded-2xl border border-black/10 bg-[#fff] p-4 sm:p-5";
const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-[#1B6B4A] px-5 py-3 text-sm font-semibold text-[#fff] transition hover:bg-[#155a3d] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-xl border border-[#1B6B4A] px-4 py-2.5 text-sm font-semibold text-[#1B6B4A] transition hover:bg-[#1B6B4A]/5 disabled:cursor-not-allowed disabled:opacity-50";

export default function QuickSetupPage() {
  const businessId = useScopedBusinessId();

  const [text, setText] = useState("");
  const [existing, setExisting] = useState<{ id: string; is_active: boolean } | null>(null);

  const [checking, setChecking] = useState(false);
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [facts, setFacts] = useState<ExtractedFacts | null>(null);
  const [summary, setSummary] = useState<SummaryLine[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [source, setSource] = useState<"ai" | "rules" | null>(null);

  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SaveResult | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);

  const trimmed = text.trim();
  const longEnough = trimmed.length >= MIN_SETUP_CHARS;
  const tooLong = trimmed.length > MAX_SETUP_CHARS;
  // The summary on screen belongs to the text that was checked. If the text
  // changes after that, the owner has to check again before saving.
  const confirmed = !!facts && checkedText === trimmed;

  /* Load the assistant Quick Setup made earlier, if there is one. */
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("agents")
        .select("id, persona, is_active")
        .eq("tenant_id", user.id)
        .eq("business_id", businessId)
        .like("persona", `%${QUICK_SETUP_MARKER}%`)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setExisting({ id: data.id as string, is_active: !!data.is_active });
      const original = extractOwnerText(data.persona);
      if (original) setText((prev) => (prev ? prev : original));
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, sending]);

  function pickExample(id: string) {
    const ex = SETUP_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    if (trimmed && trimmed !== ex.text && !window.confirm("Replace what you wrote with this example?")) return;
    setText(ex.text);
    setSaved(null);
  }

  const check = useCallback(async () => {
    setChecking(true);
    setSaved(null);
    const { ok, data } = await postJson<{ facts: ExtractedFacts; summary: SummaryLine[]; warnings: string[]; source: "ai" | "rules" }>(
      "/api/quick-setup/analyze",
      { prompt: trimmed },
    );
    setChecking(false);
    if (!ok || !data.facts) {
      toast.error(data.error || "Could not check your setup.");
      return;
    }
    setFacts(data.facts);
    setSummary(data.summary ?? []);
    setWarnings(data.warnings ?? []);
    setSource(data.source);
    setCheckedText(trimmed);
  }, [trimmed]);

  async function sendTest(message: string) {
    const msg = message.trim();
    if (!msg || sending) return;
    const history = chat.map((c) => ({ role: c.role, text: c.text }));
    setChat((c) => [...c, { role: "user", text: msg }]);
    setDraft("");
    setSending(true);
    const { ok, data } = await postJson<{ reply: string; events: Array<{ kind: string; detail: string }> }>(
      "/api/quick-setup/test-chat",
      { prompt: trimmed, facts: confirmed ? facts : undefined, history, message: msg },
    );
    setSending(false);
    if (!ok || !data.reply) {
      setChat((c) => [...c, { role: "model", text: data.error || "The test could not run. Please try again." }]);
      return;
    }
    setChat((c) => [...c, { role: "model", text: data.reply, events: data.events }]);
  }

  async function save(activate: boolean, replaceWhatsapp = false) {
    setSaving(true);
    const { ok, data } = await postJson<SaveResult>("/api/quick-setup/save", {
      prompt: trimmed,
      facts,
      activate,
      assign_whatsapp: true,
      replace_whatsapp: replaceWhatsapp,
    });
    setSaving(false);
    if (!ok || !data.agent_id) {
      toast.error(data.error || "Could not save.");
      return;
    }
    setSaved(data);
    setExisting({ id: data.agent_id, is_active: data.is_active });
    toast.success(activate ? "Saved and activated" : "Saved (not live yet)");
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold text-[color:var(--ink)]">Quick Setup</h1>
        <p className="mt-1 text-sm text-[color:var(--ink-2)]">
          Write how your business works in your own words. AiSend turns it into a WhatsApp assistant. No flow builder needed.
        </p>
        {existing && (
          <p className="mt-2 inline-block rounded-full bg-[#1B6B4A]/10 px-3 py-1 text-xs font-medium text-[#1B6B4A]">
            You already have a Quick Setup assistant ({existing.is_active ? "live" : "paused"}). Saving again updates it.
          </p>
        )}
      </header>

      {/* 1. The text box */}
      <section className={card}>
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="self-center text-xs font-medium text-[color:var(--ink-2)]">Start from an example:</span>
          {SETUP_EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => pickExample(ex.id)}
              className="rounded-full border border-[#1B6B4A]/30 px-3 py-1 text-xs font-medium text-[#1B6B4A] hover:bg-[#1B6B4A]/5"
            >
              {ex.label}
            </button>
          ))}
        </div>
        <label htmlFor="qs-text" className="sr-only">Your business rules</label>
        <textarea
          id="qs-text"
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(null); }}
          rows={9}
          maxLength={MAX_SETUP_CHARS + 500}
          placeholder="Example: Main Dr. Sharma hoon, Pediatrician. Fees Rs 800. Timing Mon-Sat 5-8 PM. Appointment ke liye naam, bache ki umar aur slot poochho..."
          className="w-full resize-y rounded-xl border border-black/15 bg-[#fff] p-3 text-base leading-relaxed text-[color:var(--ink)] outline-none focus:border-[#1B6B4A] focus:ring-2 focus:ring-[#1B6B4A]/20"
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-xs text-[color:var(--ink-2)]">
          <p className="max-w-xl">{LANGUAGE_HINT} The examples use made-up names and numbers: change them to yours.</p>
          <p className={tooLong ? "font-semibold text-red-600" : ""}>{trimmed.length} / {MAX_SETUP_CHARS}</p>
        </div>
        <div className="mt-4">
          <button type="button" className={primaryBtn} disabled={!longEnough || tooLong || checking} onClick={check}>
            {checking ? "Checking..." : "Check my setup"}
          </button>
        </div>
      </section>

      {/* 2. What AiSend understood */}
      {facts && (
        <section className={card} aria-live="polite">
          <h2 className="text-base font-semibold text-[color:var(--ink)]">What AiSend understood</h2>
          <p className="mt-1 text-xs text-[color:var(--ink-2)]">
            {source === "ai" ? "Read with AI." : "Read with simple rules (AI was not available), so please check it carefully."} Wrong or missing? Edit your text above and press Check again.
          </p>
          {!confirmed && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">You changed the text after checking. Press Check my setup again.</p>
          )}
          <dl className="mt-3 divide-y divide-black/5">
            {summary.map((line) => (
              <div key={line.key} className="py-2">
                <div className="flex flex-wrap gap-x-3">
                  <dt className="w-44 shrink-0 text-sm font-medium text-[color:var(--ink-2)]">{line.label}</dt>
                  <dd className={`text-sm ${line.value ? "font-semibold text-[color:var(--ink)]" : "text-[color:var(--ink-2)]"}`}>
                    {line.value ?? "Not found"}
                  </dd>
                </div>
                {line.note && <p className="mt-0.5 text-xs text-[color:var(--ink-2)] sm:ml-[11.75rem]">{line.note}</p>}
              </div>
            ))}
          </dl>
          {warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </section>
      )}

      {/* 3. Try it */}
      {longEnough && !tooLong && (
        <section className={card}>
          <h2 className="text-base font-semibold text-[color:var(--ink)]">Try it</h2>
          <p className="mt-1 text-xs text-[color:var(--ink-2)]">
            This is a test. Nothing is sent on WhatsApp, no appointment is saved, and your WhatsApp credits are not used. Type like a customer would.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TEST_MESSAGE_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={sending}
                onClick={() => sendTest(s)}
                className="rounded-full border border-black/15 px-3 py-1 text-xs text-[color:var(--ink)] hover:bg-black/5 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-3 max-h-96 min-h-[8rem] space-y-2 overflow-y-auto rounded-xl bg-[#f4f7f5] p-3">
            {chat.length === 0 && <p className="text-xs text-[color:var(--ink-2)]">No messages yet. Click one of the ideas above or type your own.</p>}
            {chat.map((c, i) => (
              <div key={i} className={`flex ${c.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${c.role === "user" ? "bg-[#1B6B4A] text-[#fff]" : "bg-[#fff] text-[color:var(--ink)] shadow-sm"}`}>
                  <p className="whitespace-pre-wrap break-words">{c.text}</p>
                  {c.events?.map((ev, j) => (
                    <p key={j} className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                      Test only, not saved: {ev.detail}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {sending && <p className="text-xs text-[color:var(--ink-2)]">Typing...</p>}
            <div ref={chatEnd} />
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); void sendTest(draft); }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder="Type a customer message..."
              className="min-w-0 flex-1 rounded-xl border border-black/15 bg-[#fff] px-3 py-2.5 text-sm outline-none focus:border-[#1B6B4A]"
            />
            <button type="submit" className={secondaryBtn} disabled={sending || !draft.trim()}>Send</button>
          </form>
        </section>
      )}

      {/* 4. Save & Activate */}
      <section className={card}>
        <h2 className="text-base font-semibold text-[color:var(--ink)]">Go live</h2>
        <p className="mt-1 text-xs text-[color:var(--ink-2)]">
          Save &amp; Activate switches this assistant on for your connected WhatsApp number. You can pause it any time on the AI Agents page. You must press Check my setup first so you can see what was understood.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={primaryBtn} disabled={!confirmed || saving} onClick={() => save(true)}>
            {saving ? "Saving..." : "Save & Activate"}
          </button>
          <button type="button" className={secondaryBtn} disabled={!confirmed || saving} onClick={() => save(false)}>
            Save without activating
          </button>
        </div>

        {saved && (
          <div className="mt-4 space-y-2 rounded-xl bg-[#1B6B4A]/10 p-3 text-sm text-[color:var(--ink)]" role="status">
            <p className="font-semibold">{saved.is_active ? "Your assistant is active." : "Saved. It is not live yet."}</p>
            {saved.whatsapp === "assigned" && <p>This assistant is also set as your WhatsApp assistant on the AI Agents page.</p>}
            {saved.whatsapp === "not_connected" && (
              <p>
                WhatsApp is not connected yet, so no customer will get replies. <Link className="font-semibold text-[#1B6B4A] underline" href="/settings">Connect WhatsApp in Settings</Link>, then press Save &amp; Activate again.
              </p>
            )}
            {saved.whatsapp === "kept_other" && (
              <p>
                The AI Agents page already shows another assistant as your WhatsApp assistant, so that setting was left as it is.{" "}
                <button type="button" className="font-semibold text-[#1B6B4A] underline" disabled={saving} onClick={() => save(true, true)}>
                  Use this new assistant instead
                </button>
              </p>
            )}
            {saved.is_active && (saved.other_active_agents ?? 0) > 0 && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                You have {saved.other_active_agents} other active AI agent(s). AiSend chooses between active agents for each message, so some customers may be answered by them. To use only this assistant, pause the others on the AI Agents page.
              </p>
            )}
            {saved.notes.map((n) => <p key={n}>{n}</p>)}
            <p>
              Want more control? <Link className="font-semibold text-[#1B6B4A] underline" href="/agents">Open AI Agents</Link>.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
