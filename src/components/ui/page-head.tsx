// src/components/ui/page-head.tsx
//
// The one page header that goes on every /app page: title, subtitle, optional
// "live" chip, and an actions row aligned opposite. One component so every
// page shares the same typographic hierarchy and vertical rhythm.
//
// Usage:
//   <PageHead
//     title="Campaigns"
//     subtitle="21 campaigns · 3 running · ₹18,230 spent this week"
//     live={{ label: "3 campaigns sending" }}
//     actions={<Button>New campaign</Button>}
//   />

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface LiveChip {
  label: string;
  tone?: "accent" | "amber" | "rose";
}

export interface PageHeadProps {
  /** The big display heading. Keep it short (1–3 words). */
  title: string;
  /** A one-line description, metadata, or sub-head. */
  subtitle?: ReactNode;
  /** An optional "Live · N things happening" chip on the right. */
  live?: LiveChip;
  /** CTAs / filters that belong on the right of the title. */
  actions?: ReactNode;
  /** Extra className for the wrapper (margin tweaks, etc). */
  className?: string;
}

export function PageHead({ title, subtitle, live, actions, className }: PageHeadProps) {
  return (
    <header
      className={cn(
        "mb-7 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end",
        className,
      )}
    >
      {/* ── Left: title + subtitle ── */}
      <div className="min-w-0 flex-1">
        <h1
          className="font-display text-[26px] font-bold leading-tight tracking-[-0.025em] text-[color:var(--ink)] sm:text-[30px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[13.5px] text-[color:var(--ink-2)]">{subtitle}</p>
        )}
      </div>

      {/* ── Right: live chip + actions ── */}
      {(live || actions) && (
        <div className="flex flex-shrink-0 flex-col items-start gap-2 sm:items-end">
          {live && <LivePill {...live} />}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
    </header>
  );
}

/**
 * Small animated "Live · N" badge. The pulse is the single piece of
 * non-user-triggered motion on a dashboard — it earns its place by signalling
 * the page is showing live data.
 */
function LivePill({ label, tone = "accent" }: LiveChip) {
  const styles =
    tone === "amber"
      ? {
          color: "var(--amber)",
          background: "var(--amber-50)",
          borderColor: "var(--amber-200)",
        }
      : tone === "rose"
        ? {
            color: "var(--rose)",
            background: "var(--rose-50)",
            borderColor: "var(--rose-200)",
          }
        : {
            color: "var(--brand-deep)",
            background: "var(--brand-50)",
            borderColor: "var(--brand-200)",
          };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em]"
      style={styles}
    >
      <span
        className="relative inline-block h-[7px] w-[7px] rounded-full"
        style={{ background: "currentColor" }}
      >
        <span
          className="absolute animate-pulse-ring rounded-full"
          style={{
            inset: "-3px",
            border: "2px solid currentColor",
            opacity: 0.5,
          }}
          aria-hidden
        />
      </span>
      Live · {label}
    </span>
  );
}
