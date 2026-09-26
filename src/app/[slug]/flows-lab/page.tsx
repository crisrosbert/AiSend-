// src/app/[slug]/flows-lab/page.tsx
//
// Shim: the sidebar builds links as /{slug}/flows-lab, but the actual
// page lives at /flows-lab under the (dashboard) route group. This
// redirect keeps sidebar links working. Same pattern as
// /[slug]/journeys/page.tsx.

import { redirect } from "next/navigation";

export default function Page() {
  redirect("/flows-lab");
}
