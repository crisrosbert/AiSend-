"use client";

// src/app/error.tsx
//
// What a customer sees when something throws.
//
// Without this file Next.js renders its own unstyled error screen — in
// production that is a bare "Application error: a client-side exception
// has occurred", which tells the person nothing, tells us nothing, and
// looks like the product is broken rather than like one page failed.
//
// This boundary wraps every route below it. It does NOT wrap the root
// layout — global-error.tsx covers that.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCw } from "lucide-react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Goes to the Vercel function logs. The digest is the only thing
    // that ties what the customer saw to a specific server-side stack
    // trace, so it is logged and shown rather than swallowed.
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "#fef2f2", color: "#dc2626" }}
        >
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h1 className="text-xl font-bold" style={{ color: "#0c1f17" }}>
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          This page didn&apos;t load properly. Your data is safe — nothing was
          lost.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {/* Re-fetches and re-renders this segment. In this version of
              Next that is unstable_retry(), not reset() — reset only
              clears the error state without re-fetching, which usually
              just shows the same failure again. */}
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: "#112118", color: "#22c55e" }}
          >
            <RotateCw className="h-4 w-4" />
            Try again
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            style={{ borderColor: "#e8ede9" }}
          >
            <Home className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>

        {/* Shown, not hidden: when someone reports "it broke", this code
            is what makes the report actionable. */}
        {error.digest && (
          <p className="mt-6 font-mono text-[11px] text-slate-400">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
