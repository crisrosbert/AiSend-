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
  Clock,
  Users,
  GitBranch,
  Radio,
  Zap,
  Workflow,
  Boxes,
  Settings,
  Wallet,
  LogOut,
  X,
  ChevronRight,
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
  { path: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "inbox", label: "Live Chat", icon: MessageSquare },
  { path: "recent", label: "Recent", icon: Clock },
  { path: "contacts", label: "Contacts", icon: Users },
  { path: "pipelines", label: "Pipelines", icon: GitBranch },
  { path: "broadcasts", label: "Campaigns", icon: Radio },
  { path: "automations", label: "Automations", icon: Zap },
  { path: "journeys", label: "Journeys", icon: Workflow },
  { path: "integrations", label: "Integrations", icon: Boxes },
];

const bottomNavItems = [
  { path: "billing", label: "Billing", icon: Wallet },
  { path: "settings", label: "Settings", icon: Settings },
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
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col",
          "bg-[#0d0d18] border-r border-white/5",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Primary"
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/5 px-4">
          <Link href={href("dashboard")} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-700 text-white leading-tight tracking-tight">
                Clickstream <span className="text-emerald-400">WA</span>
              </span>
              {profile?.business_name && (
                <span className="text-[10px] text-slate-500 leading-tight truncate max-w-[120px]">
                  {profile.business_name}
                </span>
              )}
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const showBadge = item.path === "inbox" && totalUnread > 0 && !active;
              return (
                <li key={item.path}>
                  <Link
                    href={href(item.path)}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "text-slate-500 hover:bg-white/5 hover:text-slate-200",
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-400")} />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-600 text-white">
                        {totalUnread > 99 ? "99+" : totalUnread}
                      </span>
                    )}
                    {active && <ChevronRight className="h-3.5 w-3.5 text-emerald-500/50" />}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-3 border-t border-white/5" />

          <ul className="flex flex-col gap-0.5">
            {bottomNavItems.map((item) => {
              const active = isActive(item.path);
              return (
                <li key={item.path}>
                  <Link
                    href={href(item.path)}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "text-slate-500 hover:bg-white/5 hover:text-slate-200",
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-400")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-white/5 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5 focus:outline-none">
              <Avatar className="size-8 shrink-0 ring-1 ring-white/10">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />}
                <AvatarFallback className="bg-emerald-500/10 text-xs font-600 text-emerald-400">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ?? profile?.email?.charAt(0)?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-600 text-white">{profile?.full_name ?? "User"}</p>
                <p className="truncate text-[10px] text-slate-500">{profile?.email ?? ""}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={6}
              className="min-w-52 border-white/10 bg-[#0d0d18] text-slate-200">
              <DropdownMenuItem render={<Link href={`${slugPrefix}/billing`} onClick={onClose} className="focus:bg-white/5" />}>
                <Wallet className="size-4 text-slate-500" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`${slugPrefix}/settings?tab=profile`} onClick={onClose} className="focus:bg-white/5" />}>
                <Settings className="size-4 text-slate-500" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={signOut} className="focus:bg-white/5 text-red-400 focus:text-red-400">
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
