// src/app/[slug]/agents/page.tsx
//
// Tenants with their own slug browse at /<slug>/agents. The real page
// lives once at src/app/(dashboard)/agents/page.tsx, so this route just
// forwards there — the same one-line pattern used by every other slug
// route in this folder (see ./widget/page.tsx).
//
// Without this file the sidebar's "AI Agents" link 404s for any tenant
// that has a slug.

import { redirect } from "next/navigation";

export default function Page() {
  redirect("/agents");
}
