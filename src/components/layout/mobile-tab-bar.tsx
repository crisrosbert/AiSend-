"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { LayoutDashboard, MessageSquare, Users, Radio, Settings } from "lucide-react";

/* Bottom tab bar — mobile only (hidden on lg+). Gives the app a
 * native feel. AiSensy has no equivalent. */
const tabs = [
  { path: "dashboard",  label: "Home",      icon: LayoutDashboard },
  { path: "inbox",      label: "Chat",      icon: MessageSquare, badge: true },
  { path: "broadcasts", label: "Campaigns", icon: Radio },
  { path: "contacts",   label: "Contacts",  icon: Users },
  { path: "settings",   label: "Settings",  icon: Settings },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const totalUnread = useTotalUnread();

  const slugPrefix = profile?.slug ? `/${profile.slug}` : "";
  const href = (path: string) => `${slugPrefix}/${path}`;

  const isActive = (path: string) => {
    const full = href(path);
    const legacy = `/${path}`;
    if (path === "dashboard") return pathname === full || pathname === legacy;
    return pathname.startsWith(full) || pathname.startsWith(legacy);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch justify-around border-t bg-white lg:hidden"
      style={{
        borderColor: "#e8edf0",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "0 -2px 16px rgba(15,23,42,.06)",
      }}
      aria-label="Bottom navigation"
    >
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        const showBadge = tab.badge && totalUnread > 0;
        return (
          <Link
            key={tab.path}
            href={href(tab.path)}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
            )}
            style={{ color: active ? "#16a34a" : "#94a3b8" }}
          >
            <div className="relative">
              <tab.icon
                size={22}
                strokeWidth={active ? 2.4 : 1.9}
              />
              {showBadge && (
                <span
                  className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: "#16a34a" }}
                >
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <span
              className="text-[10px] font-semibold tracking-tight"
              style={{ color: active ? "#16a34a" : "#94a3b8" }}
            >
              {tab.label}
            </span>
            {active && (
              <span
                className="absolute top-0 h-0.5 w-8 rounded-b-full"
                style={{ background: "#16a34a" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
