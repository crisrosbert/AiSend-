"use client";

// src/app/(auth)/signup/page.tsx
//
// The acquisition page: value on one side, the form on the other.
//
// ── WHAT THIS PAGE IS TRYING TO DO ───────────────────────────────────
// Somebody arriving here is deciding, not navigating. So the page has
// to answer "what do I get" before it asks for anything, and then ask
// for as little as it can get away with.
//
// Three deliberate choices, each against the common pattern:
//
//   1. ANY EMAIL WORKS. Most B2B signup forms demand a "work email" and
//      reject Gmail. In India the overwhelming majority of small shops,
//      clinics and property dealers run on Gmail — a work-email gate
//      turns away the exact customer this product is for. The field
//      says so out loud, because people who have been rejected by other
//      forms assume they will be rejected here too.
//
//   2. THE FORM COMES FIRST ON MOBILE. Marketing sits underneath. On a
//      phone, anyone who tapped "Sign up" has already decided; making
//      them scroll past a pitch to reach the fields taxes the visitors
//      who were most ready to convert.
//
//   3. THE PHONE NUMBER IS OPTIONAL. It genuinely helps — this is a
//      WhatsApp product and connecting a number is the next step — but
//      a required field costs more signups than the number is worth at
//      this stage. It is asked for with a reason attached instead.
//
// The workspace URL is checked live while they type, so nobody fills in
// six fields only to be told on submit that their name is taken.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { signupCss } from "@/components/auth/signup-styles";
import {
  AlertCircle, ArrowRight, BadgeCheck, Bot, Check, CreditCard, Eye, EyeOff,
  Gift, Inbox, Loader2, MailCheck, MessageSquare, ShieldCheck, Sparkles,
  Users, X, Zap,
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

/**
 * Dialling codes, India first because that is who this is sold to.
 * Deliberately short — a 200-country list is a scroll, not a feature.
 */
const DIAL_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+60", label: "Malaysia (+60)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+62", label: "Indonesia (+62)" },
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+94", label: "Sri Lanka (+94)" },
  { code: "+977", label: "Nepal (+977)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+1", label: "US / Canada (+1)" },
  { code: "+61", label: "Australia (+61)" },
];

type SlugState = "idle" | "checking" | "free" | "taken" | "error";

export default function SignupPage() {
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [dialCode, setDialCode] = useState("+91");
  const [phone, setPhone] = useState("");
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
      if (candidate.length < 3) { setSlugState("idle"); return; }
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
    if (!slug || slug.length < 3) { setSlugState("idle"); return; }
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

    if (slug.length < 3) { setError("Your workspace address needs at least 3 characters."); return; }
    if (slugState === "taken") { setError("That workspace address is taken — pick another."); return; }
    if (password.length < 8) { setError("Use a password of at least 8 characters."); return; }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          slug,
          business_name: businessName || fullName,
          // Stored when given. Optional, so it is normalised here rather
          // than left as a bare local number nobody can dial later.
          phone: phone.trim() ? `${dialCode}${phone.replace(/\D/g, "")}` : null,
        },
        emailRedirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(`/${slug}/dashboard`)}`,
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
      <div className="sg">
        <style>{signupCss}</style>
        <div className="sg-confirm">
          <div className="sg-confirm-card">
            <div className="sg-confirm-ic"><MailCheck size={26} /></div>
            <h1>Check your email</h1>
            <p>
              We sent a confirmation link to <strong>{email}</strong>. Open it and
              your workspace is ready.
            </p>
            <div className="sg-confirm-url">
              <span>Your workspace</span>
              <code>{origin}/{slug}/dashboard</code>
            </div>
            <p className="sg-confirm-hint">
              Nothing after a minute? Check your spam folder — some providers filter
              the first message from a new sender.
            </p>
            <Link href="/login" className="sg-btn sg-outline" style={{ marginTop: 18 }}>
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── page ──────────────────────────────────────────────────────── */

  return (
    <div className="sg">
      <style>{signupCss}</style>

      <header className="sg-top">
        <Link href="/" className="sg-brand">
          <span className="sg-logo"><MessageSquare size={17} /></span>
          AiSend
        </Link>
        <span className="sg-top-alt">
          Already have an account? <Link href="/login">Sign in</Link>
        </span>
      </header>

      <div className="sg-shell">

        {/* ── Value: second on mobile, left on desktop ── */}
        <section className="sg-value">
          <div className="sg-value-inner">
            <span className="sg-eyebrow"><Zap size={12} /> Official WhatsApp Business API</span>

            <h1>Your customers are on WhatsApp.<br /><em>Be there when they message.</em></h1>

            <p className="sg-value-sub">
              Connect your number, and an AI agent answers every enquiry — day, night
              and Sunday — while your team picks up the ones that matter.
            </p>

            <ul className="sg-benefits">
              <li>
                <span className="sg-tick"><Check size={12} strokeWidth={3} /></span>
                <div><b>Answers in seconds, not hours.</b>{" "}
                  <span>Trained on your own website, so it quotes your real prices and services.</span></div>
              </li>
              <li>
                <span className="sg-tick"><Check size={12} strokeWidth={3} /></span>
                <div><b>Books appointments while you sleep.</b>{" "}
                  <span>It knows your opening hours and never offers a time you are closed.</span></div>
              </li>
              <li>
                <span className="sg-tick"><Check size={12} strokeWidth={3} /></span>
                <div><b>Sends photos, brochures and price lists.</b>{" "}
                  <span>Upload once and the agent shares the right one when it is asked for.</span></div>
              </li>
              <li>
                <span className="sg-tick"><Check size={12} strokeWidth={3} /></span>
                <div><b>Hands over the moment it should.</b>{" "}
                  <span>Anything urgent goes straight to a human, flagged, with the reason attached.</span></div>
              </li>
            </ul>

            <div className="sg-offer">
              <div className="sg-offer-head">
                <span className="sg-offer-ic"><Gift size={17} /></span>
                <div>
                  <strong>Free forever plan</strong>
                  <span>Start today, upgrade only when you outgrow it</span>
                </div>
              </div>
              <ul className="sg-offer-list">
                <li>
                  <BadgeCheck size={15} />
                  <div><b>Official WhatsApp Business API</b>
                    <em>Verified setup through Meta, not an unofficial workaround</em></div>
                </li>
                <li>
                  <Bot size={15} />
                  <div><b>An AI agent on your number</b>
                    <em>Replies inside the free service window cost nothing</em></div>
                </li>
                <li>
                  <Inbox size={15} />
                  <div><b>Shared team inbox</b>
                    <em>Everyone answers from one place, on one number</em></div>
                </li>
                <li>
                  <Sparkles size={15} />
                  <div><b>Green tick application</b>
                    <em>We help you apply for a verified business account</em></div>
                </li>
              </ul>
            </div>

            {/* Product facts, not invented social proof. When there are
                real customer numbers and logos, this is where they go. */}
            <div className="sg-assure">
              <div><CreditCard size={14} /> No card needed</div>
              <div><ShieldCheck size={14} /> Your data stays yours</div>
              <div><Users size={14} /> Export everything, any time</div>
            </div>
          </div>
        </section>

        {/* ── Form: first on mobile, right on desktop ── */}
        <section className="sg-form-wrap">
          <div className="sg-card">
            <div className="sg-card-head">
              <h2>Create your account</h2>
              <p>Free to start. No card, no sales call, no setup fee.</p>
            </div>

            {error && (
              <div className="sg-error" role="alert">
                <AlertCircle size={15} /> <span>{error}</span>
              </div>
            )}

            {/* Fastest route first — one tap and no password to invent. */}
            <div style={{ marginTop: 18 }}>
              <SocialAuthButtons intent="signup" onError={setError} />
            </div>

            <div className="sg-divider">or sign up with email</div>

            <form onSubmit={handleSignup} className="sg-form" noValidate>
              <div className="sg-row two">
                <div className="sg-field">
                  <label htmlFor="fullName">Your name</label>
                  <input
                    id="fullName" className="sg-input" type="text" autoComplete="name"
                    placeholder="Priya Sharma" value={fullName}
                    onChange={(e) => setFullName(e.target.value)} required
                  />
                </div>
                <div className="sg-field">
                  <label htmlFor="businessName">Business name</label>
                  <input
                    id="businessName" className="sg-input" type="text" autoComplete="organization"
                    placeholder="Sharma Retail" value={businessName}
                    onChange={(e) => handleBusinessName(e.target.value)} required
                  />
                </div>
              </div>

              <div className="sg-field">
                <label htmlFor="slug">Your workspace address</label>
                <div className="sg-url">
                  <span className="sg-url-prefix">aisend.in/</span>
                  <input
                    id="slug" type="text" spellCheck={false} placeholder="sharma-retail"
                    value={slug}
                    onChange={(e) => { setSlugTouched(true); setSlug(toSlug(e.target.value)); }}
                    required
                  />
                  <span className="sg-url-state">
                    {slugState === "checking" && <Loader2 size={15} className="sg-spin" style={{ color: "#8A9995" }} />}
                    {slugState === "free" && <Check size={15} style={{ color: "#128C4A" }} />}
                    {slugState === "taken" && <X size={15} style={{ color: "#dc2626" }} />}
                  </span>
                </div>
                {slugState === "taken" && <p className="sg-hint bad">Taken — try another.</p>}
                {slugState === "free" && <p className="sg-hint good">Available.</p>}
                {slugState !== "taken" && slugState !== "free" && (
                  <p className="sg-hint">Filled in from your business name. Change it if you like.</p>
                )}
              </div>

              <div className="sg-field">
                <label htmlFor="phone">
                  WhatsApp number <span>— optional</span>
                </label>
                <div className="sg-phone">
                  <select
                    className="sg-input" value={dialCode} aria-label="Country dialling code"
                    onChange={(e) => setDialCode(e.target.value)}
                  >
                    {DIAL_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    id="phone" className="sg-input" type="tel" inputMode="numeric"
                    autoComplete="tel-national" placeholder="98765 43210" value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <p className="sg-hint">
                  Only so we can help you connect your number. We won&apos;t call to sell you anything.
                </p>
              </div>

              <div className="sg-field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email" className="sg-input" type="email" autoComplete="email"
                  placeholder="priya@gmail.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required
                />
                {/* Said plainly, because anyone rejected by a "work email
                    only" form elsewhere assumes the same rule here. */}
                <p className="sg-hint">Gmail, Yahoo or any personal address is fine.</p>
              </div>

              <div className="sg-field">
                <label htmlFor="password">Password</label>
                <div className="sg-pw">
                  <input
                    id="password" className="sg-input" autoComplete="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters" value={password}
                    onChange={(e) => setPassword(e.target.value)} required
                  />
                  <button
                    type="button" className="sg-reveal"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <>
                    <div className="sg-meter" aria-hidden="true">
                      {[1, 2, 3, 4].map((i) => (
                        <i key={i} className={strength.score >= i ? `on${strength.score}` : ""} />
                      ))}
                    </div>
                    <p className="sg-hint">{strength.label}</p>
                  </>
                )}
              </div>

              <button type="submit" className="sg-btn sg-primary" disabled={!canSubmit}>
                {loading
                  ? <><Loader2 size={16} className="sg-spin" /> Creating your account…</>
                  : <>Create free account <ArrowRight size={16} /></>}
              </button>

              <p className="sg-legal">
                By creating an account you agree to our{" "}
                <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
              </p>
            </form>

            <p className="sg-switch">
              Already have an account? <Link href="/login">Sign in</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
