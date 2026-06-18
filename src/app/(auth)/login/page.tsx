"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, ArrowRight, Zap } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-transparent to-transparent" />
        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-60 h-60 bg-emerald-400/5 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-700 text-white tracking-tight">
            Clickstream <span className="text-emerald-400">WA</span>
          </span>
        </div>

        {/* Main content */}
        <div className="relative space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
              <Zap className="h-3 w-3" />
              Powered by WhatsApp Business API
            </div>
            <h1 className="font-display text-5xl font-800 leading-tight text-white">
              Your WhatsApp<br />
              <span className="text-emerald-400">Growth Engine</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed max-w-sm">
              Send broadcasts, manage conversations, and automate follow-ups — all from one powerful dashboard.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "10x", label: "Faster Outreach" },
              { value: "98%", label: "Delivery Rate" },
              { value: "3min", label: "Setup Time" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                <p className="font-display text-2xl font-700 text-emerald-400">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative">
          <p className="text-sm text-slate-600">
            © 2026 Clickstream Performance Marketing. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-700 text-white">
              Clickstream <span className="text-emerald-400">WA</span>
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-3xl font-700 text-white">Welcome back</h2>
            <p className="text-slate-400">Sign in to your CRM dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-slate-800 bg-slate-900 text-white placeholder:text-slate-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </Label>
                <Link href="/forgot-password" className="text-xs text-emerald-500 hover:text-emerald-400">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 border-slate-800 bg-slate-900 text-white placeholder:text-slate-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-400 disabled:opacity-50 transition-all duration-200 group"
            >
              {loading ? (
                "Signing in..."
              ) : (
                <span className="flex items-center gap-2">
                  Sign in
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-emerald-500 hover:text-emerald-400">
              Get started free
            </Link>
          </p>

          <p className="text-center text-xs text-slate-700">
            By signing in, you agree to our{" "}
            <a href="https://performancemktg.net/privacy-policy/" target="_blank" className="text-slate-600 hover:text-slate-400">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
