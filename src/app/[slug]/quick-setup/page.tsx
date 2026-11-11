// src/app/[slug]/quick-setup/page.tsx
//
// Tenants with their own slug open /<slug>/quick-setup from the sidebar.
// The real page lives once at src/app/(dashboard)/quick-setup/page.tsx, so
// this route just forwards there (the same one-line pattern as
// ./agents/page.tsx). Without this file the sidebar link would 404.

import { redirect } from "next/navigation";

export default function Page() {
  redirect("/quick-setup");
}
