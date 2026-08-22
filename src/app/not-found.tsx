// src/app/not-found.tsx
//
// The 404. Not a client component — there is nothing interactive here
// beyond links, so it stays static and costs nothing to serve.
//
// Worth having for a reason beyond tidiness: this app hands out public
// URLs (widget embeds, payment returns, unsubscribe links). A stale or
// mistyped one landing on Next's default 404 looks like the whole
// product is down. This one says what happened and offers a way back.

import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: "#f4f7f5" }}
    >
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "#ecfdf5", color: "#059669" }}
        >
          <Compass className="h-7 w-7" />
        </div>

        <p
          className="text-[13px] font-bold tracking-[0.08em]"
          style={{ color: "#9aa8a0" }}
        >
          404
        </p>
        <h1 className="mt-1 text-xl font-bold" style={{ color: "#0c1f17" }}>
          Page not found
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The link may be out of date, or the page may have been moved.
        </p>

        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: "#112118", color: "#22c55e" }}
          >
            <Home className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
