"use client";

// src/hooks/use-business.tsx
//
// Which business the dashboard is currently showing.
//
// ── WHY A PROVIDER AND NOT A PROP ────────────────────────────────────
// Thirty pages read tenant data. Threading a business id through all of
// them means thirty chances to forget one — and a page that forgets it
// does not error, it quietly shows another business's rows. That is the
// exact failure mode this whole boundary exists to remove, so the id
// comes from one place that cannot be skipped.
//
// ── THE RULE THAT MATTERS ────────────────────────────────────────────
// `businessId` is null until the list has loaded. Pages must not query
// on null — treat it as "still loading", not as "no filter". A query
// that runs without the filter is the leak, and it looks like a
// perfectly successful page.
//
// The `scoped()` helper below exists so that rule is easy to follow.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resolveBusiness, BUSINESS_COOKIE, type BusinessRef } from "@/lib/business/resolve";

interface BusinessContextValue {
  /** Every business this user owns. Empty until loaded. */
  businesses: BusinessRef[];
  /** The one being shown, or null while loading / if none exist. */
  business: BusinessRef | null;
  /** Shorthand for the common `.eq("business_id", …)` case. */
  businessId: string | null;
  loading: boolean;
  /** True when the account has no business at all — a real state. */
  needsSetup: boolean;
  switchTo: (id: string) => void;
  refresh: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

/** Written so API routes can read the same choice server-side. */
function writeCookie(id: string) {
  try {
    // Lax rather than Strict: the widget and OAuth callbacks return via
    // cross-site navigations, and Strict would drop the cookie there and
    // silently reset everyone to their default business.
    document.cookie = `${BUSINESS_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies disabled. The provider still works in-memory for this
    // tab; only server-side resolution falls back to the default.
  }
}

function readCookie(): string | null {
  try {
    for (const part of document.cookie.split(";")) {
      const [name, ...rest] = part.split("=");
      if (name?.trim() === BUSINESS_COOKIE) {
        return decodeURIComponent(rest.join("=").trim()) || null;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [businesses, setBusinesses] = useState<BusinessRef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * Which user the list in state actually belongs to.
   *
   * Not decoration: after switching accounts the previous user's
   * businesses are still in state until the new fetch lands, and a page
   * that queried during that window would query on an id this user does
   * not own. Comparing this against the current user is what makes the
   * gap read as "loading" instead of as "here is your data".
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Guards out-of-order responses: a slow fetch for the previous user
  // must not overwrite a fast one for the current user.
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    // Signed out is derived below, not stored. Writing state here would
    // be a synchronous setState inside the effect that calls this, which
    // cascades a render on every auth change.
    if (!user) return;

    const seq = ++requestRef.current;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, is_default, logo_url")
      .eq("owner_user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (seq !== requestRef.current) return; // a newer load already won

    if (error) {
      // Most likely cause is migration 030 not having run. Log it
      // plainly — a silently empty list would look like "this account
      // has no businesses", which is a different and misleading thing.
      console.error("[business] load failed:", error.message);
      setBusinesses([]);
      setSelectedId(null);
      setLoadedFor(user.id);
      return;
    }

    const owned = (data ?? []) as BusinessRef[];
    setBusinesses(owned);
    setSelectedId(resolveBusiness(readCookie(), owned)?.id ?? null);
    setLoadedFor(user.id);
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    // Wrapped rather than called directly so the fetch is unambiguously
    // asynchronous: every setState inside load() happens after an await,
    // never in this effect's synchronous body.
    const run = async () => {
      await load();
    };
    void run();
  }, [authLoading, user, load]);

  const switchTo = useCallback(
    (id: string) => {
      // Only to a business actually owned. The picker cannot offer
      // anything else, but this is called from code too.
      if (!businesses.some((b) => b.id === id)) return;
      setSelectedId(id);
      writeCookie(id);
      // Full reload rather than a re-render: thirty pages hold their own
      // fetched state, and re-rendering would leave stale rows from the
      // previous business on screen next to fresh ones. Correctness over
      // smoothness — and switching business is rare.
      window.location.reload();
    },
    [businesses],
  );

  const value = useMemo<BusinessContextValue>(() => {
    // Signed out: nothing to show, and nothing left to wait for.
    const signedOut = !authLoading && !user;
    // Anything else is "loading" until state provably belongs to the
    // user we have right now. Erring toward loading is the safe
    // direction — it withholds a query for a moment; the other
    // direction runs one against the wrong business.
    const ready = signedOut || (!authLoading && !!user && loadedFor === user.id);

    const owned = ready && !signedOut ? businesses : [];
    const business = owned.find((b) => b.id === selectedId) ?? null;

    return {
      businesses: owned,
      business,
      businessId: business?.id ?? null,
      loading: !ready,
      needsSetup: ready && !signedOut && owned.length === 0,
      switchTo,
      refresh: load,
    };
  }, [businesses, selectedId, loadedFor, authLoading, user, switchTo, load]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error("useBusiness must be used inside <BusinessProvider>");
  }
  return ctx;
}

/**
 * Guard for the rule at the top of this file.
 *
 * Returns the id only when it is safe to query on, and null while the
 * provider is still loading. Written as a hook so a page reads:
 *
 *     const businessId = useScopedBusinessId();
 *     useEffect(() => {
 *       if (!businessId) return;          // still loading — do not query
 *       void load(businessId);
 *     }, [businessId]);
 *
 * The early return is the whole point: without it, the first render
 * fires an unscoped query and paints another business's data before the
 * scoped one arrives to replace it.
 */
export function useScopedBusinessId(): string | null {
  const { businessId, loading } = useBusiness();
  return loading ? null : businessId;
}
