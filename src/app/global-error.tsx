"use client";

// src/app/global-error.tsx
//
// The last line of defence: an error thrown by the root layout itself.
//
// error.tsx cannot catch this, because it lives *inside* the layout it
// would need to replace. When the root layout throws, Next.js swaps in
// this file instead — which is why it has to render its own <html> and
// <body>, and why it cannot rely on any global CSS the layout was
// responsible for loading. Every style here is inline for that reason.
//
// This should essentially never render. It exists so that if it ever
// does, the customer sees a sentence and a way out rather than a blank
// white page.

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f7f5",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 20px",
              borderRadius: 16,
              background: "#fef2f2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
            }}
            aria-hidden="true"
          >
            !
          </div>

          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0c1f17" }}>
            AiSend couldn&apos;t load
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b" }}>
            Something failed while starting the app. Your data is safe.
          </p>

          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: 24,
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#112118",
              color: "#22c55e",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try again
          </button>

          {error.digest && (
            <p
              style={{
                marginTop: 24,
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                color: "#94a3b8",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
