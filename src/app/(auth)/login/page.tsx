"use client";

// src/app/(auth)/login/page.tsx
//
// The mirror of /signup: same canvas, same three doors. Anyone who
// created an account with Google or Facebook has to find that same
// button here, or their account simply looks gone to them.
//
// This page also renders the failure messages from /auth/callback,
// which redirects here with ?error=… when a provider hands back a
// refusal instead of a code.

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { authCss } from "@/components/auth/auth-styles";
import {
  AlertCircle, ArrowRight, BadgeCheck, Bot, Eye, EyeOff, Loader2,
  MessageSquare, Sparkles, Zap,
} from "lucide-react";

export default function LoginPage() {
  // useSearchParams suspends during prerender, so the form lives inside
  // its own boundary rather than opting the whole route into dynamic
  // rendering.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedUrlError, setDismissedUrlError] = useState(false);
  const [loading, setLoading] = useState(false);

  // /auth/callback redirects here with ?error=… when a provider refuses.
  // A fresh attempt supersedes it, so it is dropped on the next action
  // rather than lingering above an unrelated failure.
  const urlError = searchParams.get("error");
  const visibleError = error ?? (dismissedUrlError ? null : urlError);

  function reportError(message: string) {
    setDismissedUrlError(true);
    setError(message);
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDismissedUrlError(true);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      reportError(
        /invalid login credentials/i.test(signInError.message)
          ? "That email and password don't match. Check both, or reset your password."
          : signInError.message,
      );
      setLoading(false);
      return;
    }

    // Middleware routes them onward to their own workspace if they have
    // a slug, so a single destination is enough here.
    router.push(searchParams.get("next") || "/dashboard");
  }

  return (
    <div className="au">
      <style>{authCss}</style>

      {/* ── Left: the pitch ── */}
      <aside className="au-pitch">
        <div className="au-brand">
          <span className="au-logo"><MessageSquare size={18} /></span>
          AiSend
        </div>

        <div className="au-pitch-body">
          <span className="au-badge"><Zap size={12} /> Official WhatsApp Business API</span>
          <h1>
            Welcome back to<br />your<span className="au-accent"> growth engine.</span>
          </h1>
          <p className="au-pitch-sub">
            Your inbox, campaigns and AI agents have been running while you were
            away. Pick up exactly where you left off.
          </p>

          <div className="au-quote">
            <p>
              &ldquo;We replaced three tools with this and answer customers in
              minutes instead of days.&rdquo;
            </p>
            <cite>— A retail team using AiSend daily</cite>
          </div>

          <ul className="au-benefits">
            {[
              { icon: <BadgeCheck size={15} />, title: "Everything stays in sync", body: "One number, one shared team inbox." },
              { icon: <Bot size={15} />, title: "Agents keep working", body: "Leads captured while you're offline." },
              { icon: <Sparkles size={15} />, title: "Nothing to reinstall", body: "Your setup is exactly as you left it." },
            ].map((item) => (
              <li key={item.title}>
                <span className="au-benefit-ic">{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="au-pitch-foot">© {new Date().getFullYear()} AiSend. All rights reserved.</p>
      </aside>

      {/* ── Right: the form ── */}
      <main className="au-panel">
        <div className="au-panel-top">
          <span className="au-brand mobile">
            <span className="au-logo"><MessageSquare size={18} /></span>
            AiSend
          </span>
          <span className="au-have-account">
            New here? <Link href="/signup">Create an account</Link>
          </span>
        </div>

        <div className="au-form-wrap centered">
          <header className="au-form-head">
            <h2>Sign in</h2>
            <p>Welcome back. Continue with a provider or use your email.</p>
          </header>

          {visibleError && (
            <div className="au-error" role="alert">
              <AlertCircle size={15} /> <span>{visibleError}</span>
            </div>
          )}

          <SocialAuthButtons intent="login" onError={reportError} />

          <div className="au-divider"><span>or sign in with email</span></div>

          <form onSubmit={handleLogin} className="au-form" noValidate>
            <div className="au-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email" name="email" type="email" autoComplete="email"
                placeholder="you@company.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required
              />
            </div>

            <div className="au-field">
              <div className="au-field-row">
                <label htmlFor="password">Password</label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>
              <div className="au-password">
                <input
                  id="password" name="password" autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                />
                <button
                  type="button" className="au-reveal"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="au-btn au-btn-primary au-btn-full"
              disabled={loading || !email || !password}
            >
              {loading ? <><Loader2 size={16} className="au-spin" /> Signing in…</>
                       : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="au-switch">
            Don&apos;t have an account? <Link href="/signup">Get started free</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
