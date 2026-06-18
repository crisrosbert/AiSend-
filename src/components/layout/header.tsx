"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Menu, Settings as SettingsIcon, User, Zap } from "lucide-react";
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

const pageTitles: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/inbox":       "Live Chat",
  "/contacts":    "Contacts",
  "/pipelines":   "Pipelines",
  "/broadcasts":  "Campaigns",
  "/automations": "Automations",
  "/settings":    "Settings",
  "/billing":     "Billing",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.includes(path),
  );
  return match ? match[1] : "Dashboard";
}

interface HeaderProps {
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const title = getPageTitle(pathname);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  const businessName = profile?.business_name ?? profile?.full_name ?? "Your Business";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-white px-4 lg:px-6"
      style={{ borderColor: "#e8ede9" }}>

      {/* Left — hamburger + business name */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 lg:hidden"
          style={{ color: "#112118" }}
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="truncate text-base font-bold" style={{ color: "#0c1f17" }}>
          {businessName}
        </span>
      </div>

      {/* Right — status badges + plan + avatar */}
      <div className="flex items-center gap-2">
        {/* WhatsApp API Status */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="text-xs text-slate-500 font-medium">WhatsApp Business API Status :</span>
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold"
            style={{ background: "#ecfdf5", color: "#059669" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            LIVE
          </span>
        </div>

        {/* Separator */}
        <div className="hidden h-5 w-px bg-slate-200 sm:block" />

        {/* Current Plan badge */}
        <Link
          href="/billing"
          className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors hover:opacity-90 sm:inline-flex"
          style={{ background: "#112118", color: "#22c55e" }}
        >
          <Zap className="h-3.5 w-3.5" fill="#22c55e" />
          Explore Plans
        </Link>

        {/* Avatar / account dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50 focus:outline-none"
            aria-label="Open account menu"
          >
            <Avatar className="size-8">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? "Avatar"} />
              ) : null}
              <AvatarFallback
                className="text-sm font-bold"
                style={{ background: "#059669", color: "#fff" }}
              >
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-56 text-slate-700"
            style={{ background: "#fff", border: "1px solid #e8ede9" }}
          >
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="truncate text-sm font-semibold text-slate-900">
                {profile?.full_name ?? "User"}
              </p>
              <p className="truncate text-xs text-slate-400">{profile?.email ?? ""}</p>
            </div>
            <DropdownMenuItem
              render={<Link href="/settings?tab=profile" className="focus:bg-slate-50" />}
            >
              <User className="size-4 text-slate-400" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href="/settings?tab=whatsapp" className="focus:bg-slate-50" />}
            >
              <SettingsIcon className="size-4 text-slate-400" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem
              onClick={signOut}
              className="text-red-500 focus:bg-red-50 focus:text-red-600"
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
