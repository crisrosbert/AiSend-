"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { BusinessProvider } from "@/hooks/use-business";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      // Background inherits the warm-cream canvas from globals.css —
      // was hardcoded #f4f7f5 (cool grey) which clashed with the rest
      // of the app and made the loading screen look like a different site.
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: "var(--canvas)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    // Shell background uses --canvas from globals.css so one edit retints
    // every page's gutter. Main has NO padding — each page controls its
    // own container padding so hero bands can stretch edge-to-edge.
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--canvas)" }}
    >
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {/* Inside AuthProvider because it needs the signed-in user to know
          which businesses to load, and outside the shell so every page
          and the sidebar switcher read the same selection. */}
      <BusinessProvider>
        <DashboardShellInner>{children}</DashboardShellInner>
      </BusinessProvider>
    </AuthProvider>
  );
}
