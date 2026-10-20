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
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, Lock, Plus, Rocket, Search, Sparkles, Trash2, Wand2, X } from "lucide-react";
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
interface Picked { id: string; name: string | null; phone: string }
interface Access { allowed: boolean; reason?: string; tier: "full" | "trial"; maxContacts: number; maxSteps: number; images: boolean }
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

/** Reads a JSON reply, or explains what came back instead (e.g. a 404 page when a file was not uploaded). */
async function readJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      r.status === 404
        ? `This feature's server file is missing (${new URL(r.url).pathname} returned 404). Upload it to GitHub and redeploy.`
        : `The server returned an error page (status ${r.status}) for ${new URL(r.url).pathname}. Check the Vercel logs.`,
    );
  }
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NewCampaignAgentPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [audienceType, setAudienceType] = useState<"all" | "tags" | "contacts">("all");
  const [access, setAccess] = useState<Access | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [rollover, setRollover] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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

  useEffect(() => {
    fetch("/api/campaign-agent/access").then((r) => r.json()).then((a) => { if (typeof a?.allowed === "boolean") setAccess(a); }).catch(() => {});
  }, []);

  const audience = useMemo(
    () => ({
      type: audienceType,
      contactIds: audienceType === "contacts" ? picked.map((p) => p.id) : undefined,
      tagIds: audienceType === "tags" ? tagIds : undefined,
      excludeTagIds: excludeTagIds.length ? excludeTagIds : undefined,
      lastSeenWithin: lastSeen ? { preset: lastSeen } : undefined,
    }),
    [audienceType, picked, tagIds, excludeTagIds, lastSeen],
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
      const data = (await readJson(r)) as unknown as PlanResponse & { error?: string };
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

  const stepCount = plan ? plan.variants.length + plan.followups.length : 0;
  const limitMsg = useMemo(() => {
    if (!access) return null;
    if (res && res.audienceCount > access.maxContacts)
      return access.tier === "trial"
        ? `Your plan allows ${access.maxContacts} contacts per campaign and this one has ${res.audienceCount}. Pick fewer contacts or upgrade to Premium or Agent.`
        : `A campaign can have up to ${access.maxContacts.toLocaleString("en-IN")} contacts.`;
    if (stepCount > access.maxSteps)
      return access.tier === "trial"
        ? `Your plan allows ${access.maxSteps} messages per campaign and this one has ${stepCount}. Remove ${stepCount - access.maxSteps} or upgrade to Premium or Agent.`
        : `A campaign can have up to ${access.maxSteps} messages.`;
    return null;
  }, [access, res, stepCount]);

  async function rewrite(body: string): Promise<string | null> {
    try {
      const r = await fetch("/api/campaign-agent/rewrite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const d = (await readJson(r)) as { error?: string; body?: string };
      if (!r.ok) throw new Error(d.error ?? "Could not rewrite");
      return d.body ?? null;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rewrite");
      return null;
    }
  }

  async function launch() {
    if (!plan || !res) return;
    setLaunching(true);
    try {
      const r = await fetch("/api/campaign-agent/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, plan, audience, rollover, imageUrl }),
      });
      const data = (await readJson(r)) as { error?: string; id?: string };
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

      {access && !access.allowed && (
        <Panel><div className="flex items-center gap-3 p-5 text-[14px]"><Lock size={18} /> {access.reason}</div></Panel>
      )}
      {access?.allowed && access.tier === "trial" && (
        <div className="mb-5 rounded-xl border px-4 py-3 text-[13px]" style={{ borderColor: "var(--amber-200)", background: "var(--amber-50)", color: "var(--amber)" }}>
          Trial plan: up to {access.maxContacts} contacts and {access.maxSteps} messages per campaign, no AI images. Premium and Agent plans remove these limits.
        </div>
      )}
      {(!access || access.allowed) && (<>
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
            <div className="grid gap-3 sm:grid-cols-3">
              {([["all", "All my contacts"], ["tags", "Contacts with certain tags"], ["contacts", "Pick people myself"]] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setAudienceType(v)} className="rounded-xl border p-4 text-left text-[14px] font-medium transition" style={{ borderColor: audienceType === v ? "var(--brand)" : "var(--line)", background: audienceType === v ? "var(--brand-50)" : "var(--surface)" }}>
                  {label}
                </button>
              ))}
            </div>
            {audienceType === "tags" && (
              <TagPicker label="Include tags" tags={tags} value={tagIds} onToggle={(id) => toggle(tagIds, id, setTagIds)} />
            )}
            {audienceType === "contacts" && <ContactPicker value={picked} onChange={setPicked} max={access?.tier === "trial" ? access.maxContacts : 1000} />}
            {audienceType !== "contacts" && <TagPicker label="Leave out tags (optional)" tags={tags} value={excludeTagIds} onToggle={(id) => toggle(excludeTagIds, id, setExcludeTagIds)} />}
            {audienceType !== "contacts" && <div>
              <p className="mb-2 text-[13px] font-medium">Only contacts active recently</p>
              <div className="flex flex-wrap gap-2">
                {([["", "Anyone"], ["24h", "Last 24 hours"], ["7d", "Last 7 days"], ["30d", "Last 30 days"]] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setLastSeen(v)} className="rounded-full border px-3 py-1 text-[12.5px]" style={{ borderColor: lastSeen === v ? "var(--brand)" : "var(--line)", background: lastSeen === v ? "var(--brand-50)" : "var(--surface)", color: lastSeen === v ? "var(--brand-deep)" : "var(--ink-2)" }}>{label}</button>
                ))}
              </div>
            </div>}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft size={14} /> Back</Button>
              <Button disabled={planning || (audienceType === "tags" && tagIds.length === 0) || (audienceType === "contacts" && picked.length === 0)} onClick={writePlan}>
                {planning ? <><Loader2 size={14} className="animate-spin" /> Writing your campaign…</> : <><Sparkles size={14} /> Write my campaign</>}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {step === 2 && plan && res && (
        <div className="space-y-5">
          <ImagePanel access={access} imageUrl={imageUrl} onChange={setImageUrl} />
          <Panel>
            <PanelHead title="First message" subtitle={plan.variants.length > 1 ? "Each contact gets one version. Compare reads and replies afterwards." : "Edit the text if you like."} actions={plan.variants.length < MAX_VARIANTS && <Button size="sm" variant="outline" onClick={() => setPlan({ ...plan, variants: [...plan.variants, { label: `Version ${plan.variants.length + 1}`, body: plan.variants[0].body }] })}><Plus size={13} /> Add version</Button>} />
            <div className="space-y-4 p-5">
              {plan.variants.map((v, i) => (
                <MessageEditor key={i} title={plan.variants.length > 1 ? `Version ${String.fromCharCode(65 + i)} · ${v.label}` : v.label} body={v.body} sample={plan.sampleName} onImage={imageUrl} onRewrite={rewrite} onChange={(b) => patchVariant(i, b)} onRemove={plan.variants.length > 1 ? () => setPlan({ ...plan, variants: plan.variants.filter((_, j) => j !== i) }) : undefined} />
              ))}
            </div>
          </Panel>
          <Panel>
            <PanelHead title="Follow-ups" subtitle="Sent automatically after the wait, only to people who have not responded." actions={plan.followups.length < MAX_FOLLOWUPS && <Button size="sm" variant="outline" onClick={() => setPlan({ ...plan, followups: [...plan.followups, { label: "Reminder", waitHours: 48, rule: "no_reply", body: plan.variants[0].body }] })}><Plus size={13} /> Add follow-up</Button>} />
            <div className="space-y-4 p-5">
              {plan.followups.length > 0 && (
                <label className="flex items-start gap-3 rounded-xl border p-3 text-[13px]" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
                  <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[color:var(--brand)]" />
                  <span><b>Roll over failures.</b> People the first message could not reach (for a temporary reason) also get the next follow-up. Wrong or non-WhatsApp numbers are never included.</span>
                </label>
              )}
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
                  <MessageEditor title={f.label} body={f.body} sample={plan.sampleName} onImage={imageUrl} onRewrite={rewrite} onChange={(b) => patchFollow(i, { body: b })} />
                </div>
              ))}
            </div>
          </Panel>
          {limitMsg && <div className="rounded-xl border p-4 text-[13px]" style={{ borderColor: "var(--amber-200)", background: "var(--amber-50)", color: "var(--amber)" }}>{limitMsg}</div>}
          {issues.length > 0 && (
            <div className="rounded-xl border p-4 text-[13px]" style={{ borderColor: "var(--rose-200)", background: "var(--rose-50)", color: "var(--rose)" }}>
              Fix before continuing: {[...new Set(issues)].join(" ")}
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft size={14} /> Back</Button>
            <Button disabled={issues.length > 0 || !!limitMsg} onClick={() => setStep(3)}>Review <ArrowRight size={14} /></Button>
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
              {(rollover || imageUrl) && <p className="text-[12.5px] text-[color:var(--ink-2)]">{imageUrl ? "Every message carries your image. " : ""}{rollover ? "Failures roll over into the follow-ups. " : ""}If Meta rejects a message, the AI rewrites it and submits it again (up to 2 times). Temporary delivery failures are retried once.</p>}
              <p className="text-[12.5px] text-[color:var(--ink-3)]">Every message ends with “Reply STOP to unsubscribe”. You can pause or stop the campaign anytime from its page.</p>
            </div>
          </Panel>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft size={14} /> Back</Button>
            <Button disabled={launching || !!limitMsg || res.balance < res.estimate.firstMessage} onClick={launch}>
              {launching ? <><Loader2 size={14} className="animate-spin" /> Launching…</> : <><Rocket size={14} /> Launch campaign</>}
            </Button>
          </div>
        </div>
      )}
      </>)}
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

function MessageEditor({ title, body, sample, onChange, onRemove, onRewrite, onImage }: { title: string; body: string; sample: string; onChange: (b: string) => void; onRemove?: () => void; onRewrite?: (b: string) => Promise<string | null>; onImage?: string | null }) {
  const errs = checkBody(body);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_240px]">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold">
          <span>{title}</span>
          {onRemove && <button type="button" onClick={onRemove} className="text-[color:var(--ink-3)] hover:text-[color:var(--rose)]" aria-label="Remove"><Trash2 size={14} /></button>}
        </div>
        <Textarea value={body} onChange={(e) => onChange(e.target.value)} rows={6} maxLength={900} aria-invalid={errs.length > 0} />
        <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px] text-[color:var(--ink-3)]">
          {onRewrite && (
            <button type="button" disabled={busy || body.trim().length < 10} onClick={async () => { setBusy(true); const nb = await onRewrite(body); if (nb) onChange(nb); setBusy(false); }} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold text-[color:var(--brand-deep)] disabled:opacity-50" style={{ borderColor: "var(--brand-200)", background: "var(--brand-50)" }}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Rewrite with AI
            </button>
          )}
          <span className="flex-1">Use {"{{1}}"} for the customer&apos;s first name.</span>
          <span>{body.length}/900</span>
        </div>
      </div>
      <div className="rounded-xl p-3" style={{ background: "#e7f0e9" }}>
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--ink-3)]">Preview</p>
        <div className="whitespace-pre-wrap rounded-lg bg-white p-2.5 text-[13px] leading-snug shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {onImage && <img src={onImage} alt="" className="-mx-0.5 -mt-0.5 mb-2 w-[calc(100%+4px)] rounded-md object-cover" />}
          {body.replace(/\{\{\s*1\s*\}\}/g, sample)}
          <p className="mt-2 text-[11px] text-gray-400">Reply STOP to unsubscribe</p>
        </div>
      </div>
    </div>
  );
}

function ContactPicker({ value, onChange, max }: { value: Picked[]; onChange: (v: Picked[]) => void; max: number }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Picked[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/campaign-agent/contacts?q=${encodeURIComponent(term)}`);
        const d = await r.json();
        setFound(Array.isArray(d.contacts) ? d.contacts : []);
      } catch { setFound([]); } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const shown = q.trim().length < 2 ? [] : found;
  const add = (c: Picked) => { if (value.length >= max) { toast.error(`You can pick up to ${max} contacts.`); return; } if (!value.some((v) => v.id === c.id)) onChange([...value, c]); };
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium">Search by name or number ({value.length}/{max} picked)</p>
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <Search size={14} style={{ color: "var(--ink-3)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 letters or digits" className="flex-1 bg-transparent text-[13px] outline-none" />
        {loading && <Loader2 size={14} className="animate-spin" />}
      </div>
      {shown.length > 0 && (
        <ul className="mt-2 max-h-56 overflow-auto rounded-lg border" style={{ borderColor: "var(--line)" }}>
          {shown.map((c) => {
            const on = value.some((v) => v.id === c.id);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => (on ? onChange(value.filter((v) => v.id !== c.id)) : add(c))} className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[color:var(--surface-2)]">
                  <span>{c.name || "No name"} <span className="text-[color:var(--ink-3)]">{c.phone}</span></span>
                  {on ? <Check size={14} style={{ color: "var(--brand)" }} /> : <Plus size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px]" style={{ borderColor: "var(--brand-200)", background: "var(--brand-50)", color: "var(--brand-deep)" }}>
              {c.name || c.phone}
              <button type="button" onClick={() => onChange(value.filter((v) => v.id !== c.id))} aria-label="Remove"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ImagePanel({ access, imageUrl, onChange }: { access: Access | null; imageUrl: string | null; onChange: (u: string | null) => void }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = !!access && !access.images;
  async function send(init: RequestInit) {
    setBusy(true);
    try {
      const r = await fetch("/api/campaign-agent/image", { method: "POST", ...init });
      const d = (await readJson(r)) as { error?: string; url?: string };
      if (!r.ok || !d.url) throw new Error(d.error ?? "Could not add the image");
      onChange(d.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the image");
    } finally { setBusy(false); }
  }
  return (
    <Panel>
      <PanelHead title="Image (optional)" subtitle="Shown at the top of every message. Create one with AI or upload your own." />
      <div className="p-5">
        {locked ? (
          <p className="flex items-center gap-2 text-[13px] text-[color:var(--ink-3)]"><Lock size={14} /> Images are available on the Premium and Agent plans.</p>
        ) : imageUrl ? (
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Campaign" className="h-28 w-auto rounded-lg border" style={{ borderColor: "var(--line)" }} />
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" onClick={() => onChange(null)}><Trash2 size={13} /> Remove image</Button>
              <p className="text-[12px] text-[color:var(--ink-3)]">To change it, remove it and add another.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={400} placeholder="Describe the image, e.g. festive diwali diyas with warm golden light" className="h-9 flex-1 rounded-lg border bg-transparent px-3 text-[13px]" style={{ borderColor: "var(--line)" }} />
              <Button disabled={busy || prompt.trim().length < 5} onClick={() => send({ headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) })}>
                {busy ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Sparkles size={14} /> Create with AI</>}
              </Button>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[color:var(--brand-deep)]">
              <ImagePlus size={15} /> Upload my own (JPEG or PNG, up to 5 MB)
              <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const fd = new FormData(); fd.append("file", f); send({ body: fd }); } }} />
            </label>
            <p className="text-[12px] text-[color:var(--ink-3)]">AI images contain no text or logos. Check that the picture suits your brand before launching.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
