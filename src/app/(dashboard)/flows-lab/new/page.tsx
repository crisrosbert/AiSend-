"use client";

// src/app/(dashboard)/flows-lab/new/page.tsx
//
// Create a Lab flow, either blank or seeded from a starter template.
// Behaves as a Suspense boundary because Next 16 requires useSearchParams
// to sit inside one.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { FLOW_TEMPLATES } from "@/lib/flows-lab/templates";
import { saveFlow } from "@/lib/flows-lab/storage";
import type { FlowDefinition } from "@/lib/flows-lab/types";
import { newScreen } from "@/lib/flows-lab/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function CreateFlowContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;
    const templateKey = params.get("template");
    const now = new Date().toISOString();

    // Either seed from a template (deep-cloned so edits don't mutate
    // the shared object) or start blank with one empty screen.
    let flow: FlowDefinition;
    if (templateKey && FLOW_TEMPLATES[templateKey]) {
      const seed = JSON.parse(JSON.stringify(FLOW_TEMPLATES[templateKey])) as Omit<
        FlowDefinition,
        "id" | "userId" | "createdAt" | "updatedAt" | "version" | "status"
      >;
      flow = {
        ...seed,
        id: crypto.randomUUID(),
        userId: profile.id,
        version: 1,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        metrics: { started: 0, completed: 0 },
      };
    } else {
      const firstScreen = newScreen("Welcome");
      flow = {
        id: crypto.randomUUID(),
        userId: profile.id,
        version: 1,
        status: "draft",
        name: "Untitled flow",
        description: "",
        category: "custom",
        startScreenId: firstScreen.id,
        screens: [firstScreen],
        createdAt: now,
        updatedAt: now,
        metrics: { started: 0, completed: 0 },
      };
    }

    saveFlow(flow);
    toast.success(templateKey ? "Flow created from template" : "Blank flow created");
    router.replace(`/${profile.slug ?? ""}/flows-lab/${flow.id}/builder`);
  }, [profile, params, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm text-slate-600">Setting up your flow…</p>
      </div>
    </div>
  );
}

export default function NewFlowPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <CreateFlowContent />
    </Suspense>
  );
}
