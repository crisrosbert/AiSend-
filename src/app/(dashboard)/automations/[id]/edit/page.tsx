"use client"

import { use, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { ReactFlowProvider } from "reactflow"
import { FlowCanvas } from "@/components/automations/flow-canvas"
import {
  fromServerSteps,
  type BuilderInitial,
  type ServerStepNode,
} from "@/components/automations/automation-builder"
import type { AutomationTriggerType } from "@/types"

export default function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [initial, setInitial] = useState<BuilderInitial | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/automations/${id}`)
      if (!res.ok) {
        if (!cancelled) setError(`Failed to load automation (${res.status})`)
        return
      }
      const body = await res.json()
      if (cancelled) return
      setInitial({
        id: body.automation.id,
        name: body.automation.name ?? "",
        description: body.automation.description ?? "",
        trigger_type: body.automation.trigger_type as AutomationTriggerType,
        trigger_config: body.automation.trigger_config ?? {},
        is_active: !!body.automation.is_active,
        steps: fromServerSteps((body.steps ?? []) as ServerStepNode[]),
      })
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950">
        <p className="text-sm text-red-400">{error}</p>
        <a href="/automations" className="text-sm text-violet-400 hover:text-violet-300">
          ← Back to Automations
        </a>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="size-6 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <FlowCanvas initial={initial} />
    </ReactFlowProvider>
  )
}
