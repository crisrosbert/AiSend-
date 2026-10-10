// src/components/ui/stat.tsx
//
// The number components. Three sizes:
//
//   <HeroStat>   The one big number per page (Dashboard, Analytics)
//                — hero band with number, delta chip, sub-copy, sparkline.
//
//   <StatCard>   The 3- or 4-up KPI tiles (Contacts, Campaigns summary)
//                — label, number, delta, nothing else.
//
//   <MiniStat>   Tiny stat row with icon left of a stacked number+label
//                — used inside hero bands and side columns.
//
// Every number is set tabular-nums so columns of stats stay aligned.

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ─────────────────────────────────────────────────────────────────────
   Sparkline — pure SVG, no deps, used inside HeroStat and inline.
   ───────────────────────────────────────────────────────────────────── */
export function Sparkline({
  data,
  color = "var(--brand)",
  height = 50,
  showLastDot = true,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  showLastDot?: boolean;
  className?: string;
}) {
  if (data.length < 2) return null;
  const w = 400;
  const h = height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${w},${h} L 0,${h} Z`;
  const gid = `spark-${color.replace(/[^a-z0-9]/gi, "")}-${data.length}`;
  const lastX = w;
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 6) - 3;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height, display: "block" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {showLastDot && (
        <>
          <circle cx={lastX} cy={lastY} r="3.5" fill={color} />
          <circle cx={lastX} cy={lastY} r="6" fill={color} opacity="0.2" />
        </>
      )}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   HeroStat — the one big number
   ───────────────────────────────────────────────────────────────────── */
export interface HeroStatProps {
  label: ReactNode;
  value: ReactNode;
  /** The +/- change chip. Positive by default; set tone="down" for decreases. */
  delta?: { label: string; tone?: "up" | "down" };
  /** One line of supporting metadata — units, breakdown, context. */
  sub?: ReactNode;
  /** Optional sparkline data. */
  spark?: number[];
  /** Right-hand aside — up to 3 MiniStat rows. */
  aside?: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function HeroStat({ label, value, delta, sub, spark, aside, icon, className }: HeroStatProps) {
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-[16px] border bg-[color:var(--surface)]",
        aside ? "grid-cols-1 md:grid-cols-[1.6fr_1fr]" : "grid-cols-1",
        className,
      )}
      style={{ borderColor: "var(--line)", boxShadow: "var(--shadow-sm)" }}
    >
      {/* ── Left: big number ── */}
      <div
        className="px-6 py-7 md:px-8 md:py-8"
        style={{ borderRight: aside ? "1px solid var(--line)" : undefined }}
      >
        <div
          className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--ink-2)]"
          style={{ letterSpacing: "0.02em" }}
        >
          {icon && (
            <span className="inline-flex" style={{ color: "var(--brand)" }}>
              {icon}
            </span>
          )}
          {label}
        </div>

        <div
          className="mt-3.5 flex items-baseline gap-2.5"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span
            className="font-bold tabular-nums leading-none"
            style={{
              // Matches the Design System v2 preview: 52px desktop, 36px
              // phone — the hero number is the one biggest moment on the
              // page, so we don't downshift it on 1366px laptops.
              fontSize: "clamp(36px, 5vw, 52px)",
              letterSpacing: "-0.03em",
              color: "var(--ink)",
            }}
          >
            {value}
          </span>
          {delta && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[13px] font-semibold"
              style={{
                color: delta.tone === "down" ? "var(--rose)" : "var(--brand-deep)",
                background: delta.tone === "down" ? "var(--rose-50)" : "var(--brand-50)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {delta.tone === "down" ? "↓" : "↑"} {delta.label}
            </span>
          )}
        </div>

        {sub && <p className="mt-2.5 text-[13px] text-[color:var(--ink-2)]">{sub}</p>}

        {spark && spark.length > 1 && (
          <div className="mt-5">
            <Sparkline data={spark} />
          </div>
        )}
      </div>

      {/* ── Right: optional aside with 3 mini stats ── */}
      {aside && (
        <div className="px-6 py-6 md:px-7" style={{ background: "var(--surface-2)" }}>
          <div className="flex h-full flex-col justify-center gap-4">
            {aside}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   StatCard — the 3- or 4-up KPI tiles
   ───────────────────────────────────────────────────────────────────── */
export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  delta?: { label: string; tone?: "up" | "down" };
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  return (
    <div
      className={cn("rounded-[12px] border px-5 py-4", className)}
      style={{
        background: "var(--surface)",
        borderColor: "var(--line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--ink-2)]">
        {icon && (
          <span className="inline-flex" style={{ color: "var(--brand)" }}>
            {icon}
          </span>
        )}
        {label}
      </div>
      <div
        className="mt-2 font-bold tabular-nums leading-none"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "26px",
          letterSpacing: "-0.022em",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
      {delta && (
        <span
          className="mt-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            color: delta.tone === "down" ? "var(--rose)" : "var(--brand-deep)",
            background: delta.tone === "down" ? "var(--rose-50)" : "var(--brand-50)",
          }}
        >
          {delta.tone === "down" ? "↓" : "↑"} {delta.label}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   MiniStat — the small icon+number+label row (goes inside HeroStat aside)
   ───────────────────────────────────────────────────────────────────── */
export interface MiniStatProps {
  value: ReactNode;
  label: ReactNode;
  icon?: ReactNode;
  tone?: "brand" | "amber" | "blue";
  className?: string;
}

export function MiniStat({ value, label, icon, tone = "brand", className }: MiniStatProps) {
  const tones = {
    brand: { bg: "var(--brand-50)",  fg: "var(--brand-deep)" },
    amber: { bg: "var(--amber-50)",  fg: "var(--amber)" },
    blue:  { bg: "var(--blue-50)",   fg: "var(--blue)" },
  };
  const t = tones[tone];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {icon && (
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: t.bg, color: t.fg }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div
          className="font-bold tabular-nums leading-none"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "19px",
            letterSpacing: "-0.015em",
            color: "var(--ink)",
          }}
        >
          {value}
        </div>
        <div className="mt-0.5 text-[12px] text-[color:var(--ink-2)]">{label}</div>
      </div>
    </div>
  );
}
