"use client";

// src/app/(dashboard)/leads/sources/page.tsx
//
// ────────────────────────────────────────────────────────────────────────────
// Lead Sources — Design System v2 (rebuilt 2026-10-11)
// ────────────────────────────────────────────────────────────────────────────
// Where a merchant connects every door leads come through. The goal: a
// non-technical client never sees an API key unless they chose a
// developer-style source.
//
//   • Meta Lead Ads        → one button, Facebook login, done.
//   • Click-to-WhatsApp    → nothing to set up; already automatic.
//   • Website form / Google Ads → script tag + secret key for Zapier/Make.
//
// LAYOUT CONTRACT (matches the Design System v2 preview artifact)
// ---------------------------------------------------------------
//   [PageHead] title + sub (no actions)
//   [LeadsTabs] sub-nav
//   [Banner]   (conditional) Facebook OAuth result message
//   [Panel]    Meta Lead Ads — Connect with Facebook + help accordion + list
//   [Panel]    Click-to-WhatsApp — automatic, nothing to configure
//   [Panel]    Website form / Google Ads — create form + list of script keys
//
// All colours, fonts, radii, shadows reference globals.css tokens.
// Business logic (fetch, create, delete, OAuth param handling, clipboard)
// preserved verbatim from the previous version.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Copy,
  Check,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Globe,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { LeadsTabs } from "@/components/leads/leads-tabs";

// ── Shared design-system components ──
import { PageHead } from "@/components/ui/page-head";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";

interface LeadSource {
  id: string;
  name: string;
  source_type: string;
  api_key: string;
  public_key: string | null;
  allowed_domains: string[] | null;
  clicks_30d?: { call_click: number; whatsapp_click: number };
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  meta_page_id: string | null;
}

const KEY_SOURCE_TYPES = [
  { value: "website_form", label: "Website form" },
  { value: "google_ads", label: "Google Ads lead form" },
  { value: "other", label: "Other (Zapier / Make / custom)" },
];

const META_ERRORS: Record<string, string> = {
  not_configured:
    "Meta connection isn't switched on for this server yet (META_APP_ID / META_APP_SECRET are not set).",
  cancelled:
    "Facebook connection was cancelled. Press Connect to try again.",
  invalid_state:
    "That connection attempt took longer than 10 minutes and expired. Please press Connect again and finish quickly.",
  no_code:
    "Facebook returned without an authorisation code. If your Meta app uses Facebook Login for Business, set META_LOGIN_CONFIG_ID (a Configuration with the lead permissions) and redeploy.",
  wrong_user:
    "You were signed in to a different account when you came back from Facebook. Sign in again and press Connect.",
  bad_state:
    "The connection could not be verified (state mismatch). Check META_APP_SECRET is the same on this deployment, then press Connect again.",
  no_pages:
    "No Facebook Pages were shared. In the Facebook dialog, tick the Page that runs your lead ads.",
  subscribe_failed:
    "Meta wouldn't let us subscribe to that Page's leads. You need to be an admin of the Page with lead access.",
  exchange_failed: "Facebook sign-in failed.",
};

export default function LeadSourcesPage() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("website_form");
  const [domain, setDomain] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lead-sources", { cache: "no-store" });
      const json = await res.json();
      setSources(json.lead_sources ?? []);
    } catch {
      toast.error("Could not load lead sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Result of the Facebook round trip arrives as query params. Read from
    // window rather than useSearchParams to avoid a Suspense boundary.
    const p = new URLSearchParams(window.location.search);
    const meta = p.get("meta");
    if (meta === "connected") {
      const n = Number(p.get("count") || 1);
      setBanner({
        ok: true,
        text: `Connected ${n} Facebook Page${n === 1 ? "" : "s"}. New leads will appear in All leads automatically.`,
      });
    } else if (meta === "error") {
      const reason = p.get("reason") || "";
      const extra = p.get("page") || p.get("detail");
      setBanner({
        ok: false,
        text: `${META_ERRORS[reason] ?? "Could not connect Facebook."}${extra ? ` (${extra})` : ""}`,
      });
    }
    if (meta) window.history.replaceState(null, "", window.location.pathname);
  }, [load]);

  const metaPages = sources.filter((s) => s.source_type === "meta_leadgen");
  const keySources = sources.filter((s) => s.source_type !== "meta_leadgen");

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Give this source a name, e.g. "Clinic website form"');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/lead-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, source_type: sourceType, allowed_domains: domain }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setName("");
      setDomain("");
      toast.success("Website source created. Copy the script below onto that site.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (s: LeadSource) => {
    const msg =
      s.source_type === "meta_leadgen"
        ? `Disconnect ${s.name}? Its Meta lead forms will stop sending leads here.`
        : "Revoke this key? Anything still using it will stop being able to send leads.";
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/lead-sources/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setSources((list) => list.filter((x) => x.id !== s.id));
      toast.success(s.source_type === "meta_leadgen" ? "Page disconnected" : "Key revoked");
    } catch {
      toast.error("Could not remove this source");
    }
  };

  const copy = (id: string, text: string, what: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`${what} copied`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const scriptOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://your-app";
  const ingestUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/leads/ingest`
      : "/api/leads/ingest";

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-5 pb-20 pt-5 sm:px-7 lg:px-10 lg:pb-10">
      <PageHead
        title="Lead sources"
        subtitle="Connect every place your leads come from. They all land in one list, de-duplicated by phone number."
      />

      <div className="mb-6">
        <LeadsTabs active="sources" />
      </div>

      {/* ── Facebook OAuth result banner (conditional) ── */}
      {banner && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-[12px] border p-3 text-[12.5px]"
          style={{
            borderColor: banner.ok ? "var(--brand-200)" : "var(--rose-200)",
            background: banner.ok ? "var(--brand-50)" : "var(--rose-50)",
            color: banner.ok ? "var(--brand-deep)" : "var(--rose)",
          }}
        >
          {banner.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* ── Section 1: Meta Lead Ads ── */}
      <Panel className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
              style={{ background: "var(--blue-50)", color: "var(--blue)" }}
            >
              <Megaphone className="size-5" aria-hidden />
            </div>
            <div>
              <h2
                className="text-[14px] font-bold"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
              >
                Meta Lead Ads (Facebook &amp; Instagram)
              </h2>
              <p
                className="mt-1 max-w-md text-[12px]"
                style={{ color: "var(--ink-2)" }}
              >
                Sign in with Facebook, pick your Page, and every instant-form lead flows in within seconds. No API
                keys, no Zapier.
              </p>
            </div>
          </div>
          <a
            href="/api/meta/leadgen/connect"
            className="rounded-[9px] px-4 py-2 text-[12px] font-bold text-white transition-colors"
            style={{ background: "#1877F2" }}
          >
            {metaPages.length > 0 ? "Connect another Page" : "Connect with Facebook"}
          </a>
        </div>

        <details
          className="mt-3 rounded-[9px] px-3 py-2 text-[12px]"
          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
        >
          <summary
            className="cursor-pointer font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Need help connecting?
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              <b>No Facebook account?</b> Click Connect, then choose &quot;Create new account&quot; in the Facebook
              window. You will come straight back here afterwards, and Facebook is only used to pick your Page.
            </li>
            <li>
              <b>Not the Page admin?</b> Ask the admin to open this screen and connect, or ask them to add you as an
              admin of the Page in Facebook first.
            </li>
            <li>
              <b>Several Pages?</b> Pick the Pages you run ads from. Connect again any time to add more.
            </li>
            <li>
              Facebook never sees your AiSend password, and you can disconnect a Page here whenever you like.
            </li>
          </ul>
        </details>

        {metaPages.length > 0 && (
          <div
            className="mt-4 divide-y rounded-[12px] border"
            style={{ borderColor: "var(--line)" }}
          >
            {metaPages.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3"
                style={{ borderColor: "var(--line)" }}
              >
                <CheckCircle2
                  className="size-4 shrink-0"
                  style={{ color: "var(--brand)" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13px] font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {s.name}
                  </p>
                  <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                    Page ID {s.meta_page_id}
                    {s.last_used_at
                      ? ` · last lead ${new Date(s.last_used_at).toLocaleDateString("en-IN")}`
                      : " · waiting for first lead"}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(s)}
                  className="flex size-8 items-center justify-center rounded-[8px] border transition-colors"
                  style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
                  title="Disconnect Page"
                  aria-label="Disconnect Page"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Section 2: Click-to-WhatsApp ── */}
      <Panel className="mb-5 p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
            style={{ background: "var(--brand-50)", color: "var(--brand-deep)" }}
          >
            <MessageCircle className="size-5" aria-hidden />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2
                className="text-[14px] font-bold"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
              >
                Click-to-WhatsApp ads
              </h2>
              <Pill tone="live">Automatic</Pill>
            </div>
            <p
              className="mt-1 max-w-md text-[12px]"
              style={{ color: "var(--ink-2)" }}
            >
              Nothing to set up. When someone taps your Meta ad and messages you on WhatsApp, they are added to All leads
              with the ad they clicked.
            </p>
          </div>
        </div>
      </Panel>

      {/* ── Section 3: Website form / Google Ads ── */}
      <Panel className="p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
            style={{ background: "var(--brand-50)", color: "var(--brand-deep)" }}
          >
            <Globe className="size-5" aria-hidden />
          </div>
          <div>
            <h2
              className="text-[14px] font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
            >
              Website form, Google Ads &amp; other tools
            </h2>
            <p
              className="mt-1 max-w-md text-[12px]"
              style={{ color: "var(--ink-2)" }}
            >
              Add one line of script to each website (HTML, PHP, WordPress, anything) and every form on it lands in
              All leads with where the visitor came from. Create one per website so you can tell them apart.
            </p>
          </div>
        </div>

        {/* Create new source form */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              className="mb-1 block text-[11.5px] font-semibold"
              style={{ color: "var(--ink-2)" }}
            >
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Clinic website contact form"'
              className="w-full rounded-[9px] border px-3 py-2 text-[13px] outline-none transition-colors"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            />
          </div>
          <div className="sm:w-52">
            <label
              className="mb-1 block text-[11.5px] font-semibold"
              style={{ color: "var(--ink-2)" }}
            >
              Website domain
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="clinic.com"
              className="w-full rounded-[9px] border px-3 py-2 text-[13px] outline-none transition-colors"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            />
          </div>
          <div className="sm:w-56">
            <label
              className="mb-1 block text-[11.5px] font-semibold"
              style={{ color: "var(--ink-2)" }}
            >
              Type
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full rounded-[9px] border px-3 py-2 text-[13px] outline-none transition-colors"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            >
              {KEY_SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            Create
          </Button>
        </div>

        {/* Security notice — amber banner */}
        <div
          className="mt-3 flex items-start gap-2 rounded-[12px] border p-3 text-[12px]"
          style={{
            borderColor: "var(--amber-200)",
            background: "var(--amber-50)",
            color: "var(--amber)",
          }}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            Adding the website domain locks the script to that site, so a copied key can&apos;t be used elsewhere. For
            Google Ads lead forms, Zapier/Make or a call-tracking provider, use the secret key instead: send to{" "}
            <code
              className="rounded px-1 py-0.5"
              style={{ background: "rgba(190,135,0,.15)", fontFamily: "var(--font-mono)" }}
            >
              {ingestUrl}
            </code>{" "}
            from a server with the key in an{" "}
            <code
              className="rounded px-1 py-0.5"
              style={{ background: "rgba(190,135,0,.15)", fontFamily: "var(--font-mono)" }}
            >
              x-api-key
            </code>{" "}
            header, and never put the secret key in browser JavaScript.
          </div>
        </div>

        {/* Existing website sources list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2
              className="size-5 animate-spin"
              style={{ color: "var(--brand)" }}
              aria-hidden
            />
          </div>
        ) : keySources.length > 0 ? (
          <div
            className="mt-4 divide-y rounded-[12px] border"
            style={{ borderColor: "var(--line)" }}
          >
            {keySources.map((s) => {
              const snippet = s.public_key
                ? `<script src="${scriptOrigin}/aisend.js" data-key="${s.public_key}" async></script>`
                : null;
              return (
                <div
                  key={s.id}
                  className="space-y-2 p-3"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[13px] font-semibold"
                        style={{ color: "var(--ink)" }}
                      >
                        {s.name}
                      </p>
                      <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                        {KEY_SOURCE_TYPES.find((t) => t.value === s.source_type)?.label ?? s.source_type}
                        {s.allowed_domains && s.allowed_domains.length > 0
                          ? ` · ${s.allowed_domains.join(", ")}`
                          : " · any domain"}
                        {s.last_used_at
                          ? ` · last lead ${new Date(s.last_used_at).toLocaleDateString("en-IN")}`
                          : " · no leads yet"}
                      </p>
                      {s.clicks_30d &&
                        (s.clicks_30d.call_click > 0 || s.clicks_30d.whatsapp_click > 0) && (
                          <p className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                            Last 30 days: {s.clicks_30d.call_click} call taps ·{" "}
                            {s.clicks_30d.whatsapp_click} WhatsApp taps
                          </p>
                        )}
                    </div>
                    <button
                      onClick={() => copy(`${s.id}-secret`, s.api_key, "Secret key")}
                      className="flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[11px] font-semibold transition-colors"
                      style={{
                        borderColor: "var(--line)",
                        color: "var(--ink-2)",
                        background: "var(--surface)",
                      }}
                      title="Secret key for servers, Google Ads webhooks, Zapier"
                    >
                      {copiedId === `${s.id}-secret` ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )}
                      Secret key
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="flex size-8 items-center justify-center rounded-[8px] border transition-colors"
                      style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
                      title="Revoke"
                      aria-label="Revoke key"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {snippet && (
                    <div
                      className="rounded-[9px] border p-2.5"
                      style={{
                        borderColor: "var(--brand-200)",
                        background: "var(--brand-50)",
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <code
                          className="min-w-0 flex-1 break-all text-[11px]"
                          style={{
                            color: "var(--ink-2)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {snippet}
                        </code>
                        <button
                          onClick={() => copy(`${s.id}-snippet`, snippet, "Script")}
                          className="flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[11px] font-bold text-white transition-opacity hover:opacity-95"
                          style={{
                            background:
                              "linear-gradient(180deg,var(--brand),var(--brand-deep))",
                            boxShadow: "var(--shadow-brand)",
                          }}
                        >
                          {copiedId === `${s.id}-snippet` ? (
                            <Check className="size-3.5" aria-hidden />
                          ) : (
                            <Copy className="size-3.5" aria-hidden />
                          )}
                          Copy script
                        </button>
                      </div>
                      <p
                        className="mt-1.5 text-[11px]"
                        style={{ color: "var(--ink-2)" }}
                      >
                        Paste before <code style={{ fontFamily: "var(--font-mono)" }}>&lt;/head&gt;</code>. WordPress:
                        Insert Headers &amp; Footers plugin. Shopify: theme.liquid. Works with any form builder (Ninja
                        Forms, CF7, WPForms, Elementor, custom PHP) as long as it asks for a phone or email. A WhatsApp
                        button gets a short &quot;(Ref ...)&quot; added to its message so the chat keeps its ad source.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
