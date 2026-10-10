// src/components/dashboard/insight-card.tsx
//
// WHAT: The small "Best time to send" / "Template health" / "Account
// quality" cards that sit in a 3-up row beneath the hero on Dashboard
// (and will be reused on Analytics later).
//
// WHY A COMPONENT: Three cards with identical shape, different content.
// Hard-coding each would guarantee drift the moment anyone tweaks the
// padding or the pill alignment. One component, three invocations.
//
// DESIGN SYSTEM CONTRACT:
// - Wraps a <Panel>, inheriting hairline border and shadow from the
//   global component — not a hand-rolled card.
// - Big value uses --font-display + tabular-nums so numbers line up
//   across cards without horizontal shift.
// - Footer border is dashed, not solid, to signal it's metadata rather
//   than a true section split.

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { Pill, type PillTone } from "@/components/ui/pill";

export interface InsightCardProps {
  /** Small icon rendered in the header tile (lucide 16px looks right). */
  icon: ReactNode;
  /** The card's title — 13px display, left-aligned. */
  title: string;
  /** The hero value for this insight (number, label, or short phrase). */
  value: ReactNode;
  /** Optional unit shown after the value in muted type. */
  unit?: string;
  /** One sentence of context — up to ~32ch wide. */
  copy: string;
  /** Optional metadata on the left of the footer. */
  footLeft?: string;
  /** Optional action link on the right of the footer. */
  footRight?: { label: string; href: string };
  /** Optional status pill shown in the top-right of the header row. */
  pill?: { tone: PillTone; text: string };
}

export function InsightCard({
  icon,
  title,
  value,
  unit,
  copy,
  footLeft,
  footRight,
  pill,
}: InsightCardProps) {
  const hasFooter = Boolean(footLeft || footRight);
  return (
    <Panel className="p-5">
      {/* Header row: icon tile + title + optional pill */}
      <div className="mb-3.5 flex items-center gap-2.5">
        <div
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: "var(--canvas)", color: "var(--brand-deep)" }}
        >
          {icon}
        </div>
        <h4
          className="text-[13px] font-semibold text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h4>
        {pill && (
          <span className="ml-auto">
            <Pill tone={pill.tone}>{pill.text}</Pill>
          </span>
        )}
      </div>

      {/* Big value — tabular so it aligns across the row of three cards */}
      <div
        className="flex items-baseline gap-1.5 font-bold leading-none tabular-nums"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "30px",
          letterSpacing: "-0.025em",
          color: "var(--ink)",
        }}
      >
        {value}
        {unit && (
          <span
            className="text-[14px] font-medium"
            style={{ color: "var(--ink-3)" }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Context copy */}
      <p
        className="mt-2 text-[12.5px] leading-[1.5] text-[color:var(--ink-2)]"
        style={{ maxWidth: "32ch" }}
      >
        {copy}
      </p>

      {/* Footer — only renders when there's something to put there */}
      {hasFooter && (
        <div
          className="mt-3.5 flex items-center justify-between pt-3 text-[11.5px]"
          style={{
            borderTop: "1px dashed var(--line)",
            color: "var(--ink-3)",
          }}
        >
          <span>{footLeft}</span>
          {footRight && (
            <Link
              href={footRight.href}
              className="font-semibold no-underline hover:underline"
              style={{ color: "var(--brand-deep)" }}
            >
              {footRight.label} →
            </Link>
          )}
        </div>
      )}
    </Panel>
  );
}
