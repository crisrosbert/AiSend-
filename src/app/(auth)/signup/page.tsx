"use client";

// src/app/(auth)/signup/page.tsx
//
// Three ways in — Google, Facebook, or email — on a split canvas: the
// pitch on the left, the form on the right.
//
// The social buttons sit above the fold because they convert; the email
// form stays fully visible underneath rather than hidden behind a
// "sign up with email instead" link, so neither path is a second-class
// citizen. The claimed workspace URL is checked live while the visitor
// types, so nobody fills in five fields only to be told on submit that
// their name is taken.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { authCss } from "@/components/auth/auth-styles";
import {
  AlertCircle, ArrowRight, BadgeCheck, Bot, Check, Eye, EyeOff, Loader2,
  MailCheck, MessageSquare, Sparkles, X, Zap,
} from "lucide-react";

/** Slugify a business name into a URL-safe workspace address. */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);
}

/** 0–4 strength score, plus the reason it isn't higher. */
function scorePassword(value: string): { score: number; label: string } {
  if (!value) return { score: 0, label: "" };
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score++;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score] };
}

type SlugState = "idle" | "checking" | "free" | "taken" | "error";

export default function SignupPage() {
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const strength = scorePassword(password);

  /* ── live workspace-URL availability ───────────────────────────── */

  // Keyed by the slug in flight so a slow response for an old value can
  // never overwrite the verdict for what is currently in the box.
  const inFlight = useRef("");

  const checkSlug = useCallback(
    async (candidate: string) => {
      if (candidate.length < 3) {
        setSlugState("idle");
        return;
      }
      inFlight.current = candidate;
      setSlugState("checking");
      try {
        const { data, error: rpcError } = await supabase.rpc("is_slug_available", {
          p_slug: candidate,
        });
        if (inFlight.current !== candidate) return; // stale response
        if (rpcError) throw rpcError;
        setSlugState(data ? "free" : "taken");
      } catch {
        if (inFlight.current === candidate) setSlugState("error");
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugState("idle");
      return;
    }
    const timer = setTimeout(() => void checkSlug(slug), 400);
    return () => clearTimeout(timer);
  }, [slug, checkSlug]);

  const handleBusinessName = (value: string) => {
    setBusinessName(value);
    if (!slugTouched) setSlug(toSlug(value));
  };

  /* ── submit ────────────────────────────────────────────────────── */

  const canSubmit =
    fullName.trim().length > 1 &&
    businessName.trim().length > 1 &&
    slug.length >= 3 &&
    slugState !== "taken" &&
    slugState !== "checking" &&
    /\S+@\S+\.\S+/.test(email) &&
    password.length >= 8 &&
    !loading;

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (slug.length < 3) { setError("Your workspace URL needs at least 3 characters."); return; }
    if (slugState === "taken") { setError("That workspace URL is taken — pick another."); return; }
    if (password.length < 8) { setError("Use a password of at least 8 characters."); return; }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, slug, business_name: businessName || fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/${slug}/dashboard`)}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  }

  /* ── confirmation ──────────────────────────────────────────────── */

  if (success) {
    return (
      <div className="au">
        <style>{authCss}</style>
        <div className="au-confirm">
          <div className="au-confirm-card">
            <div className="au-confirm-ic"><MailCheck size={26} /></div>
            <h1>Confirm your email</h1>
            <p>
              We sent a verification link to <strong>{email}</strong>. Click it and
              your workspace is ready to go.
            </p>
            <div className="au-confirm-url">
              <span>Your workspace</span>
              <code>{origin}/{slug}/dashboard</code>
            </div>
            <p className="au-confirm-hint">
              Nothing in your inbox after a minute? Check spam — the message comes
              from your Supabase auth sender.
            </p>
            <Link href="/login" className="au-btn au-btn-outline au-btn-full">
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── form ──────────────────────────────────────────────────────── */

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
            Turn WhatsApp into<br />your best<span className="au-accent"> sales channel.</span>
          </h1>
          <p className="au-pitch-sub">
            Broadcasts, a shared team inbox, and AI agents that qualify leads while
            you sleep — running on one number your customers already trust.
          </p>

          <ul className="au-benefits">
            {[
              { icon: <BadgeCheck size={15} />, title: "Free forever plan", body: "No card required. Start sending today." },
              { icon: <Bot size={15} />, title: "AI agents included", body: "Answer questions and capture leads 24/7." },
              { icon: <Sparkles size={15} />, title: "Live in minutes", body: "Connect your number with guided setup." },
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

          <div className="au-stats">
            <div><strong>98%</strong><span>Delivery rate</span></div>
            <div><strong>10×</strong><span>Faster outreach</span></div>
            <div><strong>3 min</strong><span>To first message</span></div>
          </div>
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
            Already a member? <Link href="/login">Log in</Link>
          </span>
        </div>

        <div className="au-form-wrap">
          <header className="au-form-head">
            <h2>Create your account</h2>
            <p>Three ways to start — pick whichever is fastest for you.</p>
          </header>

          {error && (
            <div className="au-error" role="alert">
              <AlertCircle size={15} /> <span>{error}</span>
            </div>
          )}

          <SocialAuthButtons intent="signup" onError={setError} />

          <div className="au-divider"><span>or sign up with email</span></div>

          <form onSubmit={handleSignup} className="au-form" noValidate>
            <div className="au-row">
              <Field label="Your name" htmlFor="fullName">
                <input
                  id="fullName" name="fullName" type="text" autoComplete="name"
                  placeholder="Priya Sharma" value={fullName}
                  onChange={(e) => setFullName(e.target.value)} required
                />
              </Field>
              <Field label="Business name" htmlFor="businessName">
                <input
                  id="businessName" name="businessName" type="text" autoComplete="organization"
                  placeholder="Sharma Retail" value={businessName}
                  onChange={(e) => handleBusinessName(e.target.value)} required
                />
              </Field>
            </div>

            <Field
              label="Workspace URL"
              htmlFor="slug"
              hint={
                slugState === "taken" ? undefined
                  : slug.length >= 3 ? `${origin}/${slug}/dashboard`
                  : "Letters, numbers and hyphens. At least 3 characters."
              }
              error={slugState === "taken" ? "That address is already taken — try another." : undefined}
            >
              <div className="au-slug">
                <span className="au-slug-prefix">/</span>
                <input
                  id="slug" name="slug" type="text" spellCheck={false}
                  placeholder="sharma-retail" value={slug}
                  onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugTouched(true); }}
                  aria-invalid={slugState === "taken"}
                  required
                />
                <span className="au-slug-state">
                  {slugState === "checking" && <Loader2 size={15} className="au-spin au-dim" />}
                  {slugState === "free" && <Check size={15} className="au-ok" />}
                  {slugState === "taken" && <X size={15} className="au-bad" />}
                </span>
              </div>
            </Field>

            <Field label="Work email" htmlFor="email">
              <input
                id="email" name="email" type="email" autoComplete="email"
                placeholder="you@company.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              hint={password ? undefined : "At least 8 characters."}
            >
              <div className="au-password">
                <input
                  id="password" name="password" autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password" value={password}
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
              {password && (
                <div className="au-strength" aria-live="polite">
                  <div className="au-strength-bars">
                    {[1, 2, 3, 4].map((step) => (
                      <span key={step} className={step <= strength.score ? `s${strength.score}` : ""} />
                    ))}
                  </div>
                  <span className={`au-strength-label s${strength.score}`}>{strength.label}</span>
                </div>
              )}
            </Field>

            <button type="submit" className="au-btn au-btn-primary au-btn-full" disabled={!canSubmit}>
              {loading ? <><Loader2 size={16} className="au-spin" /> Creating your workspace…</>
                       : <>Create free account <ArrowRight size={16} /></>}
            </button>

            <ul className="au-trust">
              <li><Check size={12} /> No credit card</li>
              <li><Check size={12} /> Free forever plan</li>
              <li><Check size={12} /> Cancel anytime</li>
            </ul>

            <p className="au-legal">
              By creating an account you agree to our{" "}
              <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

/* ────────────────────────── field wrapper ────────────────────────── */

function Field({
  label, htmlFor, hint, error, children,
}: {
  label: string; htmlFor: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="au-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="au-field-error">{error}</p>
             : hint ? <p className="au-field-hint">{hint}</p> : null}
    </div>
  );
}
