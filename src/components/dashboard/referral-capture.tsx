"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const REF_KEY = "pending_referral_code";

/**
 * Call this ONCE on the signup page. If the URL has ?ref=CODE, it stashes
 * the code in localStorage so it survives the email-confirmation round trip.
 * Safe to call on every render (only writes when a code is present).
 */
export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && ref.trim()) {
    try { localStorage.setItem(REF_KEY, ref.trim()); } catch { /* ignore */ }
  }
}

/**
 * Mount this once inside the dashboard (it renders nothing). On first load
 * after signup, if there's a stashed referral code and the user's org now
 * exists, it links the referral via the link_referral RPC and clears the
 * code. Fully guarded server-side, so calling more than once is harmless.
 */
export function ReferralConsumer() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.org_id) return;
    let code: string | null = null;
    try { code = localStorage.getItem(REF_KEY); } catch { /* ignore */ }
    if (!code) return;

    const db = createClient();
    (async () => {
      try {
        await db.rpc("link_referral", {
          p_referred_org: profile.org_id,
          p_code: code,
        });
      } catch {
        // Non-critical — never block the dashboard on this.
      } finally {
        try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ }
      }
    })();
  }, [profile?.org_id]);

  return null;
}
