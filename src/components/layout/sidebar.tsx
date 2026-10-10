"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  LayoutDashboard,
  MessageSquare,
  History,
  Users,
  UserPlus,
  Radio,
  Zap,
  Settings,
  Wallet,
  Activity,
  LogOut,
  X,
  GitBranch,
  CalendarCheck,
  Globe,
  Bot,
  Workflow,
  BarChart3,
  ShoppingCart,
  FlaskConical,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { path: "dashboard",   label: "Dashboard",        icon: LayoutDashboard },
  { path: "analytics",   label: "Analytics",        icon: BarChart3 },
  { path: "agents",      label: "AI Agents",        icon: Bot },
  { path: "ai-agent",    label: "Shop Agent",       icon: ShoppingCart },
  { path: "inbox",       label: "Live Chat",        icon: MessageSquare },
  { path: "recent",      label: "Recent",           icon: History },
  { path: "contacts",    label: "Contacts",         icon: Users },
  { path: "pipelines",   label: "Pipelines",        icon: GitBranch },
  { path: "broadcasts",  label: "Campaigns",        icon: Radio },
  { path: "journeys",    label: "Chat Flows",       icon: Workflow },
  { path: "flows-lab",   label: "Flows Lab",        icon: FlaskConical, beta: true },
  { path: "automations", label: "Automation Rules", icon: Zap },
  { path: "bookings",    label: "Bookings",         icon: CalendarCheck },
  { path: "leads",       label: "Leads",            icon: UserPlus },
  { path: "widget",      label: "Website Widget",   icon: Globe },
];

const bottomNavItems = [
  { path: "health",   label: "System Health", icon: Activity },
  { path: "billing",  label: "Billing",       icon: Wallet, absolute: true },
  { path: "settings", label: "Settings",      icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const totalUnread = useTotalUnread();

  const slugPrefix = profile?.slug ? `/${profile.slug}` : "";
  const href = (path: string) => `${slugPrefix}/${path}`;

  const isActive = (path: string) => {
    const full = href(path);
    const legacy = `/${path}`;
    if (path === "dashboard") return pathname === full || pathname === legacy;
    return pathname.startsWith(full) || pathname.startsWith(legacy);
  };

  useEffect(() => { onClose?.(); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full flex-col",
          "transition-transform duration-200 ease-out will-change-transform",
          "w-64",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:w-[72px] lg:translate-x-0 lg:transition-none",
        )}
        style={{ background: "var(--brand-teal-dark)" }}
        aria-label="Primary navigation"
      >
        {/* ── Logo / Brand ── */}
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-white/5 px-2">
          <Link
            href={href("dashboard")}
            className="flex items-center justify-center"
            title="AiSend"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-deep))" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M10.5 2L4 10.5H9L7.5 16L14 7.5H9L10.5 2Z"
                  fill="white"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Main Nav ── */}
        <nav className="flex flex-1 flex-col overflow-y-auto py-3">
          <ul className="flex flex-col items-center gap-0.5 px-2">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const showBadge = item.path === "inbox" && totalUnread > 0;
              const isBeta = (item as { beta?: boolean }).beta === true;
              return (
                <li key={item.path} className="w-full">
                  <Link
                    href={href(item.path)}
                    title={item.label}
                    className={cn(
                      "group relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-all duration-150",
                      "lg:flex-col",
                      active
                        ? "text-white"
                        : "text-white/40 hover:bg-white/5 hover:text-white/80",
                    )}
                    style={active ? { background: "rgba(0,168,107,.14)" } : undefined}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full"
                        style={{ background: "#4ADE80" }}
                      />
                    )}

                    <div className="relative">
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active ? "" : "group-hover:text-white/80",
                        )}
                        style={active ? { color: "#4ADE80" } : undefined}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      {showBadge && (
                        <span
                          className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white"
                          style={{ background: "var(--brand)" }}
                        >
                          {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                      )}
                      {isBeta && (
                        <span className="absolute -right-2 -top-1.5 flex h-3.5 items-center justify-center rounded-md bg-amber-500 px-1 text-[7.5px] font-bold text-white">
                          β
                        </span>
                      )}
                    </div>

                    <span
                      className={cn(
                        "text-center font-medium leading-none",
                        "hidden lg:block",
                        "text-[9.5px] tracking-wide",
                        active ? "" : "text-white/40 group-hover:text-white/70",
                      )}
                      style={active ? { color: "#4ADE80" } : undefined}
                    >
                      {item.label}
                    </span>

                    <span className="ml-3 flex-1 text-sm font-medium lg:hidden">
                      {item.label}
                      {isBeta && (
                        <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                          BETA
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-2 mx-3 border-t border-white/5" />

          <ul className="flex flex-col items-center gap-0.5 px-2">
            {bottomNavItems.map((item) => {
              const active = isActive(item.path);
              return (
                <li key={item.path} className="w-full">
                  <Link
                    href={(item as { absolute?: boolean }).absolute ? `/${item.path}` : href(item.path)}
                    title={item.label}
                    className={cn(
                      "group relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-all duration-150",
                      active ? "text-white" : "text-white/40 hover:bg-white/5 hover:text-white/80",
                    )}
                    style={active ? { background: "rgba(0,168,107,.14)" } : undefined}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full"
                        style={{ background: "#4ADE80" }}
                      />
                    )}
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        active ? "" : "group-hover:text-white/80",
                      )}
                      style={active ? { color: "#4ADE80" } : undefined}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                    <span className="hidden text-[9.5px] font-medium tracking-wide text-white/40 group-hover:text-white/70 lg:block">
                      {item.label}
                    </span>
                    <span className="ml-3 flex-1 text-sm font-medium lg:hidden">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── User Avatar (bottom) ── */}
        <div className="shrink-0 border-t border-white/5 py-3 flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors hover:bg-white/5 focus:outline-none w-full mx-2">
              <Avatar className="size-8 ring-1 ring-white/10">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />
                )}
                <AvatarFallback
                  className="text-xs font-bold"
                  style={{ background: "linear-gradient(135deg,var(--brand),var(--brand-deep))", color: "#fff" }}
                >
                  {initial}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-[9.5px] font-medium tracking-wide text-white/40 lg:block">
                Account
              </span>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              side="right"
              sideOffset={8}
              className="min-w-52 border-white/10 text-slate-200"
              style={{ background: "var(--brand-teal-dark)" }}
            >
              <div className="px-3 py-2 border-b border-white/5">
                <p className="text-sm font-semibold text-white truncate">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="text-[11px] text-white/40 truncate">{profile?.email ?? ""}</p>
              </div>

              <DropdownMenuItem
                render={
                  <Link
                    href="/billing"
                    onClick={onClose}
                    className="focus:bg-white/5"
                  />
                }
              >
                <Wallet className="size-4 text-white/40" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href={`${slugPrefix}/settings?tab=profile`}
                    onClick={onClose}
                    className="focus:bg-white/5"
                  />
                }
              >
                <Settings className="size-4 text-white/40" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem
                onClick={signOut}
                className="focus:bg-white/5 text-red-400 focus:text-red-400"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
