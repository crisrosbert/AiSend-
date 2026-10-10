// src/components/dashboard/activity-feed.tsx
//
// WHAT: One-column vertical feed of activity items (new chats, broadcasts
// finished, leads captured, AI escalations). Used on the Dashboard's
// "Live activity" panel and reused later on Inbox.
//
// WHY A COMPONENT: The old dashboard rendered this inline with page-local
// `cwa-activity-row` CSS. Lifting it into a shared component means the
// style lives in one place and the layout is reusable across pages.
//
// DESIGN SYSTEM CONTRACT:
// - Rows use hairline bottom borders from --line (last row has none).
// - Avatar gradient uses --brand → --brand-deep so one brand change in
//   globals.css recolours every avatar on the feed.
// - Relative times come from date-fns `formatDistanceToNow` so the feed
//   stays accurate without a client timer.
// - When `items` is empty, the component renders the `emptyState` block
//   instead of an empty <ul> — never leaves the panel visually blank.

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Users, Target, Radio, Bot, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActivityItem, ActivityKind } from "@/lib/dashboard/types";

const KIND_ICON: Record<ActivityKind, React.ReactNode> = {
  message: <MessageSquare size={14} />,
  contact: <Users size={14} />,
  deal: <Target size={14} />,
  broadcast: <Radio size={14} />,
  automation: <Bot size={14} />,
};

// Gradient per kind — all drawn from globals.css tokens, so a brand
// change in :root re-tints the whole feed with zero code changes here.
const KIND_GRADIENT: Record<ActivityKind, string> = {
  message:    "linear-gradient(135deg,var(--brand),var(--brand-deep))",
  contact:    "linear-gradient(135deg,var(--blue),#1A4D9C)",
  deal:       "linear-gradient(135deg,var(--amber),#8A6300)",
  broadcast:  "linear-gradient(135deg,var(--violet),#4D3680)",
  automation: "linear-gradient(135deg,var(--teal),#065C58)",
};

export interface ActivityFeedEmptyState {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}

export interface ActivityFeedProps {
  items: ActivityItem[];
  emptyState: ActivityFeedEmptyState;
}

export function ActivityFeed({ items, emptyState }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <div
          className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--brand-50)", color: "var(--brand-deep)" }}
        >
          <Inbox size={24} strokeWidth={1.6} />
        </div>
        <h5
          className="text-[15px] font-semibold text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {emptyState.title}
        </h5>
        <p className="max-w-[280px] text-[13px] leading-relaxed text-[color:var(--ink-2)]">
          {emptyState.body}
        </p>
        {emptyState.cta && (
          <Button
            size="sm"
            variant="default"
            render={<Link href={emptyState.cta.href} />}
            className="mt-2"
          >
            {emptyState.cta.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
      {items.map((item) => (
        <li key={item.id} style={{ borderColor: "var(--line)" }}>
          <ActivityRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const content = (
    <div className="flex items-start gap-3 px-5 py-3">
      <div
        className="mt-0.5 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: KIND_GRADIENT[item.kind] }}
        aria-hidden
      >
        {KIND_ICON[item.kind]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-tight text-[color:var(--ink)]">
          {item.text}
        </p>
        <p className="mt-1 text-[11.5px] text-[color:var(--ink-3)]">
          {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
  // When the row has a target, make the whole thing clickable without
  // breaking screen-reader semantics — <a> wraps the content block.
  if (item.href) {
    return (
      <Link
        href={item.href}
        className="block hover:bg-[color:var(--surface-2)]"
      >
        {content}
      </Link>
    );
  }
  return content;
}
