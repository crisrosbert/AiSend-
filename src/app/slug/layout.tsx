// src/app/[slug]/layout.tsx
// Wraps all /[slug]/* routes with the existing dashboard layout

import type { Metadata } from "next";
import { DashboardShell } from "@/app/(dashboard)/dashboard-shell";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function SlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
