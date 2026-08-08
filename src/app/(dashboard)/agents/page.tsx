"use client";

// src/app/(dashboard)/agents/page.tsx
//
// ── WHAT THIS PAGE DOES ──────────────────────────────────────────────
// Two tabs over one route:
//
//   "Your Agents"  — the agents this tenant has already created.
//   "Templates"    — 10 ready-made agents. Clicking one creates a real
//                    agent pre-filled from it, then opens the editor.
//
// ── HOW A TEMPLATE BECOMES AN AGENT ──────────────────────────────────
// There is only ONE agent engine. A template is just a bundle of
// defaults — a persona string plus capability flags — so "Use this
// Agent" is literally an INSERT into the `agents` table. See
// src/lib/agent/templates.ts, which owns that mapping.
//
// ── ON THE MISSING STATS ─────────────────────────────────────────────
// An earlier design showed Conversations / Leads / Spend on each card.
// Two of those cannot be computed today: `conversations` has no column
// linking it to an AI agent (`assigned_agent_id` is the HUMAN teammate),
// and agent replies bill as "service" = ₹0, so a spend figure would read
// ₹0.00 forever. Rather than show numbers that are wrong or always zero,
// the cards stay clean. Add the stats when the data can back them.

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Bot, Loader2, Save, Plus, Image as ImageIcon, Brain, X, Sparkles,
  Search, Check, Copy, Globe, MessageCircle, Clock,
} from "lucide-react";
import {
  AGENT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  agentRowFromTemplate,
  type AgentTemplate,
} from "@/lib/agent/templates";
import {
  parseBusinessHours,
  formatDayLabel,
  type BusinessHours,
  type DayHours,
} from "@/lib/agent/business-hours";

/** Mirrors the columns of the `agents` table this page reads/writes. */
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
  /** JSONB — the shape parseBusinessHours() reads. May be null on older rows. */
  business_hours: unknown;
  /** Number the agent offers when a booking cannot be saved. */
  fallback_contact: string | null;
}

/** Values the engine understands for `agents.agent_type`. */
const TYPES = ["sales", "marketing", "creative", "social", "support", "realestate", "other"];

export default function AgentsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Which tab is showing. New tenants have no agents, so we drop them on
  // Templates — an empty list teaches nobody anything.
  const [tab, setTab] = useState<"mine" | "templates">("templates");

  // Template browsing state.
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  // The agent open in the config drawer, or null when it's closed.
  const [editing, setEditing] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  // Holds the template id currently being turned into an agent, so only
  // that one card shows a spinner.
  const [applying, setApplying] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Which agent answers general WhatsApp messages. Stored on
  // whatsapp_config so it sits beside the ads-agent picker that already
  // works the same way.
  const [waAgentId, setWaAgentId] = useState<string>("");
  const [waSaving, setWaSaving] = useState(false);
  const [hasWaConfig, setHasWaConfig] = useState(false);

  // "Train from your website" — the URL box in the drawer, plus what
  // came back from the last run so we can show the user what happened.
  const [trainUrl, setTrainUrl] = useState("");
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<
    { title: string; chunks: number } | null
  >(null);

  /* ── load ─────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("tenant_id", user.id)
      .order("created_at");

    const rows = data || [];
    setAgents(rows);

    // The WhatsApp number's config. Absent until they connect WhatsApp,
    // in which case there is nothing to assign an agent to yet.
    const { data: waConfig } = await supabase
      .from("whatsapp_config")
      .select("whatsapp_agent_id")
      .eq("user_id", user.id)
      .maybeSingle();
    setHasWaConfig(!!waConfig);
    setWaAgentId(waConfig?.whatsapp_agent_id ?? "");
    // Returning users go straight to their own agents.
    if (rows.length > 0) setTab("mine");
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  /* ── actions ──────────────────────────────────────────────────── */

  /** Save the drawer's edits back to the row. */
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
          business_hours: editing.business_hours,
          fallback_contact: editing.fallback_contact?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Agent saved");
      setEditing(null);
      load();
    } finally { setSaving(false); }
  }

  /**
   * "Use this Agent" — the whole template flow.
   *
   * Named applyTemplate, not useTemplate: React treats any function
   * starting with "use" as a Hook and the rules-of-hooks lint fails on
   * calling it from an onClick.
   *
   * agentRowFromTemplate() builds the row (persona + flags), we insert
   * it, then open the drawer on the result so the owner can rename it
   * and switch it on. Note it is created INACTIVE: nobody should start
   * talking to real customers because someone clicked a card.
   */
  async function applyTemplate(template: AgentTemplate) {
    if (!userId) { toast.error("Please sign in again"); return; }
    setApplying(template.id);
    try {
      const { data, error } = await supabase
        .from("agents")
        .insert(agentRowFromTemplate(template, userId))
        .select("*")
        .single();
      if (error) { toast.error(error.message); return; }

      toast.success(`${template.name} added — review it, then switch it on`);
      await load();
      setTab("mine");
      setEditing(data);
    } finally { setApplying(null); }
  }

  /** A blank agent, for people who'd rather write the persona themselves. */
  async function createBlank() {
    if (!userId) { toast.error("Please sign in again"); return; }
    setApplying("blank");
    try {
      const { data, error } = await supabase
        .from("agents")
        .insert({
          tenant_id: userId,
          name: "New Agent",
          agent_type: "sales",
          persona: "You are a helpful assistant. Be warm and concise.",
          quick_replies_enabled: true,
          is_active: false,
        })
        .select("*")
        .single();
      if (error) { toast.error(error.message); return; }
      toast.success("Agent created");
      await load();
      setTab("mine");
      setEditing(data);
    } finally { setApplying(null); }
  }

  /**
   * "Train from your website" — reads one page and does two things:
   *
   *   • Stores it as knowledge (chunked into agent_kb_chunks) so the
   *     agent can quote real facts. This is saved immediately.
   *   • Drafts a persona from the page, which we drop into the textarea
   *     WITHOUT saving.
   *
   * The persona is deliberately left unsaved. A model reading a website
   * will invent delivery times and refund terms; a human has to read it
   * before it can start telling customers anything.
   */
  async function trainFromUrl() {
    if (!editing) return;
    if (!trainUrl.trim()) { toast.error("Paste your website address first"); return; }

    setTraining(true);
    setTrainResult(null);
    try {
      const res = await fetch("/api/agent/train-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: editing.id, url: trainUrl.trim() }),
      });
      const data = await res.json();

      if (!res.ok) { toast.error(data.error || "Could not read that page"); return; }

      setTrainResult({ title: data.title, chunks: data.chunks ?? 0 });

      // Only replace the persona if the model actually produced one.
      // A failed draft must never wipe the template's wording.
      if (data.persona) {
        setEditing((prev) => (prev ? { ...prev, persona: data.persona } : prev));
        toast.success("Persona drafted — read it, edit it, then Save agent");
      } else {
        toast.success(`Knowledge added from ${data.title}`);
      }

      // The route creates a journey when the agent had none, so refresh
      // the list to pick up the new journey_id (the Knowledge button
      // needs it to link anywhere useful).
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Training failed");
    } finally {
      setTraining(false);
    }
  }

  /**
   * Assign (or clear) the agent that answers general WhatsApp messages.
   *
   * Saves immediately on change rather than behind a Save button — it is
   * a single dropdown, and a picker that silently does nothing until you
   * find a button elsewhere is how features get reported as broken.
   */
  async function saveWhatsAppAgent(nextId: string) {
    const previous = waAgentId;
    setWaAgentId(nextId);
    setWaSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_config")
        .update({ whatsapp_agent_id: nextId || null })
        .eq("user_id", userId);
      if (error) {
        setWaAgentId(previous);
        toast.error(error.message);
        return;
      }
      toast.success(
        nextId
          ? "This agent now answers your WhatsApp messages"
          : "WhatsApp replies left to your flows",
      );
    } finally {
      setWaSaving(false);
    }
  }

  /** Copy the embed snippet for a specific agent. */
  function copyEmbed(agent: Agent) {
    const snippet = `<script src="${window.location.origin}/widget.js" data-org="${userId}" data-agent="${agent.id}"></script>`;
    navigator.clipboard.writeText(snippet);
    setCopiedId(agent.id);
    toast.success("Embed code copied");
    setTimeout(() => setCopiedId(null), 2000);
  }

  /* ── derived ──────────────────────────────────────────────────── */

  // Filter templates by chip + search box. Cheap enough to redo on every
  // keystroke at 10 templates; revisit if this list ever gets long.
  const visibleTemplates = AGENT_TEMPLATES.filter((t) => {
    const matchesCategory = category === "All" || t.category === category;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.tagline.toLowerCase().includes(q) ||
      t.chips.some((c) => c.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  /* ── render ───────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="ag">
        <style>{css}</style>
        <div className="ag-loading"><Loader2 className="ag-spin" size={20} /> Loading agents…</div>
      </div>
    );
  }

  return (
    <div className="ag">
      <style>{css}</style>

      {/* ── Header ── */}
      <header className="ag-head">
        <div className="ag-head-left">
          <span className="ag-head-ic"><Bot size={19} /></span>
          <div>
            <h1>AI Agents</h1>
            <p>Agents answer questions, capture leads and book appointments — around the clock.</p>
          </div>
        </div>
        <button className="ag-btn ag-btn-primary" onClick={createBlank} disabled={applying !== null}>
          {applying === "blank" ? <Loader2 size={15} className="ag-spin" /> : <Plus size={15} />}
          Create Agent
        </button>
      </header>

      {/* ── Channel assignment ──
          Only meaningful once WhatsApp is connected and at least one
          agent exists; showing an empty dropdown teaches nothing. */}
      {hasWaConfig && agents.length > 0 && (
        <section className="ag-channel">
          <div className="ag-channel-left">
            <span className="ag-channel-ic"><MessageCircle size={17} /></span>
            <div>
              <h2>Who answers WhatsApp?</h2>
              <p>
                This agent replies to anything your Chat Flows don&apos;t catch —
                including replies to your campaigns.
              </p>
            </div>
          </div>
          <div className="ag-channel-pick">
            <select
              className="ag-input"
              value={waAgentId}
              disabled={waSaving}
              onChange={(e) => saveWhatsAppAgent(e.target.value)}
              aria-label="Agent that answers WhatsApp"
            >
              <option value="">None — flows only</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.is_active ? "" : " (paused)"}
                </option>
              ))}
            </select>
            {waSaving && <Loader2 size={15} className="ag-spin ag-dim" />}
          </div>
        </section>
      )}

      {/* ── Tabs ── */}
      <nav className="ag-tabs" role="tablist">
        <button
          role="tab" aria-selected={tab === "mine"}
          className={`ag-tab ${tab === "mine" ? "on" : ""}`}
          onClick={() => setTab("mine")}
        >
          Your Agents <span className="ag-count">{agents.length}</span>
        </button>
        <button
          role="tab" aria-selected={tab === "templates"}
          className={`ag-tab ${tab === "templates" ? "on" : ""}`}
          onClick={() => setTab("templates")}
        >
          Templates <span className="ag-count">{AGENT_TEMPLATES.length}</span>
        </button>
      </nav>

      {/* ── Tab: Your Agents ── */}
      {tab === "mine" && (
        agents.length === 0 ? (
          <div className="ag-empty">
            <div className="ag-empty-ic"><Sparkles size={22} /></div>
            <h3>No agents yet</h3>
            <p>Start from a ready-made template — you can rewrite anything afterwards.</p>
            <button className="ag-btn ag-btn-primary" onClick={() => setTab("templates")}>
              Browse templates
            </button>
          </div>
        ) : (
          <div className="ag-grid">
            {agents.map((agent) => (
              <article key={agent.id} className="ag-card">
                <div className="ag-card-top">
                  <span className="ag-ic"><Bot size={16} /></span>
                  <div className="ag-card-body">
                    <div className="ag-card-title-row">
                      <h3>{agent.name}</h3>
                      <span className={`ag-pill ${agent.is_active ? "live" : "off"}`}>
                        {agent.is_active ? "Live" : "Paused"}
                      </span>
                    </div>
                    <p className="ag-card-meta">
                      {agent.agent_type}{agent.industry ? ` · ${agent.industry}` : ""}
                    </p>
                  </div>
                </div>

                {/* Capability chips, derived straight from the row's flags */}
                <div className="ag-chips">
                  {agent.booking_enabled && <span className="ag-chip">Booking</span>}
                  {agent.media_enabled && <span className="ag-chip">Media</span>}
                  {agent.lead_form_enabled && <span className="ag-chip">Lead form</span>}
                  {agent.payment_enabled && <span className="ag-chip">Payments</span>}
                  {agent.quick_replies_enabled && <span className="ag-chip">Quick replies</span>}
                </div>

                <div className="ag-card-actions">
                  <button
                    className="ag-btn ag-btn-primary ag-btn-sm"
                    onClick={() => { setTrainUrl(""); setTrainResult(null); setEditing(agent); }}
                  >
                    Configure
                  </button>
                  <a className="ag-icon-btn" href="/media" title="Media library"><ImageIcon size={15} /></a>
                  <a
                    className="ag-icon-btn"
                    href={agent.journey_id ? `/journeys/${agent.journey_id}/brain` : "/journeys"}
                    title="Knowledge"
                  >
                    <Brain size={15} />
                  </a>
                  <button className="ag-icon-btn" onClick={() => copyEmbed(agent)} title="Copy embed code">
                    {copiedId === agent.id ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {/* ── Tab: Templates ── */}
      {tab === "templates" && (
        <>
          <div className="ag-filters">
            <div className="ag-search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search agents…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search templates"
              />
            </div>
            <div className="ag-cats">
              {["All", ...TEMPLATE_CATEGORIES].map((c) => (
                <button
                  key={c}
                  className={`ag-cat ${category === c ? "on" : ""}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {visibleTemplates.length === 0 ? (
            <div className="ag-empty">
              <div className="ag-empty-ic"><Search size={22} /></div>
              <h3>Nothing matches “{query}”</h3>
              <p>Try a different search, or clear the category filter.</p>
            </div>
          ) : (
            <div className="ag-grid">
              {visibleTemplates.map((template) => (
                <article key={template.id} className="ag-card">
                  <div className="ag-card-top">
                    <span className="ag-ic ag-ic-emoji">{template.emoji}</span>
                    <div className="ag-card-body">
                      <div className="ag-card-title-row">
                        <h3>{template.name}</h3>
                      </div>
                      <p className="ag-card-desc">{template.tagline}</p>
                    </div>
                  </div>

                  <div className="ag-chips">
                    {template.chips.map((chip) => (
                      <span key={chip} className="ag-chip">{chip}</span>
                    ))}
                  </div>

                  <button
                    className="ag-btn ag-btn-primary ag-btn-full"
                    onClick={() => applyTemplate(template)}
                    disabled={applying !== null}
                  >
                    {applying === template.id
                      ? <><Loader2 size={15} className="ag-spin" /> Adding…</>
                      : <>Use this Agent</>}
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Config drawer ──
          Same editor as before: every field here maps to one column of
          the agents row, and the capability toggles are what the engine
          reads at runtime to decide which tools the model gets. */}
      {editing && (
        <div className="ag-overlay" onClick={() => setEditing(null)}>
          <aside className="ag-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="ag-drawer-head">
              <h2>Configure agent</h2>
              <button className="ag-icon-btn" onClick={() => setEditing(null)} aria-label="Close">
                <X size={17} />
              </button>
            </div>

            <Field label="Name">
              <input
                className="ag-input" value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>

            <Field label="Type">
              <select
                className="ag-input" value={editing.agent_type}
                onChange={(e) => setEditing({ ...editing, agent_type: e.target.value })}
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Industry">
              <input
                className="ag-input" value={editing.industry || ""}
                placeholder="e.g. Real Estate"
                onChange={(e) => setEditing({ ...editing, industry: e.target.value })}
              />
            </Field>

            {/* ── Train from website ──
                Sits directly above Persona because that is the field it
                fills in. Putting it lower would leave people editing a
                persona that is about to be replaced. */}
            <div className="ag-drawer-section"><Globe size={14} /> Train from your website</div>
            <div className="ag-train">
              <p className="ag-train-lead">
                Paste a page — your homepage, About or FAQ. We read it, save it as
                knowledge the agent can quote, and draft a persona for you to review.
              </p>
              <div className="ag-train-row">
                <input
                  className="ag-input"
                  type="url"
                  placeholder="https://yourbusiness.com"
                  value={trainUrl}
                  onChange={(e) => setTrainUrl(e.target.value)}
                  disabled={training}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void trainFromUrl(); } }}
                />
                <button
                  type="button"
                  className="ag-btn ag-btn-primary"
                  onClick={trainFromUrl}
                  disabled={training || !trainUrl.trim()}
                >
                  {training
                    ? <><Loader2 size={15} className="ag-spin" /> Reading…</>
                    : <><Sparkles size={15} /> Train</>}
                </button>
              </div>

              {trainResult && (
                <p className="ag-train-done">
                  <Check size={13} /> Added <strong>{trainResult.title}</strong> —{" "}
                  {trainResult.chunks} passage{trainResult.chunks === 1 ? "" : "s"} indexed.
                </p>
              )}

              <p className="ag-hint">
                The draft persona is not saved until you press Save agent. Read it
                first — anything it gets wrong, your customers will hear.
              </p>
            </div>

            <Field
              label="Persona"
              hint="Instructions written TO the AI — its personality and its rules. This is what actually shapes every reply."
            >
              <textarea
                className="ag-input ag-textarea" rows={10} value={editing.persona || ""}
                onChange={(e) => setEditing({ ...editing, persona: e.target.value })}
              />
            </Field>

            <div className="ag-drawer-section"><Sparkles size={14} /> Capabilities</div>

            <Toggle label="Quick-reply buttons" on={editing.quick_replies_enabled}
              set={(v) => setEditing({ ...editing, quick_replies_enabled: v })} />
            <Toggle label="Appointment booking" on={editing.booking_enabled}
              set={(v) => setEditing({ ...editing, booking_enabled: v })} />

            {/* ── Opening hours ──
                Only shown when booking is on, because that is the only
                thing they change. Before this existed the agent had no
                clock at all: asked at 11:30pm, it accepted "today" and
                moved to book a midnight appointment. */}
            {editing.booking_enabled && (
              <BusinessHoursEditor
                value={editing.business_hours}
                fallbackContact={editing.fallback_contact}
                onChange={(hours) => setEditing({ ...editing, business_hours: hours })}
                onContactChange={(v) => setEditing({ ...editing, fallback_contact: v })}
              />
            )}

            <Toggle label="Media (images, PDFs, video)" on={editing.media_enabled}
              set={(v) => setEditing({ ...editing, media_enabled: v })} />
            <Toggle label="Lead-capture form" on={editing.lead_form_enabled}
              set={(v) => setEditing({ ...editing, lead_form_enabled: v })} />

            {editing.lead_form_enabled && (
              <Field label="Lead form mode">
                <select
                  className="ag-input" value={editing.lead_form_mode}
                  onChange={(e) => setEditing({ ...editing, lead_form_mode: e.target.value })}
                >
                  <option value="progressive">Progressive — chat first, ask later</option>
                  <option value="gate">Gate — form before chatting</option>
                </select>
              </Field>
            )}

            <Toggle label="Payment links" on={editing.payment_enabled}
              set={(v) => setEditing({ ...editing, payment_enabled: v })} />

            <div className="ag-drawer-section"><Bot size={14} /> Status</div>
            <Toggle label="Agent is live" on={editing.is_active}
              set={(v) => setEditing({ ...editing, is_active: v })} />

            <button className="ag-btn ag-btn-primary ag-btn-full ag-save" onClick={saveAgent} disabled={saving}>
              {saving ? <Loader2 size={15} className="ag-spin" /> : <Save size={15} />} Save agent
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── small pieces ────────────────────────── */

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="ag-field">
      <label>{label}</label>
      {children}
      {hint && <p className="ag-hint">{hint}</p>}
    </div>
  );
}

/* ── Opening hours editor ──────────────────────────────────────────────
   Writes the exact JSON shape src/lib/agent/business-hours.ts reads, so
   what the owner sets here is what the agent enforces when a customer
   asks for a time. The parser is deliberately forgiving, but this form
   should never need it to be.                                          */

/** Zones an Indian-first product actually sells into. */
const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Karachi", "Asia/Dhaka",
  "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC",
];

function BusinessHoursEditor({ value, fallbackContact, onChange, onContactChange }: {
  value: unknown;
  fallbackContact: string | null;
  onChange: (hours: BusinessHours) => void;
  onContactChange: (v: string) => void;
}) {
  // Parse once per render rather than holding a second copy in state:
  // the drawer's `editing` object is the single source of truth, so
  // there is nothing here to fall out of sync with it.
  const hours = useMemo(() => parseBusinessHours(value), [value]);

  function setDay(index: number, day: DayHours | null) {
    const days = [...hours.days];
    days[index] = day;
    onChange({ ...hours, days });
  }

  return (
    <div className="ag-hours">
      <div className="ag-drawer-section"><Clock size={14} /> Opening hours</div>
      <p className="ag-hint">
        The agent will not offer or accept a time outside these hours. Someone
        asking at 11pm to come &ldquo;today&rdquo; is told you&apos;re closed and
        offered your next real slot.
      </p>

      <Field label="Time zone">
        <select
          className="ag-input"
          value={hours.timezone}
          onChange={(e) => onChange({ ...hours, timezone: e.target.value })}
        >
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </Field>

      <div className="ag-hours-grid">
        {hours.days.map((day, i) => (
          <div className="ag-hours-row" key={i}>
            <button
              type="button"
              className={`ag-day-toggle ${day ? "on" : ""}`}
              onClick={() => setDay(i, day ? null : { open: "10:00", close: "19:00" })}
              aria-pressed={!!day}
            >
              {formatDayLabel(i).slice(0, 3)}
            </button>

            {day ? (
              <>
                <input
                  className="ag-input ag-time" type="time" value={day.open}
                  onChange={(e) => setDay(i, { ...day, open: e.target.value })}
                />
                <span className="ag-hours-dash">to</span>
                <input
                  className="ag-input ag-time" type="time" value={day.close}
                  onChange={(e) => setDay(i, { ...day, close: e.target.value })}
                />
              </>
            ) : (
              <span className="ag-hours-closed">Closed</span>
            )}
          </div>
        ))}
      </div>

      <div className="ag-hours-pair">
        <Field label="Appointment length" hint="Slots are placed on this grid.">
          <select
            className="ag-input"
            value={hours.slotMinutes}
            onChange={(e) => onChange({ ...hours, slotMinutes: Number(e.target.value) })}
          >
            {[15, 20, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>{m} minutes</option>
            ))}
          </select>
        </Field>

        <Field label="Shortest notice" hint="How soon a customer may book from now.">
          <select
            className="ag-input"
            value={hours.minLeadMinutes}
            onChange={(e) => onChange({ ...hours, minLeadMinutes: Number(e.target.value) })}
          >
            {[
              { v: 0, l: "No minimum" }, { v: 30, l: "30 minutes" },
              { v: 60, l: "1 hour" }, { v: 120, l: "2 hours" },
              { v: 240, l: "4 hours" }, { v: 1440, l: "1 day" },
            ].map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </Field>
      </div>

      <Field
        label="Fallback number"
        hint="Given to the customer only if a booking cannot be saved. Left blank, the agent promises a callback instead."
      >
        <input
          className="ag-input" type="tel" placeholder="+91 98188 16485"
          value={fallbackContact || ""}
          onChange={(e) => onContactChange(e.target.value)}
        />
      </Field>
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" className="ag-toggle-row" onClick={() => set(!on)} aria-pressed={on}>
      <span>{label}</span>
      <span className={`ag-toggle ${on ? "on" : ""}`}><span className="ag-knob" /></span>
    </button>
  );
}

/* ────────────────────────────── styles ──────────────────────────────
   Scoped under .ag so nothing here leaks into the rest of the app.
   The accent is a bright lime — high-energy, and it reads as "new" next
   to the product's established green. Black text on lime beats white:
   lime is a light colour, so white on it fails contrast badly.        */

const css = `
.ag{
  --lime:#a3e635;          /* primary accent — always with INK text on top */
  --lime-deep:#84cc16;     /* hover / pressed */
  --lime-soft:#f2fbe0;     /* tinted fills, chips */
  --ink:#0f1115;           /* near-black, slightly cool */
  --muted:#6b7280;
  --faint:#9aa1ab;
  --ground:#eff1f4;        /* cool light grey page ground */
  --surface:#ffffff;
  --line:#e4e7ec;
  --radius:18px;
  font-family:"Plus Jakarta Sans",system-ui,sans-serif;
  color:var(--ink);
  display:flex;flex-direction:column;gap:18px;padding-bottom:80px}
@media(min-width:1024px){.ag{padding-bottom:16px}}
.ag h1,.ag h2,.ag h3{font-family:"Sora","Plus Jakarta Sans",sans-serif;letter-spacing:-.03em;margin:0}
.ag-spin{animation:agSpin .8s linear infinite}
@keyframes agSpin{to{transform:rotate(360deg)}}
.ag-loading{display:flex;align-items:center;justify-content:center;gap:10px;height:220px;
  color:var(--muted);font-size:14px;font-weight:600}

/* header */
.ag-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px}
.ag-head-left{display:flex;align-items:center;gap:13px}
.ag-head-ic{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;
  background:var(--lime);color:var(--ink);flex-shrink:0}
.ag-head h1{font-size:20px;font-weight:800}
.ag-head p{font-size:13px;color:var(--muted);margin:3px 0 0;line-height:1.45}

/* buttons */
.ag-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:none;cursor:pointer;
  font-family:inherit;font-size:13px;font-weight:700;padding:11px 18px;border-radius:99px;transition:.16s;
  white-space:nowrap;text-decoration:none}
.ag-btn:disabled{opacity:.55;cursor:default;transform:none!important}
.ag-btn-primary{background:var(--lime);color:var(--ink)}
.ag-btn-primary:hover:not(:disabled){background:var(--lime-deep);transform:translateY(-1px)}
.ag-btn-sm{padding:8px 15px;font-size:12.5px}
.ag-btn-full{width:100%}
.ag-icon-btn{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;flex-shrink:0;
  border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;transition:.15s}
.ag-icon-btn:hover{background:var(--lime-soft);border-color:var(--lime);color:var(--ink)}

/* tabs */
.ag-tabs{display:inline-flex;gap:4px;padding:4px;background:var(--ground);border-radius:99px;width:max-content}
.ag-tab{border:none;background:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;
  color:var(--muted);padding:9px 17px;border-radius:99px;transition:.15s;display:inline-flex;align-items:center;gap:7px}
.ag-tab:hover{color:var(--ink)}
.ag-tab.on{background:var(--surface);color:var(--ink);box-shadow:0 1px 3px rgba(15,17,21,.08)}
.ag-count{font-size:11px;font-weight:800;background:var(--lime-soft);color:#4d7c0f;padding:1px 7px;border-radius:99px}
.ag-tab.on .ag-count{background:var(--lime);color:var(--ink)}

/* filters */
.ag-filters{display:flex;flex-direction:column;gap:11px}
.ag-search{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--line);
  border-radius:99px;padding:0 16px;max-width:340px;transition:.15s}
.ag-search:focus-within{border-color:var(--lime);box-shadow:0 0 0 3px rgba(163,230,53,.28)}
.ag-search svg{color:var(--faint);flex-shrink:0}
.ag-search input{border:none;outline:none;background:none;font-family:inherit;font-size:13.5px;
  padding:11px 0;width:100%;color:var(--ink)}
.ag-cats{display:flex;gap:7px;flex-wrap:wrap}
.ag-cat{border:1px solid var(--line);background:var(--surface);cursor:pointer;font-family:inherit;
  font-size:12.5px;font-weight:650;color:var(--muted);padding:7px 15px;border-radius:99px;transition:.15s}
.ag-cat:hover{border-color:var(--lime);color:var(--ink)}
.ag-cat.on{background:var(--lime);border-color:var(--lime);color:var(--ink);font-weight:750}

/* cards */
.ag-grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:680px){.ag-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1100px){.ag-grid{grid-template-columns:repeat(3,1fr)}}
.ag-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;
  display:flex;flex-direction:column;transition:.18s}
.ag-card:hover{border-color:#d3d9e0;box-shadow:0 10px 30px rgba(15,17,21,.07);transform:translateY(-2px)}
.ag-card-top{display:flex;gap:12px;align-items:flex-start}
.ag-ic{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;flex-shrink:0;
  background:var(--lime-soft);color:#4d7c0f}
.ag-ic-emoji{font-size:19px;background:var(--lime-soft)}
.ag-card-body{flex:1;min-width:0}
.ag-card-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ag-card h3{font-size:15px;font-weight:750}
.ag-card-meta{font-size:11.5px;color:var(--faint);margin:2px 0 0;text-transform:capitalize}
.ag-card-desc{font-size:12.5px;color:var(--muted);margin:4px 0 0;line-height:1.5}
.ag-pill{font-size:10px;font-weight:800;padding:3px 9px;border-radius:99px;white-space:nowrap}
.ag-pill.live{background:var(--lime);color:var(--ink)}
.ag-pill.off{background:var(--ground);color:var(--faint)}
.ag-chips{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 16px;flex:1;align-content:flex-start}
.ag-chip{font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:99px;
  background:var(--lime-soft);color:#4d7c0f;white-space:nowrap}
.ag-card-actions{display:flex;gap:7px;align-items:center}
.ag-card-actions .ag-btn{flex:1}

/* empty state */
.ag-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:52px 20px;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
.ag-empty-ic{display:grid;place-items:center;width:56px;height:56px;border-radius:17px;
  background:var(--lime-soft);color:#4d7c0f;margin-bottom:4px}
.ag-empty h3{font-size:16px;font-weight:750}
.ag-empty p{font-size:13px;color:var(--muted);max-width:330px;line-height:1.55;margin:0 0 10px}

/* drawer */
.ag-overlay{position:fixed;inset:0;z-index:50;background:rgba(15,17,21,.4);display:flex;justify-content:flex-end;
  backdrop-filter:blur(2px)}
.ag-drawer{width:100%;max-width:440px;height:100%;overflow-y:auto;background:var(--surface);padding:22px;
  box-shadow:-14px 0 44px rgba(15,17,21,.18)}
.ag-drawer-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.ag-drawer-head h2{font-size:17px;font-weight:800}
.ag-drawer-section{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:.06em;
  text-transform:uppercase;color:var(--faint);margin:22px 0 8px}
.ag-drawer-section svg{color:var(--lime-deep)}
.ag-field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.ag-field label{font-size:12.5px;font-weight:700;color:#374151}
.ag-input{width:100%;border:1.5px solid var(--line);border-radius:12px;background:var(--surface);
  padding:11px 13px;font-family:inherit;font-size:13.5px;color:var(--ink);outline:none;transition:.15s}
.ag-input:focus{border-color:var(--lime-deep);box-shadow:0 0 0 3px rgba(163,230,53,.3)}
.ag-textarea{resize:vertical;line-height:1.55;min-height:150px}
.ag-hint{font-size:11px;color:var(--faint);margin:0;line-height:1.45}
.ag-toggle-row{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;
  border:none;border-bottom:1px solid #f2f4f6;padding:12px 0;cursor:pointer;font-family:inherit;
  font-size:13.5px;color:var(--ink);text-align:left}
.ag-toggle{position:relative;width:40px;height:23px;border-radius:99px;background:#d5dae0;transition:.2s;flex-shrink:0}
.ag-toggle.on{background:var(--lime-deep)}
.ag-knob{position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:50%;background:#fff;
  transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.22)}
.ag-toggle.on .ag-knob{left:20px}
.ag-channel{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 20px}
.ag-channel-left{display:flex;align-items:center;gap:12px;min-width:0}
.ag-channel-ic{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;flex-shrink:0;
  background:#e7f8ef;color:#075E54}
.ag-channel h2{font-size:15px;font-weight:750}
.ag-channel p{font-size:12.5px;color:var(--muted);margin:2px 0 0;line-height:1.45;max-width:60ch}
.ag-channel-pick{display:flex;align-items:center;gap:9px}
.ag-channel-pick .ag-input{min-width:210px}
.ag-dim{color:var(--faint)}
.ag-train{display:flex;flex-direction:column;gap:9px;padding:14px;border:1px solid var(--line);
  border-radius:14px;background:var(--lime-soft);margin-bottom:16px}
.ag-train-lead{font-size:12px;color:#4b5563;margin:0;line-height:1.5}
.ag-train-row{display:flex;gap:8px}
.ag-train-row .ag-input{flex:1;background:var(--surface)}
.ag-train-row .ag-btn{flex-shrink:0}
.ag-train-done{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#3f6212;margin:0;font-weight:600}
.ag-train-done svg{flex-shrink:0}
.ag-train .ag-hint{color:#6b7280}

/* opening hours */
.ag-hours{background:var(--ground);border:1px solid var(--line);border-radius:14px;
  padding:4px 14px 14px;margin:10px 0 16px}
.ag-hours .ag-drawer-section{margin-top:14px}
.ag-hours .ag-input{background:var(--surface)}
.ag-hours-grid{display:flex;flex-direction:column;gap:7px;margin:12px 0 16px}
.ag-hours-row{display:flex;align-items:center;gap:8px}
.ag-day-toggle{flex-shrink:0;width:52px;border:1.5px solid var(--line);background:var(--surface);
  color:var(--faint);font-family:inherit;font-size:11.5px;font-weight:800;letter-spacing:.02em;
  padding:9px 0;border-radius:10px;cursor:pointer;transition:.15s}
.ag-day-toggle:hover{border-color:var(--lime-deep)}
.ag-day-toggle.on{background:var(--lime);border-color:var(--lime);color:var(--ink)}
.ag-time{flex:1;min-width:0;padding:9px 10px;font-size:13px}
.ag-hours-dash{font-size:11.5px;color:var(--faint);font-weight:600;flex-shrink:0}
.ag-hours-closed{flex:1;font-size:12.5px;color:var(--faint);font-weight:600;font-style:italic}
.ag-hours-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:420px){.ag-hours-pair{grid-template-columns:1fr}}

.ag-save{margin-top:24px}

@media(prefers-reduced-motion:reduce){.ag *{transition:none!important;animation:none!important}}
`;
