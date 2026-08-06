"use client";

// src/components/auth/social-auth-buttons.tsx
//
// Google + Facebook sign-in, shared by /signup and /login so the two
// pages can never drift apart. A visitor who creates an account with
// Google must find the same button when they come back to log in —
// otherwise their account looks lost to them.
//
// Both providers use Supabase's PKCE flow: signInWithOAuth sends the
// browser to the provider, which returns to /auth/callback with a code
// that the route handler exchanges for a session.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

type Provider = "google" | "facebook";

interface Props {
  /** Where to land after a successful sign-in. */
  next?: string;
  /** Surfaced to the parent page so errors render in its own error slot. */
  onError?: (message: string) => void;
  /** "signup" changes the label to "Sign up with…". */
  intent?: "signup" | "login";
}

export function SocialAuthButtons({ next = "/dashboard", onError, intent = "signup" }: Props) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const verb = intent === "signup" ? "Sign up" : "Continue";

  async function signIn(provider: Provider) {
    setBusy(provider);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      // On success the browser is already navigating away, so only the
      // failure path needs handling here.
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start sign-in";
      onError?.(
        // The raw Supabase message for a provider that hasn't been turned
        // on is "Unsupported provider", which tells the user nothing.
        /unsupported provider|not enabled/i.test(message)
          ? `${provider === "google" ? "Google" : "Facebook"} sign-in isn't enabled yet. Use your email below, or contact support.`
          : message,
      );
      setBusy(null);
    }
  }

  return (
    <div className="au-social">
      <button
        type="button"
        className="au-social-btn"
        onClick={() => signIn("google")}
        disabled={busy !== null}
      >
        {busy === "google" ? (
          <Loader2 size={17} className="au-spin" />
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path fill="#4285F4" d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.65z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A11.995 11.995 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.28a12 12 0 0 0 0 10.72l3.99-3.09z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.64l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
          </svg>
        )}
        <span>{verb} with Google</span>
      </button>

      <button
        type="button"
        className="au-social-btn"
        onClick={() => signIn("facebook")}
        disabled={busy !== null}
      >
        {busy === "facebook" ? (
          <Loader2 size={17} className="au-spin" />
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path
              fill="#1877F2"
              d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c-.02-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
            />
          </svg>
        )}
        <span>{verb} with Facebook</span>
      </button>
    </div>
  );
}
