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
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Bot, Loader2, Save, Plus, Image as ImageIcon, Brain, X, Sparkles,
  Search, Check, Copy, Globe, MessageCircle, Clock, AlertCircle,
} from "lucide-react";
import { useBusiness } from "@/hooks/use-business";
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
import {
  SiteReviewPanel,
  type SiteReviewData,
  type AppliedFields,
} from "@/components/agents/site-review-panel";

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
  // ── Migration 027: the agent's public face ──
  // The first message a visitor reads and the chips they can tap
  // before typing. Null on every row until a site is crawled.
  greeting: string | null;
  suggested_questions: string[] | null;
  role: string | null;
  avatar_url: string | null;
}

/** Values the engine understands for `agents.agent_type`. */
const TYPES = ["sales", "marketing", "creative", "social", "support", "realestate", "other"];

export default function AgentsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  // Both halves are needed here, not just the id: "still resolving" and
  // "this account has no business" look identical from the id alone,
  // and they need opposite handling — wait vs. show an empty list.
  const { businessId, loading: businessLoading } = useBusiness();
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

  // agent id → number of media items it owns. Drives the warning that
  // explains why an agent is refusing to send images.
  const [mediaCounts, setMediaCounts] = useState<Record<string, number>>({});

  // "Train from your website" — the URL box in the drawer, plus what
  // came back from the last run so we can show the user what happened.
  const [trainUrl, setTrainUrl] = useState("");
  const [training, setTraining] = useState(false);
  // The full crawl result, so the review panel can show the name, logo,
  // greeting and questions the route already returns. The old state held
  // only { title, chunks } and everything else was discarded.
  const [siteReview, setSiteReview] = useState<SiteReviewData | null>(null);
  const [trainResult, setTrainResult] = useState<
    { title: string; chunks: number } | null
  >(null);

  // The logo field in the drawer. `logoBroken` is what turns a blank
  // square into an explanation — a crawled URL that 403s to visitors
  // looks identical to no logo at all until something says otherwise.
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  // ── A crawl belongs to the agent it was run for ──────────────────
  //
  // All three values above describe ONE agent's training run. The
  // drawer, however, is a single component reused for every agent, and
  // six different places open or close it. Clearing them at each of
  // those call sites worked until one was missed — and the one that was
  // missed left a finished crawl on screen while a different agent was
  // opened. A fashion shop's drawer showed a surgery clinic's name,
  // logo and questions, one click from being applied to the wrong
  // agent. Exactly what the screenshots showed.
  //
  // Tying the reset to the agent's identity instead makes that class of
  // bug unrepresentable: whichever code path swaps the agent, the crawl
  // state cannot survive the swap. Closing the drawer (id undefined)
  // clears it too, so reopening never resurrects a stale panel.
  useEffect(() => {
    setSiteReview(null);
    setTrainResult(null);
    setTrainUrl("");
    // Also per-agent: a broken logo on one agent must not mark the next
    // one's working logo as broken before it has even tried to load.
    setLogoBroken(false);
  }, [editing?.id]);

  /* ── load ─────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // Do not query until the business is known. An unscoped read here
    // would paint every business's agents and then swap them out — and
    // on a slow connection people read the first version.
    if (businessLoading) return;
    if (!businessId) { setAgents([]); setLoading(false); return; }

    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("tenant_id", user.id)
      .eq("business_id", businessId)
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

    // How many media items each agent owns.
    //
    // This exists to close a silent failure: the agent only gets the
    // send_media tool when the toggle is ON *and* the agent has media.
    // Miss either half and it tells customers "I can't share images" —
    // with nothing anywhere on this page explaining why. Counting them
    // here lets the drawer say which half is missing.
    const { data: mediaRows } = await supabase
      .from("agent_media")
      .select("agent_id")
      .eq("tenant_id", user.id)
      .eq("business_id", businessId);

    const counts: Record<string, number> = {};
    for (const row of mediaRows || []) {
      counts[row.agent_id] = (counts[row.agent_id] ?? 0) + 1;
    }
    setMediaCounts(counts);

    // Returning users go straight to their own agents.
    if (rows.length > 0) setTab("mine");
    setLoading(false);
    // businessId in the deps is what makes the switcher work: changing
    // business re-runs this and repaints the page with that business's
    // agents.
  }, [supabase, businessId, businessLoading]);

  useEffect(() => { load(); }, [load]);

  /* ── actions ──────────────────────────────────────────────────── */

  /** Save the drawer's edits back to the row. */
  /**
   * Upload a logo for this agent and point it at the stored copy.
   *
   * ── WHY UPLOADING IS NOT OPTIONAL POLISH ──────────────────────────
   * Until now the only way an agent got a logo was the crawler finding
   * one, and it frequently cannot: plenty of sites have no og:image,
   * the crawler then falls back to /favicon.ico which is 32px and looks
   * terrible enlarged into a chat header, and many hosts block
   * hot-linking outright so the URL resolves for us and 403s for the
   * visitor. Every one of those ends the same way — a generic speech
   * bubble where the business's mark should be, on a widget that is
   * meant to look like it belongs to that business.
   *
   * Re-hosting also fixes the quieter half. A crawled URL points at
   * someone else's server, so the logo breaks whenever they reorganise
   * their site. A copy in our own bucket keeps working.
   *
   * The `avatars` bucket already exists (migration 008) and its RLS
   * policy requires the first path segment to be the uploader's user
   * id, which is why the path starts with userId and not agent id.
   */
  async function uploadLogo(file: File) {
    if (!editing || !userId) return;

    // Checked here as well as by the bucket, because a bucket rejection
    // arrives as an opaque storage error while these can say which rule
    // was broken and what to do about it.
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) {
      toast.error("Use a PNG, JPG, WebP, GIF or SVG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.`);
      return;
    }

    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      // Timestamped rather than overwritten: a stable filename would be
      // served from cache long after the change, and the merchant would
      // conclude the upload silently failed.
      const path = `${userId}/agent-${editing.id}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (upErr) { toast.error(`Upload failed: ${upErr.message}`); return; }

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

      setEditing((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
      setLogoBroken(false);
      toast.success("Logo uploaded — press Save agent to keep it");
    } finally {
      setLogoUploading(false);
    }
  }

  /**
   * Push the agent's identity onto the row the widget actually reads.
   *
   * ── WHY THIS IS NEEDED AT ALL ─────────────────────────────────────
   * An agent's identity lives in two places. This drawer writes to
   * `agents`; the widget on the customer's site reads `widget_configs`.
   * Nothing connected them, so renaming an agent and retraining it on a
   * new website changed everything except what visitors actually see.
   * A real-estate agent was retrained from skyline to sobha.com and
   * renamed — and its widget carried on introducing itself as Aarav
   * from Skyline Properties, because that string lives on the other row.
   *
   * ── WHY IT ONLY OVERWRITES WHAT WAS FOLLOWING THE AGENT ───────────
   * The widget row can also hold wording the merchant wrote by hand on
   * the /widget page. "Kalosa Assistant" is friendlier than the legal
   * name the crawl found ("Kalosa Aesthetics & Cosmetic Gynaecology"),
   * and blowing it away on every save would be its own bug report.
   *
   * So a field is updated only when it was blank, or when it still held
   * the agent's PREVIOUS value — meaning it was mirroring the agent and
   * should keep mirroring it. A field that differs was chosen
   * deliberately and is left alone.
   */
  async function syncWidgetIdentity(previous: Agent | undefined) {
    if (!editing) return;

    const { data: cfg } = await supabase
      .from("widget_configs")
      .select("id, bot_name, welcome_message, avatar_url")
      .eq("agent_id", editing.id)
      .eq("org_user_id", userId)
      .maybeSingle();

    // No row of its own: the config API merges the agent's identity in
    // at read time instead, so there is nothing to keep in step here.
    if (!cfg) return;

    /** Was this field blank, or still showing what the agent used to say? */
    const wasFollowing = (current: unknown, before: string | null | undefined) => {
      const now = typeof current === "string" ? current.trim() : "";
      return !now || now === (before ?? "").trim();
    };

    const patch: Record<string, unknown> = {};

    const name = editing.name?.trim();
    if (name && wasFollowing(cfg.bot_name, previous?.name)) patch.bot_name = name;

    const greeting = editing.greeting?.trim();
    if (greeting && wasFollowing(cfg.welcome_message, previous?.greeting)) {
      patch.welcome_message = greeting;
    }

    const avatar = editing.avatar_url?.trim();
    if (avatar && wasFollowing(cfg.avatar_url, previous?.avatar_url)) {
      patch.avatar_url = avatar;
    }

    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase.from("widget_configs").update(patch).eq("id", cfg.id);
    // Non-fatal: the agent itself saved. Say so rather than claiming a
    // clean save while the widget quietly keeps the old name.
    if (error) toast.error(`Agent saved, but the widget kept its old name: ${error.message}`);
  }

  async function saveAgent() {
    if (!editing) return;
    // Captured before load() replaces it — this is what the widget row
    // is compared against to decide whether it was following the agent.
    const previous = agents.find((a) => a.id === editing.id);
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
          // Migration 027. Empty arrays are stored as null so "no
          // questions set" is one value, not two.
          greeting: editing.greeting?.trim() || null,
          suggested_questions: editing.suggested_questions?.length
            ? editing.suggested_questions
            : null,
          role: editing.role?.trim() || null,
          avatar_url: editing.avatar_url?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await syncWidgetIdentity(previous);
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
        .insert({ ...agentRowFromTemplate(template, userId), business_id: businessId })
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
          business_id: businessId,
          name: "New Agent",
          agent_type: "sales",
          persona: "You are a helpful assistant. Be warm and concise.",
          quick_replies_enabled: true,
          // A blank agent used to be created with only quick replies,
          // so it could neither share an image nor ask for a phone
          // number — and said so to customers. Nothing about "blank"
          // should mean "less capable than every template".
          media_enabled: true,
          lead_form_enabled: true,
          lead_form_mode: "progressive",
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

      // Keep everything the route returned. The name, logo, greeting and
      // suggested questions were always in this response — the drawer
      // simply dropped them, which is why pasting a URL felt like it did
      // nothing but fill a text box.
      if (data.brand || data.facts) {
        setSiteReview({
          brand: data.brand ?? { name: null, logoUrl: null, description: null, themeColor: null },
          facts: data.facts ?? {
            business_name: null, what_they_do: null, services: [],
            phone: null, whatsapp: null, email: null, address: null, hours: null,
            role: null, greeting: null, suggested_questions: [],
          },
          pages: data.pages ?? [],
          skipped: data.skipped ?? [],
          truncated: Boolean(data.truncated),
          chunks: data.chunks ?? 0,
          title: data.title ?? "",
        });
      }

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
   * Copy chosen fields from the crawl into the agent being edited.
   *
   * Into local state only — nothing reaches the database until Save
   * agent. Same reasoning as the persona: the name and logo come from
   * the site's own metadata, but the greeting and questions were
   * written by a model, and a model describing a business it read for
   * ten seconds will occasionally get it wrong in a way only the owner
   * can see.
   */
  function applySiteFields(fields: AppliedFields) {
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...(fields.name !== undefined ? { name: fields.name } : {}),
        ...(fields.role !== undefined ? { role: fields.role } : {}),
        ...(fields.greeting !== undefined ? { greeting: fields.greeting } : {}),
        ...(fields.avatarUrl !== undefined ? { avatar_url: fields.avatarUrl } : {}),
        ...(fields.suggestedQuestions !== undefined
          ? { suggested_questions: fields.suggestedQuestions }
          : {}),
      };
    });
    toast.success("Added — press Save agent to keep it");
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

  /** Delete an agent and all its associated data. */
  async function deleteAgent(agent: Agent) {
    if (!confirm(`Delete "${agent.name}"? This will remove all associated data including conversations and knowledge.`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from("agents")
        .delete()
        .eq("id", agent.id)
        .eq("tenant_id", userId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Agent "${agent.name}" deleted`);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete agent");
    }
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
                    onClick={() => setEditing(agent)}
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

            {/* ── Logo ──
                Shown as a preview beside its controls rather than as a
                bare URL box, because the only question that matters here
                is "does this actually render?" — and a URL cannot answer
                it. A crawled logo that 403s to visitors looks perfectly
                valid as text. */}
            <Field
              label="Logo"
              hint="Shown in the chat header. Upload one if training could not find your logo, or if the one it found looks wrong."
            >
              <div className="ag-logo-row">
                <div className="ag-logo-preview">
                  {editing.avatar_url && !logoBroken ? (
                    // Not next/image: an arbitrary third-party URL that
                    // is not in remotePatterns, and it has to be allowed
                    // to fail without taking the drawer down.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={editing.avatar_url}
                      alt=""
                      onError={() => setLogoBroken(true)}
                      onLoad={() => setLogoBroken(false)}
                    />
                  ) : (
                    <Bot size={20} />
                  )}
                </div>

                <div className="ag-logo-controls">
                  <label className="ag-btn ag-btn-sm ag-logo-upload">
                    {logoUploading ? <Loader2 size={14} className="ag-spin" /> : <ImageIcon size={14} />}
                    {logoUploading ? "Uploading…" : "Upload logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      disabled={logoUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        // Cleared so picking the same file twice still
                        // fires a change event — otherwise a retry after
                        // a failed upload does nothing at all.
                        e.target.value = "";
                        if (file) uploadLogo(file);
                      }}
                    />
                  </label>

                  {editing.avatar_url && (
                    <button
                      type="button"
                      className="ag-btn ag-btn-sm ag-logo-clear"
                      onClick={() => {
                        setEditing({ ...editing, avatar_url: null });
                        setLogoBroken(false);
                      }}
                    >
                      <X size={14} /> Remove
                    </button>
                  )}
                </div>
              </div>

              <input
                className="ag-input ag-logo-url"
                placeholder="…or paste an image address"
                value={editing.avatar_url || ""}
                onChange={(e) => {
                  setLogoBroken(false);
                  setEditing({ ...editing, avatar_url: e.target.value });
                }}
              />

              {logoBroken && (
                <p className="ag-logo-warn">
                  <AlertCircle size={12} /> That image didn&rsquo;t load. Some
                  sites block other sites from showing their images — uploading
                  the file fixes that.
                </p>
              )}
              {!logoBroken && /favicon\.ico$/i.test(editing.avatar_url || "") && (
                <p className="ag-logo-warn">
                  <AlertCircle size={12} /> This is the site favicon, usually
                  32px. It will look blurry enlarged — upload a proper logo.
                </p>
              )}
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
                Paste your website address. We read it and the pages it links to,
                save them as knowledge the agent can quote, and draft its name,
                greeting and opening questions for you to review.
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

            {/* Everything the crawl found, offered one field at a time.
                Sits below the URL box and above Persona so the review
                happens before the field it overwrites. */}
            {siteReview && (
              <SiteReviewPanel
                data={siteReview}
                onApply={applySiteFields}
                onDismiss={() => setSiteReview(null)}
              />
            )}

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

            {/* ── Why the agent is refusing to send images ──
                Sending needs BOTH the toggle and at least one uploaded
                file. Miss either and the agent answers "I can't share
                images" — true, but baffling if you have just uploaded
                twenty photos. This says which half is missing. */}
            <MediaNotice
              enabled={editing.media_enabled}
              count={mediaCounts[editing.id] ?? 0}
            />
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

            <button className="ag-btn ag-btn-danger ag-btn-full" onClick={() => deleteAgent(editing)} title="Delete this agent">
              <X size={15} /> Delete agent
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

/**
 * Explains, in the drawer, why an agent will or won't send images.
 *
 * The engine gives an agent the send_media tool only when the toggle is
 * on AND the agent owns at least one media item. Both halves are edited
 * on different pages, so it is easy to do one and assume you are done —
 * and the only symptom is the agent politely telling customers it can't
 * share anything.
 */
function MediaNotice({ enabled, count }: { enabled: boolean; count: number }) {
  if (enabled && count === 0) {
    return (
      <p className="ag-notice warn">
        <AlertCircle size={13} />
        <span>
          Media is on, but this agent has no files yet — it will still tell
          customers it can&apos;t share images. Upload them on the{" "}
          <Link href="/media">Media page</Link> with this agent selected.
        </span>
      </p>
    );
  }

  if (!enabled && count > 0) {
    return (
      <p className="ag-notice warn">
        <AlertCircle size={13} />
        <span>
          This agent has {count} file{count === 1 ? "" : "s"} ready, but media is
          switched off — so it will refuse every request for a photo or
          brochure. Turn it on above.
        </span>
      </p>
    );
  }

  if (enabled && count > 0) {
    return (
      <p className="ag-notice ok">
        <Check size={13} />
        <span>
          {count} file{count === 1 ? "" : "s"} available. The agent can send
          {count === 1 ? " it" : " them"} when a customer asks.
        </span>
      </p>
    );
  }

  return null;
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
   The accent is the same dark WhatsApp teal (#075E54) already used a
   few rules down for .ag-channel-ic, now promoted to the page's
   primary accent instead of the bright lime it used to be. Because
   the accent went from light to dark, every place that filled a solid
   background with it now uses white text on top instead of dark ink
   — kept the variable NAMES ("--lime") to avoid a page-wide rename,
   only the values (and the text-color pairing) changed.             */

const css = `
.ag{
  --lime:#075E54;          /* primary accent — solid fills use WHITE text on top */
  --lime-deep:#054942;     /* hover / pressed */
  --lime-soft:#e7f8ef;     /* tinted fills, chips — stays light, dark text on top */
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
  background:var(--lime);color:#fff;flex-shrink:0}
.ag-head h1{font-size:20px;font-weight:800}
.ag-head p{font-size:13px;color:var(--muted);margin:3px 0 0;line-height:1.45}

/* buttons */
.ag-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:none;cursor:pointer;
  font-family:inherit;font-size:13px;font-weight:700;padding:11px 18px;border-radius:99px;transition:.16s;
  white-space:nowrap;text-decoration:none}
.ag-btn:disabled{opacity:.55;cursor:default;transform:none!important}
.ag-btn-primary{background:var(--lime);color:#fff}
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
.ag-count{font-size:11px;font-weight:800;background:var(--lime-soft);color:#075E54;padding:1px 7px;border-radius:99px}
.ag-tab.on .ag-count{background:var(--lime);color:#fff}

/* filters */
.ag-filters{display:flex;flex-direction:column;gap:11px}
.ag-search{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--line);
  border-radius:99px;padding:0 16px;max-width:340px;transition:.15s}
.ag-search:focus-within{border-color:var(--lime);box-shadow:0 0 0 3px rgba(7,94,84,.22)}
.ag-search svg{color:var(--faint);flex-shrink:0}
.ag-search input{border:none;outline:none;background:none;font-family:inherit;font-size:13.5px;
  padding:11px 0;width:100%;color:var(--ink)}
.ag-cats{display:flex;gap:7px;flex-wrap:wrap}
.ag-cat{border:1px solid var(--line);background:var(--surface);cursor:pointer;font-family:inherit;
  font-size:12.5px;font-weight:650;color:var(--muted);padding:7px 15px;border-radius:99px;transition:.15s}
.ag-cat:hover{border-color:var(--lime);color:var(--ink)}
.ag-cat.on{background:var(--lime);border-color:var(--lime);color:#fff;font-weight:750}

/* cards */
.ag-grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:680px){.ag-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1100px){.ag-grid{grid-template-columns:repeat(3,1fr)}}
.ag-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;
  display:flex;flex-direction:column;transition:.18s}
.ag-card:hover{border-color:#d3d9e0;box-shadow:0 10px 30px rgba(15,17,21,.07);transform:translateY(-2px)}
.ag-card-top{display:flex;gap:12px;align-items:flex-start}
.ag-ic{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;flex-shrink:0;
  background:var(--lime-soft);color:#075E54}
.ag-ic-emoji{font-size:19px;background:var(--lime-soft)}
.ag-card-body{flex:1;min-width:0}
.ag-card-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ag-card h3{font-size:15px;font-weight:750}
.ag-card-meta{font-size:11.5px;color:var(--faint);margin:2px 0 0;text-transform:capitalize}
.ag-card-desc{font-size:12.5px;color:var(--muted);margin:4px 0 0;line-height:1.5}
.ag-pill{font-size:10px;font-weight:800;padding:3px 9px;border-radius:99px;white-space:nowrap}
.ag-pill.live{background:var(--lime);color:#fff}
.ag-pill.off{background:var(--ground);color:var(--faint)}
.ag-chips{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 16px;flex:1;align-content:flex-start}
.ag-chip{font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:99px;
  background:var(--lime-soft);color:#075E54;white-space:nowrap}
.ag-card-actions{display:flex;gap:7px;align-items:center}
.ag-card-actions .ag-btn{flex:1}

/* empty state */
.ag-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:52px 20px;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
.ag-empty-ic{display:grid;place-items:center;width:56px;height:56px;border-radius:17px;
  background:var(--lime-soft);color:#075E54;margin-bottom:4px}
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
.ag-input:focus{border-color:var(--lime-deep);box-shadow:0 0 0 3px rgba(7,94,84,.22)}
.ag-textarea{resize:vertical;line-height:1.55;min-height:150px}
.ag-hint{font-size:11px;color:var(--faint);margin:0;line-height:1.45}

/* ── Logo field ──
   The preview is deliberately the same 44px circle the widget header
   uses, so what the merchant approves here is what a visitor sees
   rather than an idealised large version of it. */
.ag-logo-row{display:flex;align-items:center;gap:12px}
.ag-logo-preview{width:44px;height:44px;border-radius:50%;flex-shrink:0;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
  background:var(--lime-soft,#f1f8e4);color:var(--lime-deep);border:1.5px solid var(--line)}
.ag-logo-preview img{width:100%;height:100%;object-fit:cover;display:block}
.ag-logo-controls{display:flex;gap:8px;flex-wrap:wrap}
/* The file input is the label: a bare <input type=file> cannot be
   styled to match the other buttons in this drawer. */
.ag-logo-upload{cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.ag-logo-upload input{display:none}
.ag-logo-clear{display:inline-flex;align-items:center;gap:6px;color:#b91c1c;border-color:#fecaca}
.ag-logo-clear:hover{background:#fef2f2}
.ag-logo-url{margin-top:8px;font-size:12.5px}
.ag-logo-warn{display:flex;align-items:flex-start;gap:5px;margin:6px 0 0;
  font-size:11px;line-height:1.45;color:#b45309}
.ag-logo-warn svg{flex-shrink:0;margin-top:1px}
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
.ag-train-done{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#075E54;margin:0;font-weight:600}
.ag-train-done svg{flex-shrink:0}
.ag-train .ag-hint{color:#6b7280}

/* ── site review panel — what the crawl found, offered for approval ──
   Deliberately quieter than the lime training box above it: that box is
   an action, this is a result, and two loud panels stacked would make
   neither read as important. */
.srp{border:1px solid var(--line);border-radius:14px;background:var(--surface);
  margin:-4px 0 16px;overflow:hidden}
.srp-head{display:flex;align-items:center;gap:7px;padding:11px 13px;
  border-bottom:1px solid var(--line);background:#fafbfc;font-size:12.5px}
.srp-head strong{font-weight:750}
.srp-head svg{color:var(--lime-deep);flex-shrink:0}
.srp-count{margin-left:auto;font-size:11px;color:var(--faint);font-weight:600}
.srp-dismiss{background:none;border:0;font-size:19px;line-height:1;color:var(--faint);
  cursor:pointer;padding:0 0 0 8px}
.srp-dismiss:hover{color:var(--ink)}

.srp-identity{display:flex;gap:11px;align-items:flex-start;padding:13px;
  border-bottom:1px solid var(--line)}
.srp-logo{width:42px;height:42px;border-radius:11px;object-fit:cover;flex-shrink:0;
  border:1px solid var(--line);background:#fff}
.srp-logo-empty{display:grid;place-items:center;color:var(--faint);background:var(--ground)}
.srp-identity-text{min-width:0}
.srp-name{font-size:14px;font-weight:750;line-height:1.3}
.srp-role{font-size:12px;color:var(--lime-deep);font-weight:650;margin-top:1px}
.srp-desc{font-size:11.5px;color:var(--muted);line-height:1.5;margin-top:4px}

.srp-row{display:flex;align-items:center;gap:10px;padding:9px 13px;
  border-bottom:1px solid #f1f3f5;font-size:12px}
.srp-row-block{display:block}
.srp-row-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.srp-label{color:var(--muted);flex-shrink:0;min-width:112px;font-weight:600}
.srp-value{flex:1;min-width:0;display:flex;align-items:center;gap:6px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.srp-swatch{width:13px;height:13px;border-radius:4px;border:1px solid var(--line);flex-shrink:0}

.srp-btn{flex-shrink:0;border:1px solid var(--line);background:var(--surface);
  border-radius:8px;padding:4px 11px;font-size:11px;font-weight:700;cursor:pointer;
  color:var(--ink);font-family:inherit}
.srp-btn:hover{background:var(--lime-soft);border-color:#cdeee5}
.srp-btn-done{display:inline-flex;align-items:center;gap:4px;color:#075E54;
  background:var(--lime-soft);border-color:#cdeee5;cursor:default}

.srp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.srp-chip{font-size:11.5px;padding:5px 11px;border-radius:999px;
  background:var(--lime-soft);border:1px solid #cdeee5;color:#075E54;font-weight:600}

.srp-facts{padding:11px 13px;border-bottom:1px solid var(--line);
  display:flex;flex-direction:column;gap:6px;background:#fafbfc}
.srp-fact{display:flex;gap:10px;font-size:11.5px;line-height:1.5}
.srp-fact-label{color:var(--muted);min-width:112px;flex-shrink:0;font-weight:600}
.srp-fact-value{color:var(--ink);min-width:0}

.srp-warn{display:flex;align-items:flex-start;gap:7px;font-size:11.5px;line-height:1.5;
  padding:9px 13px;background:#fffbeb;color:#92400e;border-bottom:1px solid #fde68a}
.srp-warn svg{flex-shrink:0;margin-top:2px}

.srp-actions{display:flex;align-items:center;gap:12px;padding:11px 13px}
.srp-apply-all{border:0;background:var(--ink);color:#fff;border-radius:9px;
  padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.srp-apply-all:hover{background:#000}
.srp-link{background:none;border:0;color:var(--muted);font-size:11.5px;cursor:pointer;
  text-decoration:underline;font-family:inherit;padding:0}

.srp-pages{list-style:none;margin:0;padding:0 13px 11px;display:flex;
  flex-direction:column;gap:5px;max-height:190px;overflow-y:auto}
.srp-pages li{display:flex;gap:10px;font-size:11px;line-height:1.4}
.srp-page-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.srp-page-meta{color:var(--faint);flex-shrink:0}
.srp-page-skipped .srp-page-title{color:var(--faint)}

.srp-note{font-size:11px;color:var(--muted);line-height:1.55;margin:0;
  padding:11px 13px;border-top:1px solid var(--line);background:#fafbfc}

@media(max-width:560px){
  .srp-row{flex-wrap:wrap}
  .srp-label{min-width:0;width:100%}
  .srp-fact-label{min-width:84px}
}

/* capability notices — why an agent will or won't do something */
.ag-notice{display:flex;align-items:flex-start;gap:7px;font-size:11.5px;line-height:1.5;
  margin:-2px 0 14px;padding:9px 11px;border-radius:10px;border:1px solid transparent}
.ag-notice svg{flex-shrink:0;margin-top:1px}
.ag-notice.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
.ag-notice.ok{background:var(--lime-soft);border-color:#cdeee5;color:#075E54}
.ag-notice a{color:inherit;font-weight:700;text-decoration:underline}

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
.ag-day-toggle.on{background:var(--lime);border-color:var(--lime);color:#fff}
.ag-time{flex:1;min-width:0;padding:9px 10px;font-size:13px}
.ag-hours-dash{font-size:11.5px;color:var(--faint);font-weight:600;flex-shrink:0}
.ag-hours-closed{flex:1;font-size:12.5px;color:var(--faint);font-weight:600;font-style:italic}
.ag-hours-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:420px){.ag-hours-pair{grid-template-columns:1fr}}

.ag-save{margin-top:24px}

@media(prefers-reduced-motion:reduce){.ag *{transition:none!important;animation:none!important}}
`;
