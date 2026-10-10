// src/components/ui/panel.tsx
//
// The one card wrapper used across the app: hairline border, no stacked
// shadows, and a tidy header slot with tabs/actions aligned to the right.
// Replaces the mix of hand-rolled card markup you'll find across pages.
//
// Why this exists: AiSend's design-system v2 rule — one radius, one shadow,
// one border weight for every card. If a page needs a different treatment,
// pass it in; don't fork the component.
//
// Usage:
//   <Panel>
//     <PanelHead title="Active campaigns" actions={<Tabs .../>} />
//     <PanelBody>…</PanelBody>
//   </Panel>

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Removes default padding on body — use when embedding a table. */
  flush?: boolean;
}

export function Panel({ children, className, flush }: PanelProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[14px] border bg-[color:var(--surface)]",
        className,
      )}
      style={{
        borderColor: "var(--line)",
        boxShadow: "var(--shadow-sm)",
      }}
      data-flush={flush ? "true" : undefined}
    >
      {children}
    </section>
  );
}

export interface PanelHeadProps {
  title: ReactNode;
  /** Smaller caption below the title. */
  subtitle?: ReactNode;
  /** Right-aligned content — tabs, filters, actions. */
  actions?: ReactNode;
  className?: string;
}

export function PanelHead({ title, subtitle, actions, className }: PanelHeadProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-4 border-b px-5 py-3.5",
        className,
      )}
      style={{ borderColor: "var(--line)" }}
    >
      <div className="min-w-0">
        <h3
          className="text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-[color:var(--ink-3)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PanelBody({
  children,
  className,
  flush,
}: {
  children: ReactNode;
  className?: string;
  /** No padding — for tables that should sit flush to the border. */
  flush?: boolean;
}) {
  return (
    <div
      className={cn(flush ? "" : "px-5 py-4", className)}
    >
      {children}
    </div>
  );
}

/**
 * Tabs built for a PanelHead's actions slot. Pills, not underlines — the
 * underline treatment collides with the hairline border above.
 */
export function PanelTabs({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-[color:var(--canvas)] p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
              active
                ? "bg-white text-[color:var(--ink)] shadow-[0_1px_2px_rgba(14,31,24,.06)]"
                : "text-[color:var(--ink-2)] hover:text-[color:var(--ink)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
