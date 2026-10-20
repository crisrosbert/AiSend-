"use client";

// src/app/(dashboard)/campaign-agent/new/page.tsx
//
// Campaign Agent wizard: Goal → Audience → Journey → Review.
// The AI only writes the plan. Nothing is sent until the user presses Launch
// on the last step, and the server re-checks audience, wallet and message
// rules at that moment.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Rocket, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHead } from "@/components/ui/page-head";
import { Panel, PanelHead } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/ui/pill";
import {
  checkBody,
  MAX_FOLLOWUPS,
  MAX_VARIANTS,
  type CampaignPlan,
  type FollowupRule,
} from "@/lib/campaign-agent/plan";

const STEPS = ["Goal", "Audience", "Journey", "Review"] as const;
const EXAMPLES = [
  "Diwali sale: flat 20% off on all products till Sunday. Send to customers who bought in the last 3 months.",
  "Win back customers who have not replied in 30 days with a 10% comeback offer valid for 5 days.",
  "New product launch: our summer collection is live. Invite customers to see it.",
];

interface Tag { id: string; name: string }
type Recency = "" | "24h" | "7d" | "30d";
interface Estimate { firstMessage: number; upperBound: number }
interface PlanResponse {
  plan: CampaignPlan;
  usedFallback: boolean;
  audienceCount: number;
  skippedOptOut: number;
  estimate: Estimate;
  balance: number;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NewCampaignAgentPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [audienceType, setAudienceType] = useState<"all" | "tags">("all");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>([]);
  const [lastSeen, setLastSeen] = useState<Recency>("");
  const [planning, setPlanning] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [res, setRes] = useState<PlanResponse | null>(null);
  const [plan, setPlan] = useState<CampaignPlan | null>(null);

  useEffect(() => {
    supabase.from("tags").select("id, name").order("name").then(({ data }) => setTags((data ?? []) as Tag[]));
  }, [supabase]);

  const audience = useMemo(
    () => ({
      type: audienceType,
      tagIds: audienceType === "tags" ? tagIds : undefined,
      excludeTagIds: excludeTagIds.length ? excludeTagIds : undefined,
      lastSeenWithin: lastSeen ? { preset: lastSeen } : undefined,
    }),
    [audienceType, tagIds, excludeTagIds, lastSeen],
  );

  const toggle = (list: string[], id: string, set: (v: string[]) => void) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function writePlan() {
    setPlanning(true);
    try {
      const r = await fetch("/api/campaign-agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, audience }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Could not write the plan");
      setRes(data);
      setPlan(data.plan);
      if (data.usedFallback) toast.message("AI is unavailable right now, so a simple plan was drafted. Edit it before launching.");
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not write the plan");
    } finally {
      setPlanning(false);
    }
  }

  const issues = useMemo(() => {
    if (!plan) return [] as string[];
    return [...plan.variants, ...plan.followups].flatMap((m) => checkBody(m.body));
  }, [plan]);

  async function launch() {
    if (!plan || !res) return;
    setLaunching(true);
    try {
      const r = await fetch("/api/campaign-agent/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, plan, audience }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Could not launch");
      toast.success("Campaign created. Messages are with Meta for approval.");
      router.push(`/campaign-agent/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not launch");
      setLaunching(false);
    }
  }

  const patchVariant = (i: number, body: string) => setPlan((p) => p && { ...p, variants: p.variants.map((v, j) => (j === i ? { ...v, body } : v)) });
  const patchFollow = (i: number, patch: Partial<CampaignPlan["followups"][number]>) =>
    setPlan((p) => p && { ...p, followups: p.followups.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-20 pt-5 sm:px-7 lg:pb-10">
      <PageHead title="New AI campaign" subtitle="Tell the agent your goal. It writes the messages and follow-ups; you review and launch." />

      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-2 text-[13px]">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full border text-[12px] font-semibold"
              style={{
                borderColor: i <= step ? "var(--brand)" : "var(--line)",
                background: i < step ? "var(--brand)" : i === step ? "var(--brand-50)" : "var(--surface)",
                color: i < step ? "#fff" : i === step ? "var(--brand-deep)" : "var(--ink-3)",
              }}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span className={i === step ? "font-semibold text-[color:var(--ink)]" : "text-[color:var(--ink-3)]"}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1" style={{ background: i < step ? "var(--brand)" : "var(--line)" }} />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Panel>
          <PanelHead title="What would you like to promote?" subtitle="Describe the offer in English or Hinglish. Add what, for whom and until when." />
          <div className="space-y-4 p-5">
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={5} maxLength={800} placeholder="e.g. Diwali sale, flat 20% off till Sunday. Tell everyone who bought from us before." />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[color:var(--ink-3)]">Try one:</span>
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => setGoal(e)} className="rounded-full border px-3 py-1 text-[12px] text-[color:var(--ink-2)] transition hover:bg-[color:var(--surface-2)]" style={{ borderColor: "var(--line)" }}>
                  {e.split(":")[0].slice(0, 38)}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button disabled={goal.trim().length < 10} onClick={() => setStep(1)}>Next: who gets it <ArrowRight size={14} /></Button>
            </div>
          </div>
        </Panel>
      )}

      {step === 1 && (
        <Panel>
          <PanelHead title="Who should receive it?" subtitle="Contacts who opted out are always left out." />
          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {([["all", "All my contacts"], ["tags", "Contacts with certain tags"]] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setAudienceType(v)} className="rounded-xl border p-4 text-left text-[14px] font-medium transition" style={{ borderColor: audienceType === v ? "var(--brand)" : "var(--line)", background: audienceType === v ? "var(--brand-50)" : "var(--surface)" }}>
                  {label}
                </button>
              ))}
            </div>
            {audienceType === "tags" && (
              <TagPicker label="Include tags" tags={tags} value={tagIds} onToggle={(id) => toggle(tagIds, id, setTagIds)} />
            )}
            <TagPicker label="Leave out tags (optional)" tags={tags} value={excludeTagIds} onToggle={(id) => toggle(excludeTagIds, id, setExcludeTagIds)} />
            <div>
              <p className="mb-2 text-[13px] font-medium">Only contacts active recently</p>
              <div className="flex flex-wrap gap-2">
                {([["", "Anyone"], ["24h", "Last 24 hours"], ["7d", "Last 7 days"], ["30d", "Last 30 days"]] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setLastSeen(v)} className="rounded-full border px-3 py-1 text-[12.5px]" style={{ borderColor: lastSeen === v ? "var(--brand)" : "var(--line)", background: lastSeen === v ? "var(--brand-50)" : "var(--surface)", color: lastSeen === v ? "var(--brand-deep)" : "var(--ink-2)" }}>{label}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft size={14} /> Back</Button>
              <Button disabled={planning || (audienceType === "tags" && tagIds.length === 0)} onClick={writePlan}>
                {planning ? <><Loader2 size={14} className="animate-spin" /> Writing your campaign…</> : <><Sparkles size={14} /> Write my campaign</>}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {step === 2 && plan && res && (
        <div className="space-y-5">
          <Panel>
            <PanelHead title="First message" subtitle={plan.variants.length > 1 ? "Each contact gets one version. Compare reads and replies afterwards." : "Edit the text if you like."} actions={plan.variants.length < MAX_VARIANTS && <Button size="sm" variant="outline" onClick={() => setPlan({ ...plan, variants: [...plan.variants, { label: `Version ${plan.variants.length + 1}`, body: plan.variants[0].body }] })}><Plus size={13} /> Add version</Button>} />
            <div className="space-y-4 p-5">
              {plan.variants.map((v, i) => (
                <MessageEditor key={i} title={plan.variants.length > 1 ? `Version ${String.fromCharCode(65 + i)} · ${v.label}` : v.label} body={v.body} sample={plan.sampleName} onChange={(b) => patchVariant(i, b)} onRemove={plan.variants.length > 1 ? () => setPlan({ ...plan, variants: plan.variants.filter((_, j) => j !== i) }) : undefined} />
              ))}
            </div>
          </Panel>
          <Panel>
            <PanelHead title="Follow-ups" subtitle="Sent automatically after the wait, only to people who have not responded." actions={plan.followups.length < MAX_FOLLOWUPS && <Button size="sm" variant="outline" onClick={() => setPlan({ ...plan, followups: [...plan.followups, { label: "Reminder", waitHours: 48, rule: "no_reply", body: plan.variants[0].body }] })}><Plus size={13} /> Add follow-up</Button>} />
            <div className="space-y-4 p-5">
              {plan.followups.length === 0 && <p className="text-[13px] text-[color:var(--ink-3)]">No follow-ups. Only the first message will be sent.</p>}
              {plan.followups.map((f, i) => (
                <div key={i} className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--line)" }}>
                  <div className="flex flex-wrap items-center gap-3 text-[13px]">
                    <span className="font-semibold">Follow-up {i + 1}</span>
                    <label className="flex items-center gap-2">Wait
                      <input type="number" min={1} max={336} value={f.waitHours} onChange={(e) => patchFollow(i, { waitHours: Math.max(1, Math.min(336, Number(e.target.value) || 1)) })} className="h-8 w-20 rounded-lg border bg-transparent px-2" style={{ borderColor: "var(--line)" }} /> hours
                    </label>
                    <label className="flex items-center gap-2">Send to people who
                      <select value={f.rule} onChange={(e) => patchFollow(i, { rule: e.target.value as FollowupRule })} className="h-8 rounded-lg border bg-transparent px-2" style={{ borderColor: "var(--line)" }}>
                        <option value="no_reply">did not reply</option>
                        <option value="not_read">did not read it</option>
                      </select>
                    </label>
                    <button type="button" onClick={() => setPlan({ ...plan, followups: plan.followups.filter((_, j) => j !== i) })} className="ml-auto text-[color:var(--ink-3)] hover:text-[color:var(--rose)]" aria-label="Remove follow-up"><Trash2 size={15} /></button>
                  </div>
                  <MessageEditor title={f.label} body={f.body} sample={plan.sampleName} onChange={(b) => patchFollow(i, { body: b })} />
                </div>
              ))}
            </div>
          </Panel>
          {issues.length > 0 && (
            <div className="rounded-xl border p-4 text-[13px]" style={{ borderColor: "var(--rose-200)", background: "var(--rose-50)", color: "var(--rose)" }}>
              Fix before continuing: {[...new Set(issues)].join(" ")}
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft size={14} /> Back</Button>
            <Button disabled={issues.length > 0} onClick={() => setStep(3)}>Review <ArrowRight size={14} /></Button>
          </div>
        </div>
      )}

      {step === 3 && plan && res && (
        <div className="space-y-5">
          <Panel>
            <PanelHead title="Review and launch" subtitle="Nothing is sent until Meta approves your messages." />
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Summary label="People who will get it" value={res.audienceCount.toLocaleString("en-IN")} note={res.skippedOptOut ? `${res.skippedOptOut} opted-out left out` : undefined} />
                <Summary label="First message cost" value={inr(res.estimate.firstMessage)} note="at marketing rates" />
                <Summary label="Highest possible total" value={inr(res.estimate.upperBound)} note="if every follow-up goes to everyone" />
              </div>
              {res.balance < res.estimate.firstMessage && (
                <div className="rounded-xl border p-3 text-[13px]" style={{ borderColor: "var(--rose-200)", background: "var(--rose-50)", color: "var(--rose)" }}>
                  Your balance is {inr(res.balance)}. Add credits before launching: the first message needs {inr(res.estimate.firstMessage)}.
                </div>
              )}
              {res.balance >= res.estimate.firstMessage && res.balance < res.estimate.upperBound && (
                <p className="text-[12.5px] text-[color:var(--ink-3)]">Balance {inr(res.balance)}. The campaign pauses by itself if a follow-up needs more than you have.</p>
              )}
              <ol className="space-y-2 text-[13.5px]">
                <li className="flex items-center gap-2"><Pill tone="info" dotless>1</Pill> Messages go to Meta for approval ({plan.variants.length + plan.followups.length} template{plan.variants.length + plan.followups.length === 1 ? "" : "s"})</li>
                <li className="flex items-center gap-2"><Pill tone="info" dotless>2</Pill> After approval, the first message is sent{plan.variants.length > 1 ? ` (${plan.variants.length} versions, split evenly)` : ""}</li>
                {plan.followups.map((f, i) => (
                  <li key={i} className="flex items-center gap-2"><Pill tone="info" dotless>{i + 3}</Pill> {f.waitHours} hours later: follow-up to people who {f.rule === "no_reply" ? "did not reply" : "did not read it"}</li>
                ))}
              </ol>
              <p className="text-[12.5px] text-[color:var(--ink-3)]">Every message ends with “Reply STOP to unsubscribe”. You can pause or stop the campaign anytime from its page.</p>
            </div>
          </Panel>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft size={14} /> Back</Button>
            <Button disabled={launching || res.balance < res.estimate.firstMessage} onClick={launch}>
              {launching ? <><Loader2 size={14} className="animate-spin" /> Launching…</> : <><Rocket size={14} /> Launch campaign</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TagPicker({ label, tags, value, onToggle }: { label: string; tags: Tag[]; value: string[]; onToggle: (id: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium">{label}</p>
      {tags.length === 0 ? (
        <p className="text-[12.5px] text-[color:var(--ink-3)]">No tags yet. Add tags to contacts first.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <button key={t.id} type="button" onClick={() => onToggle(t.id)} className="rounded-full border px-3 py-1 text-[12.5px]" style={{ borderColor: value.includes(t.id) ? "var(--brand)" : "var(--line)", background: value.includes(t.id) ? "var(--brand-50)" : "var(--surface)", color: value.includes(t.id) ? "var(--brand-deep)" : "var(--ink-2)" }}>{t.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
      <p className="text-[12px] text-[color:var(--ink-3)]">{label}</p>
      <p className="mt-1 text-[22px] font-bold tabular-nums tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
      {note && <p className="mt-0.5 text-[11.5px] text-[color:var(--ink-3)]">{note}</p>}
    </div>
  );
}

function MessageEditor({ title, body, sample, onChange, onRemove }: { title: string; body: string; sample: string; onChange: (b: string) => void; onRemove?: () => void }) {
  const errs = checkBody(body);
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_240px]">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold">
          <span>{title}</span>
          {onRemove && <button type="button" onClick={onRemove} className="text-[color:var(--ink-3)] hover:text-[color:var(--rose)]" aria-label="Remove"><Trash2 size={14} /></button>}
        </div>
        <Textarea value={body} onChange={(e) => onChange(e.target.value)} rows={6} maxLength={900} aria-invalid={errs.length > 0} />
        <div className="mt-1 flex justify-between text-[11.5px] text-[color:var(--ink-3)]">
          <span>Use {"{{1}}"} for the customer&apos;s first name.</span>
          <span>{body.length}/900</span>
        </div>
      </div>
      <div className="rounded-xl p-3" style={{ background: "#e7f0e9" }}>
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--ink-3)]">Preview</p>
        <div className="whitespace-pre-wrap rounded-lg bg-white p-2.5 text-[13px] leading-snug shadow-sm">
          {body.replace(/\{\{\s*1\s*\}\}/g, sample)}
          <p className="mt-2 text-[11px] text-gray-400">Reply STOP to unsubscribe</p>
        </div>
      </div>
    </div>
  );
}
