"use client";

// Shared tab bar for the Leads section. Plain /leads/* links (not slug
// prefixed) on purpose: the slug-prefixed `[slug]/leads` route only
// redirects its index page, so sub-pages exist only at these paths.

import Link from "next/link";
import { Users, Globe, Plug, MessageCircle, MousePointerClick } from "lucide-react";

const TABS = [
  { id: "all", href: "/leads", label: "All leads", icon: Users },
  { id: "whatsapp", href: "/leads/whatsapp", label: "WhatsApp Marketing", icon: MessageCircle },
  { id: "website", href: "/leads/website", label: "Website chats", icon: Globe },
  { id: "clicks", href: "/leads/clicks", label: "Clicks", icon: MousePointerClick },
  { id: "sources", href: "/leads/sources", label: "Lead sources", icon: Plug },
] as const;

export type LeadsTabId = (typeof TABS)[number]["id"];

export function LeadsTabs({ active }: { active: LeadsTabId }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {TABS.map(({ id, href, label, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
            active === id
              ? "border-transparent bg-emerald-500 text-white"
              : "border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-300"
          }`}
        >
          <Icon className="size-3.5" />
          {label}
        </Link>
      ))}
    </div>
  );
}
