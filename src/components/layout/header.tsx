"use client";

// src/components/layout/header.tsx
//
// ────────────────────────────────────────────────────────────────────────────
// Top bar — Design System v2 (rebuilt 2026-10-11)
// ────────────────────────────────────────────────────────────────────────────
// Mirrors the Design System v2 preview artifact's topbar:
//
//   [☰ (mobile)] [Business ▾ / Page title]        [Search ⌘K]    [status · plan · avatar]
//
// Every colour, border, shadow and font references globals.css tokens.
// No hardcoded hex. If the brand retones, this bar follows automatically.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { BusinessSwitcher } from "@/components/layout/business-switcher";
import { LogOut, Menu, Settings as SettingsIcon, User, Zap, Search } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Pathname → crumb label mapping. Add a route here to make the top bar
 * recognise it; otherwise the fallback is the last URL segment, titled.
 */
const PAGE_TITLES: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/inbox":       "Live Chat",
  "/contacts":    "Contacts",
  "/pipelines":   "Pipelines",
  "/broadcasts":  "Campaigns",
  "/campaign-agent": "AI Campaigns",
  "/leads":       "Leads",
  "/journeys":    "Chat Flows",
  "/flows-lab":   "Flows Lab",
  "/automations": "Automations",
  "/analytics":   "Analytics",
  "/agents":      "AI Agents",
  "/ai-agent":    "Shop Agent",
  "/recent":      "Recent",
  "/widget":      "Website Widget",
  "/bookings":    "Bookings",
  "/settings":    "Settings",
  "/billing":     "Billing",
  "/health":      "System Health",
};

function titleForPath(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname.includes(path),
  );
  if (match) return match[1];
  // Last-segment fallback: "/leads/sources" → "Sources"
  const seg = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

type WaState = "checking" | "connected" | "disconnected" | "unknown";

const WA_STATUS_KEY = "aisend_wa_status";
const WA_STATUS_TTL_MS = 5 * 60 * 1000;

/**
 * Shows whether this account's WhatsApp Business API is really connected.
 * It asks the same health check the Settings > WhatsApp tab uses
 * (GET /api/whatsapp/config) and remembers the answer for 5 minutes per
 * browser tab, so it does not call Meta on every page change.
 */
function WhatsappStatusPill() {
  const [state, setState] = useState<WaState>("checking");

  useEffect(() => {
    let alive = true;
    try {
      const raw = sessionStorage.getItem(WA_STATUS_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { s: WaState; t: number };
        if (Date.now() - c.t < WA_STATUS_TTL_MS && (c.s === "connected" || c.s === "disconnected")) {
          setState(c.s);
          return;
        }
      }
    } catch {}
    fetch("/api/whatsapp/config", { method: "GET" })
      .then((r) => r.json())
      .then((p: { connected?: boolean; reason?: string }) => {
        if (!alive) return;
        // A temporary Meta or database problem is not "not connected": show it
        // as unknown and do not remember it.
        const transient = p && p.connected !== true && (p.reason === "meta_api_error" || p.reason === "db_error");
        if (transient) { setState("unknown"); return; }
        const s: WaState = p && p.connected === true ? "connected" : "disconnected";
        setState(s);
        try { sessionStorage.setItem(WA_STATUS_KEY, JSON.stringify({ s, t: Date.now() })); } catch {}
      })
      .catch(() => { if (alive) setState("unknown"); });
    return () => { alive = false; };
  }, []);

  const connected = state === "connected";
  const notConnected = state === "disconnected";
  const label = connected ? "LIVE" : notConnected ? "Not connected" : state === "unknown" ? "Status unavailable" : "Checking…";

  const pill = (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={
        connected
          ? { background: "var(--brand-50)", color: "var(--brand-deep)", borderColor: "var(--brand-200)" }
          : notConnected
            ? { background: "var(--surface)", color: "var(--ink-2)", borderColor: "var(--line-strong)" }
            : { background: "var(--surface)", color: "var(--ink-3)", borderColor: "var(--line)" }
      }
    >
      <span
        className="inline-block h-[6px] w-[6px] rounded-full"
        style={{ background: connected ? "var(--brand)" : notConnected ? "var(--rose)" : "var(--ink-4)" }}
      />
      {label}
    </span>
  );

  return (
    <div className="hidden items-center gap-1.5 lg:flex" style={{ color: "var(--ink-3)" }}>
      <span className="text-[11.5px] font-medium">WhatsApp API:</span>
      {notConnected ? (
        <Link href="/settings?tab=whatsapp" title="Connect your WhatsApp Business account">
          {pill}
        </Link>
      ) : (
        pill
      )}
    </div>
  );
}

interface HeaderProps {
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const title = titleForPath(pathname);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  const businessName =
    profile?.business_name ?? profile?.full_name ?? "Your Business";

  // ── ⌘K / Ctrl+K focuses the search box (keyboard-first UX) ──
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pressing Enter sends the query to a search page. This page may not
  // exist yet in the app — if it doesn't, link to /inbox for now which
  // has its own list filter.
  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/inbox?q=${encodeURIComponent(q)}`);
  };

  return (
    <header
      className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6"
      style={{
        background: "var(--canvas)",
        borderColor: "var(--line)",
      }}
    >
      {/* ── Left — mobile menu + breadcrumb (business / page) ── */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors lg:hidden"
          style={{ color: "var(--ink)" }}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb row — business switcher on the left, page title on the right */}
        <div className="flex min-w-0 items-center gap-2">
          <BusinessSwitcher fallbackName={businessName} />
          <span
            className="hidden sm:inline"
            style={{ color: "var(--ink-4)" }}
            aria-hidden
          >
            /
          </span>
          <span
            className="hidden truncate text-[13px] font-semibold sm:inline"
            style={{ color: "var(--ink)" }}
          >
            {title}
          </span>
        </div>
      </div>

      {/* ── Middle — global search with ⌘K shortcut ── */}
      <form
        onSubmit={onSearchSubmit}
        className="relative hidden w-[280px] shrink-0 md:block"
      >
        <div
          className="flex items-center gap-2 rounded-[9px] border px-3 py-1.5 transition-colors"
          style={{
            background: "var(--surface)",
            borderColor: "var(--line)",
          }}
        >
          <Search
            className="h-3.5 w-3.5"
            style={{ color: "var(--ink-3)" }}
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns, contacts, templates…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[color:var(--ink-3)]"
            style={{ color: "var(--ink)" }}
          />
          <kbd
            className="hidden rounded px-1.5 py-[1px] text-[10px] sm:inline"
            style={{
              fontFamily: "var(--font-mono)",
              background: "var(--canvas)",
              border: "1px solid var(--line)",
              color: "var(--ink-3)",
            }}
          >
            ⌘K
          </kbd>
        </div>
      </form>

      {/* ── Right — status · plan · avatar ── */}
      <div className="ml-auto flex items-center gap-2">
        {/* WhatsApp Business API status pill: real state, not a fixed label */}
        <WhatsappStatusPill />

        {/* Explore Plans — dark pill with brand accent icon */}
        <Link
          href="/billing"
          className="hidden items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-90 sm:inline-flex"
          style={{
            background: "var(--ink)",
            color: "var(--brand-300)",
          }}
        >
          <Zap className="h-3.5 w-3.5" fill="var(--brand-300)" />
          Explore Plans
        </Link>

        {/* Avatar + account menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors focus:outline-none"
            aria-label="Open account menu"
          >
            <Avatar className="size-8">
              {profile?.avatar_url ? (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={profile.full_name ?? "Avatar"}
                />
              ) : null}
              <AvatarFallback
                className="text-[13px] font-bold"
                style={{
                  background:
                    "linear-gradient(135deg,var(--brand),var(--brand-deep))",
                  color: "#fff",
                }}
              >
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-56"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: "var(--ink-2)",
            }}
          >
            <div
              className="px-3 py-2"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <p
                className="truncate text-[13px] font-semibold"
                style={{ color: "var(--ink)" }}
              >
                {profile?.full_name ?? "User"}
              </p>
              <p
                className="truncate text-[11.5px]"
                style={{ color: "var(--ink-3)" }}
              >
                {profile?.email ?? ""}
              </p>
            </div>
            <DropdownMenuItem
              render={
                <Link href="/settings?tab=profile" />
              }
            >
              <User
                className="size-4"
                style={{ color: "var(--ink-3)" }}
              />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link href="/settings?tab=whatsapp" />
              }
            >
              <SettingsIcon
                className="size-4"
                style={{ color: "var(--ink-3)" }}
              />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: "var(--line)" }} />
            <DropdownMenuItem
              onClick={signOut}
              style={{ color: "var(--rose)" }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
