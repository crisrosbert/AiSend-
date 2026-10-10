// src/components/ui/pill.tsx
//
// Status badges. Five tones, one shape. The colour-plus-dot pattern means
// a status is readable in two reading modes — glance (colour alone) and
// scan (dot + text). Used for campaign status, lead stage, system health.
//
// Usage:
//   <Pill tone="live">Sending</Pill>
//   <Pill tone="sched">Scheduled</Pill>
//   <Pill tone="done">Completed</Pill>
//   <Pill tone="err">14 failed</Pill>
//   <Pill tone="info">Draft</Pill>

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type PillTone = "live" | "sched" | "done" | "err" | "info" | "neutral";

const tones: Record<PillTone, { bg: string; fg: string; border: string }> = {
  live:    { bg: "var(--brand-50)",  fg: "var(--brand-deep)",  border: "var(--brand-200)" },
  sched:   { bg: "var(--amber-50)",  fg: "var(--amber)",       border: "var(--amber-200)" },
  done:    { bg: "var(--canvas)",    fg: "var(--ink-2)",       border: "var(--line)" },
  err:     { bg: "var(--rose-50)",   fg: "var(--rose)",        border: "var(--rose-200)" },
  info:    { bg: "var(--blue-50)",   fg: "var(--blue)",        border: "var(--blue-200)" },
  neutral: { bg: "var(--surface-2)", fg: "var(--ink-3)",       border: "var(--line)" },
};

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  /** Hide the leading dot — use when the pill contains an icon instead. */
  dotless?: boolean;
  className?: string;
}

export function Pill({ tone = "neutral", children, dotless, className }: PillProps) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.01em]",
        className,
      )}
      style={{
        background: t.bg,
        color: t.fg,
        borderColor: t.border,
      }}
    >
      {!dotless && (
        <span
          className="inline-block h-[5px] w-[5px] rounded-full"
          style={{ background: "currentColor" }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
