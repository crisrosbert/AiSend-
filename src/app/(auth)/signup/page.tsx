"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, CheckCircle, Loader2 } from "lucide-react";

// Slugify business name → URL-safe string
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  // Auto-generate slug from business name
  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value);
    if (!slugManuallyEdited) {
      setSlug(toSlug(value));
      setSlugError(null);
    }
  };

  // Manual slug edit
  const handleSlugChange = (value: string) => {
    const cleaned = toSlug(value);
    setSlug(cleaned);
    setSlugManuallyEdited(true);
    setSlugError(null);
  };

  // Check slug availability on blur
  const checkSlug = async () => {
    if (!slug || slug.length < 3) {
      setSlugError("Slug must be at least 3 characters");
      return;
    }
    setCheckingSlug(true);
    try {
      const { data, error } = await supabase.rpc("is_slug_available", {
        p_slug: slug,
      });
      if (error) throw error;
      if (!data) {
        setSlugError("This URL is already taken. Try another.");
      } else {
        setSlugError(null);
      }
    } catch {
      setSlugError("Could not check availability. Try again.");
    } finally {
      setCheckingSlug(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!slug || slug.length < 3) {
      setError("Business URL must be at least 3 characters");
      return;
    }

    if (slugError) {
      setError("Please fix the business URL error first");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    // Sign up — pass slug + business_name in metadata
    // The handle_new_user trigger will auto-create org + profile
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          slug: slug,
          business_name: businessName || fullName,
        },
        // After email confirmation, redirect to their dashboard
        emailRedirectTo: `${window.location.origin}/${slug}/dashboard`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
              <CheckCircle className="h-6 w-6 text-violet-500" />
            </div>
            <CardTitle className="text-xl text-white">
              Check your email
            </CardTitle>
            <CardDescription className="text-slate-400">
              We&apos;ve sent a confirmation link to{" "}
              <span className="text-white">{email}</span>. Click the link to
              activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-300">
              Your CRM will be ready at:
              <div className="mt-1 font-mono text-violet-400">
                {window.location.origin}/{slug}/dashboard
              </div>
            </div>
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Back to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
            <MessageSquare className="h-6 w-6 text-violet-500" />
          </div>
          <CardTitle className="text-xl text-white">Create account</CardTitle>
          <CardDescription className="text-slate-400">
            Set up your WhatsApp CRM in minutes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Full Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName" className="text-slate-300">
                Your name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Amit Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            {/* Business Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="businessName" className="text-slate-300">
                Business name
              </Label>
              <Input
                id="businessName"
                type="text"
                placeholder="Clickstream Marketing"
                value={businessName}
                onChange={(e) => handleBusinessNameChange(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            {/* Slug / CRM URL */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug" className="text-slate-300">
                Your CRM URL
              </Label>
              <div className="flex items-center rounded-md border border-slate-700 bg-slate-800 focus-within:border-violet-500">
                <span className="select-none border-r border-slate-700 px-3 text-sm text-slate-500">
                  app/
                </span>
                <Input
                  id="slug"
                  type="text"
                  placeholder="clickstream"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={checkSlug}
                  required
                  className="border-0 bg-transparent text-white placeholder:text-slate-500 focus-visible:ring-0"
                />
                {checkingSlug && (
                  <Loader2 className="mr-3 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
              {slugError ? (
                <p className="text-xs text-red-400">{slugError}</p>
              ) : slug.length >= 3 ? (
                <p className="text-xs text-slate-500">
                  Your dashboard:{" "}
                  <span className="text-violet-400">
                    {typeof window !== "undefined" ? window.location.origin : ""}/{slug}/dashboard
                  </span>
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Only letters, numbers, and hyphens. Min 3 characters.
                </p>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !!slugError || checkingSlug}
              className="mt-2 h-10 w-full bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-500 hover:text-violet-400">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
