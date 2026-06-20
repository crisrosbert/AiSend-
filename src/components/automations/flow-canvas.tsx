"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from "reactflow"
import "reactflow/dist/style.css"
import { toast } from "sonner"
import {
  ArrowLeft, Save, Loader2, Plus, X, Trash2, Zap,
  MessageSquare, FileText, Tag, TagIcon, UserCheck, PencilLine,
  Briefcase, Hourglass, GitBranch, Webhook, CircleSlash, Play, Pause,
  ChevronDown, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { AutomationStepType, AutomationTriggerType } from "@/types"
import { toApiSteps, type BuilderInitial, type BuilderStep } from "./automation-builder"

// ─── Step metadata ────────────────────────────────────────────────────────────

interface StepMeta {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string      // bg color for node header
  group: "message" | "action" | "logic"
}

const STEP_META: Record<AutomationStepType, StepMeta> = {
  send_message:         { label: "Send Message",         icon: MessageSquare, color: "#7c3aed", group: "message" },
  send_template:        { label: "Send Template",        icon: FileText,      color: "#7c3aed", group: "message" },
  add_tag:              { label: "Add Tag",              icon: Tag,           color: "#0891b2", group: "action"  },
  remove_tag:           { label: "Remove Tag",           icon: TagIcon,       color: "#0891b2", group: "action"  },
  assign_conversation:  { label: "Assign Agent",         icon: UserCheck,     color: "#0891b2", group: "action"  },
  update_contact_field: { label: "Update Field",         icon: PencilLine,    color: "#0891b2", group: "action"  },
  create_deal:          { label: "Create Deal",          icon: Briefcase,     color: "#059669", group: "action"  },
  wait:                 { label: "Wait",                 icon: Hourglass,     color: "#64748b", group: "logic"   },
  condition:            { label: "Condition",            icon: GitBranch,     color: "#d97706", group: "logic"   },
  send_webhook:         { label: "Send Webhook",         icon: Webhook,       color: "#6366f1", group: "action"  },
  close_conversation:   { label: "Close Conversation",   icon: CircleSlash,   color: "#dc2626", group: "action"  },
}

const PALETTE_GROUPS: { label: string; types: AutomationStepType[] }[] = [
  { label: "Message",  types: ["send_message", "send_template"] },
  { label: "Actions",  types: ["add_tag", "remove_tag", "assign_conversation", "update_contact_field", "create_deal", "send_webhook", "close_conversation"] },
  { label: "Logic",    types: ["wait", "condition"] },
]

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string }[] = [
  { value: "new_message_received",  label: "New message received"       },
  { value: "first_inbound_message", label: "First message from contact" },
  { value: "keyword_match",         label: "Keyword match"              },
  { value: "new_contact_created",   label: "New contact created"        },
  { value: "conversation_assigned", label: "Conversation assigned"      },
  { value: "tag_added",             label: "Tag added to contact"       },
  { value: "time_based",            label: "Time-based (schedule)"      },
]

// ─── Canvas node types ────────────────────────────────────────────────────────

function TriggerNode({ data }: NodeProps) {
  return (
    <div
      className="rounded-xl shadow-lg overflow-hidden cursor-pointer"
      style={{ minWidth: 220, border: "2px solid #10b981" }}
      onClick={data.onClickTrigger}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
        <div className="flex size-6 items-center justify-center rounded-md bg-white/20">
          <Zap className="size-3.5 text-white" />
        </div>
        <span className="text-xs font-bold text-white uppercase tracking-wide">Trigger</span>
      </div>
      <div className="bg-slate-900 px-3 py-2">
        <p className="text-xs font-semibold text-white">
          {TRIGGER_OPTIONS.find((t) => t.value === data.triggerType)?.label ?? "Set trigger"}
        </p>
        {data.triggerType === "keyword_match" && data.keywords?.length > 0 && (
          <p className="mt-0.5 text-[10px] text-slate-400 truncate">
            Keywords: {data.keywords.join(", ")}
          </p>
        )}
        {data.triggerType === "time_based" && data.schedule && (
          <p className="mt-0.5 text-[10px] text-slate-400">{data.schedule}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-emerald-400 !bg-slate-900" />
    </div>
  )
}

function StepNode({ data, selected }: NodeProps) {
  const meta = STEP_META[data.stepType as AutomationStepType] ?? STEP_META.send_message
  const Icon = meta.icon
  const preview = getStepPreview(data.stepType, data.config ?? {})
  const isCondition = data.stepType === "condition"

  return (
    <div
      className="rounded-xl shadow-lg overflow-hidden"
      style={{
        minWidth: 220,
        border: selected ? `2px solid ${meta.color}` : "2px solid #1e293b",
        cursor: "pointer",
      }}
      onClick={data.onClickStep}
    >
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-slate-400 !bg-slate-900" />

      <div className="flex items-center gap-2 px-3 py-2" style={{ background: meta.color }}>
        <div className="flex size-6 items-center justify-center rounded-md bg-white/20">
          <Icon className="size-3.5 text-white" />
        </div>
        <span className="flex-1 text-xs font-bold text-white">{meta.label}</span>
        <button
          className="rounded p-0.5 text-white/60 hover:bg-white/20 hover:text-white"
          onClick={(e) => { e.stopPropagation(); data.onDelete?.() }}
        >
          <X className="size-3" />
        </button>
      </div>

      <div className="bg-slate-900 px-3 py-2">
        <p className="text-[11px] text-slate-300 line-clamp-2">{preview || "Click to configure…"}</p>
      </div>

      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ left: "35%", background: "#10b981", borderColor: "#10b981" }}
            className="!h-3 !w-3 !border-2"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ left: "65%", background: "#ef4444", borderColor: "#ef4444" }}
            className="!h-3 !w-3 !border-2"
          />
          <div className="flex bg-slate-800 px-3 py-1 text-[9px] font-bold">
            <span className="flex-1 text-emerald-400">✓ YES</span>
            <span className="flex-1 text-right text-red-400">✗ NO</span>
          </div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-slate-400 !bg-slate-900" />
      )}
    </div>
  )
}

function getStepPreview(type: AutomationStepType, config: Record<string, unknown>): string {
  switch (type) {
    case "send_message":      return (config.text as string) || ""
    case "send_template":     return (config.template_name as string) || ""
    case "add_tag":
    case "remove_tag":        return config.tag_id ? `Tag: ${config.tag_id}` : ""
    case "wait":              return config.amount ? `${config.amount} ${config.unit}` : ""
    case "condition":         return config.subject ? `If ${config.subject}` : ""
    case "send_webhook":      return (config.url as string) || ""
    case "close_conversation":return "Close this conversation"
    case "create_deal":       return (config.title as string) || ""
    case "assign_conversation":return config.mode ? `Mode: ${config.mode}` : ""
    case "update_contact_field": return config.field ? `${config.field} = ${config.value}` : ""
    default:                  return ""
  }
}

const nodeTypes: NodeTypes = { trigger: TriggerNode, step: StepNode }

// ─── Config panel ─────────────────────────────────────────────────────────────

function ConfigPanel({
  stepType,
  config,
  onChange,
  onClose,
}: {
  stepType: AutomationStepType
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
  onClose: () => void
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...config, ...patch })

  return (
    <aside className="flex h-full w-72 flex-col border-l border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className="text-sm font-semibold text-white">{STEP_META[stepType]?.label ?? stepType}</span>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {stepType === "send_message" && (
          <Field label="Message text">
            <textarea
              value={(config.text as string) ?? ""}
              onChange={(e) => set({ text: e.target.value })}
              rows={5}
              placeholder="Hi {{name}}! Thanks for your message…"
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-500"
            />
          </Field>
        )}

        {stepType === "send_template" && (
          <>
            <Field label="Template name">
              <Input
                value={(config.template_name as string) ?? ""}
                onChange={(e) => set({ template_name: e.target.value })}
                placeholder="e.g. order_confirmation"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </Field>
            <Field label="Language">
              <Input
                value={(config.language as string) ?? "en_US"}
                onChange={(e) => set({ language: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </Field>
          </>
        )}

        {(stepType === "add_tag" || stepType === "remove_tag") && (
          <Field label="Tag ID">
            <Input
              value={(config.tag_id as string) ?? ""}
              onChange={(e) => set({ tag_id: e.target.value })}
              placeholder="Paste tag UUID…"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </Field>
        )}

        {stepType === "wait" && (
          <div className="flex gap-3">
            <Field label="Amount">
              <Input
                type="number"
                min={1}
                value={(config.amount as number) ?? 1}
                onChange={(e) => set({ amount: Number(e.target.value) })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </Field>
            <Field label="Unit">
              <select
                value={(config.unit as string) ?? "minutes"}
                onChange={(e) => set({ unit: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-white outline-none focus:border-violet-500"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </Field>
          </div>
        )}

        {stepType === "condition" && (
          <>
            <Field label="Check">
              <select
                value={(config.subject as string) ?? "tag_presence"}
                onChange={(e) => set({ subject: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-white outline-none focus:border-violet-500"
              >
                <option value="tag_presence">Contact has tag</option>
                <option value="message_body">Message contains</option>
                <option value="contact_field">Contact field equals</option>
              </select>
            </Field>
            <Field label="Value">
              <Input
                value={(config.operand as string) ?? ""}
                onChange={(e) => set({ operand: e.target.value })}
                placeholder="e.g. vip, order, hello"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </Field>
          </>
        )}

        {stepType === "send_webhook" && (
          <>
            <Field label="URL">
              <Input
                value={(config.url as string) ?? ""}
                onChange={(e) => set({ url: e.target.value })}
                placeholder="https://hooks.example.com/wa"
                className="bg-slate-800 border-slate-700 text-white font-mono text-xs"
              />
            </Field>
            <Field label="Body template (JSON)">
              <textarea
                value={(config.body_template as string) ?? ""}
                onChange={(e) => set({ body_template: e.target.value })}
                rows={4}
                placeholder='{"phone":"{{phone}}","msg":"{{message}}"}'
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 outline-none focus:border-violet-500"
              />
            </Field>
          </>
        )}

        {stepType === "assign_conversation" && (
          <Field label="Mode">
            <select
              value={(config.mode as string) ?? "round_robin"}
              onChange={(e) => set({ mode: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-white outline-none focus:border-violet-500"
            >
              <option value="round_robin">Round robin</option>
              <option value="specific">Specific agent</option>
            </select>
          </Field>
        )}

        {stepType === "update_contact_field" && (
          <>
            <Field label="Field">
              <select
                value={(config.field as string) ?? "name"}
                onChange={(e) => set({ field: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-white outline-none focus:border-violet-500"
              >
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="company">Company</option>
              </select>
            </Field>
            <Field label="Value">
              <Input
                value={(config.value as string) ?? ""}
                onChange={(e) => set({ value: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </Field>
          </>
        )}

        {stepType === "create_deal" && (
          <>
            <Field label="Deal title">
              <Input
                value={(config.title as string) ?? ""}
                onChange={(e) => set({ title: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </Field>
            <Field label="Pipeline ID">
              <Input
                value={(config.pipeline_id as string) ?? ""}
                onChange={(e) => set({ pipeline_id: e.target.value })}
                placeholder="Paste pipeline UUID"
                className="bg-slate-800 border-slate-700 text-white text-xs font-mono"
              />
            </Field>
            <Field label="Stage ID">
              <Input
                value={(config.stage_id as string) ?? ""}
                onChange={(e) => set({ stage_id: e.target.value })}
                placeholder="Paste stage UUID"
                className="bg-slate-800 border-slate-700 text-white text-xs font-mono"
              />
            </Field>
          </>
        )}

        {stepType === "close_conversation" && (
          <p className="text-xs text-slate-400">No configuration needed — this step closes the conversation when reached.</p>
        )}
      </div>
    </aside>
  )
}

function TriggerPanel({
  triggerType,
  triggerConfig,
  onChange,
  onClose,
}: {
  triggerType: AutomationTriggerType
  triggerConfig: Record<string, unknown>
  onChange: (type: AutomationTriggerType, config: Record<string, unknown>) => void
  onClose: () => void
}) {
  return (
    <aside className="flex h-full w-72 flex-col border-l border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className="text-sm font-semibold text-white">Trigger</span>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Field label="When this happens…">
          <select
            value={triggerType}
            onChange={(e) => onChange(e.target.value as AutomationTriggerType, triggerConfig)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-white outline-none focus:border-emerald-500"
          >
            {TRIGGER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        {triggerType === "keyword_match" && (
          <Field label="Keywords (comma-separated)">
            <Input
              value={((triggerConfig.keywords as string[]) ?? []).join(", ")}
              onChange={(e) =>
                onChange(triggerType, {
                  ...triggerConfig,
                  keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  match_type: triggerConfig.match_type ?? "contains",
                })
              }
              placeholder="hello, hi, start"
              className="bg-slate-800 border-slate-700 text-white"
            />
            <select
              value={(triggerConfig.match_type as string) ?? "contains"}
              onChange={(e) => onChange(triggerType, { ...triggerConfig, match_type: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="contains">Contains</option>
              <option value="exact">Exact match</option>
            </select>
          </Field>
        )}

        {triggerType === "time_based" && (
          <Field label="Cron schedule">
            <Input
              value={(triggerConfig.schedule as string) ?? ""}
              onChange={(e) => onChange(triggerType, { ...triggerConfig, schedule: e.target.value })}
              placeholder="0 9 * * 1 (Mon 9am)"
              className="bg-slate-800 border-slate-700 text-white font-mono text-xs"
            />
          </Field>
        )}
      </div>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}

// ─── Palette panel ────────────────────────────────────────────────────────────

function PalettePanel({ onAdd }: { onAdd: (type: AutomationStepType) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ Message: true, Actions: true, Logic: true })

  return (
    <aside className="flex h-full w-56 flex-col border-r border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Steps</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {PALETTE_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <button
              onClick={() => setOpen((o) => ({ ...o, [group.label]: !o[group.label] }))}
              className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300"
            >
              {open[group.label] ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {group.label}
            </button>
            {open[group.label] && group.types.map((type) => {
              const meta = STEP_META[type]
              const Icon = meta.icon
              return (
                <button
                  key={type}
                  onClick={() => onAdd(type)}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("stepType", type)}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-800"
                >
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-white"
                    style={{ background: meta.color }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="flex-1 text-xs font-medium text-slate-300 group-hover:text-white">{meta.label}</span>
                  <Plus className="size-3 text-slate-600 group-hover:text-slate-400" />
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-800 p-3">
        <p className="text-[10px] text-slate-600 text-center">Drag onto canvas or click to add</p>
      </div>
    </aside>
  )
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

function cid() {
  return "n_" + (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36))
}

function blankConfig(type: AutomationStepType): Record<string, unknown> {
  switch (type) {
    case "send_message":          return { text: "" }
    case "send_template":         return { template_name: "", language: "en_US" }
    case "add_tag":
    case "remove_tag":            return { tag_id: "" }
    case "assign_conversation":   return { mode: "round_robin" }
    case "update_contact_field":  return { field: "name", value: "" }
    case "create_deal":           return { pipeline_id: "", stage_id: "", title: "", value: 0 }
    case "wait":                  return { amount: 1, unit: "hours" }
    case "condition":             return { subject: "tag_presence", operand: "" }
    case "send_webhook":          return { url: "", body_template: "" }
    case "close_conversation":    return {}
    default:                      return {}
  }
}

/** Convert canvas nodes + edges → BuilderStep tree (for the API) */
function canvasToApiSteps(nodes: Node[], edges: Edge[]): BuilderStep[] {
  // Build adjacency: sourceId → { targetId, sourceHandle }[]
  const adj = new Map<string, { target: string; handle: string | null }[]>()
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    adj.get(e.source)!.push({ target: e.target, handle: e.sourceHandle ?? null })
  }

  // Find root nodes (nodes with no incoming edge, excluding trigger)
  const hasIncoming = new Set(edges.map((e) => e.target))
  const stepNodes = nodes.filter((n) => n.type === "step")
  const roots = stepNodes.filter((n) => !hasIncoming.has(n.id))

  // DFS to build nested BuilderStep tree
  function buildStep(nodeId: string): BuilderStep | null {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || node.type !== "step") return null
    const type = node.data.stepType as AutomationStepType
    const children = adj.get(nodeId) ?? []

    let branches: BuilderStep["branches"] | undefined
    if (type === "condition") {
      const yesChild = children.find((c) => c.handle === "yes")
      const noChild  = children.find((c) => c.handle === "no")
      branches = {
        yes: yesChild ? [buildStep(yesChild.target)].filter(Boolean) as BuilderStep[] : [],
        no:  noChild  ? [buildStep(noChild.target)].filter(Boolean)  as BuilderStep[] : [],
      }
    }

    return {
      cid: nodeId,
      step_type: type,
      step_config: node.data.config ?? {},
      branches,
    }
  }

  return roots.map((r) => buildStep(r.id)).filter(Boolean) as BuilderStep[]
}

// ─── Main FlowCanvas component ────────────────────────────────────────────────

export interface FlowCanvasProps {
  initial: BuilderInitial
}

export function FlowCanvas({ initial }: FlowCanvasProps) {
  const router = useRouter()
  const isEditing = !!initial.id

  const [name, setName] = useState(initial.name || "Untitled automation")
  const [isActive, setIsActive] = useState(initial.is_active)
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(initial.trigger_type)
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(initial.trigger_config)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [triggerPanelOpen, setTriggerPanelOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const idCounter = useRef(0)

  // ── Initialise canvas from BuilderInitial ──
  useEffect(() => {
    const initNodes: Node[] = []
    const initEdges: Edge[] = []

    // Trigger node always at top
    initNodes.push({
      id: "trigger",
      type: "trigger",
      position: { x: 300, y: 60 },
      deletable: false,
      data: {
        triggerType: initial.trigger_type,
        keywords: (initial.trigger_config as Record<string, unknown>).keywords ?? [],
        schedule: (initial.trigger_config as Record<string, unknown>).schedule ?? "",
        onClickTrigger: () => { setTriggerPanelOpen(true); setSelectedNodeId(null) },
      },
    })

    // Convert BuilderSteps → flat canvas nodes + edges
    let yOffset = 220
    function addStep(step: BuilderStep, parentId: string, edgeHandle?: string) {
      const nodeId = step.cid || cid()
      initNodes.push({
        id: nodeId,
        type: "step",
        position: { x: 300, y: yOffset },
        data: {
          stepType: step.step_type,
          config: step.step_config,
        },
      })
      yOffset += 140

      initEdges.push({
        id: `e_${parentId}_${nodeId}`,
        source: parentId,
        target: nodeId,
        ...(edgeHandle ? { sourceHandle: edgeHandle } : {}),
        animated: true,
        style: { stroke: "#475569", strokeWidth: 2 },
      })

      if (step.branches) {
        step.branches.yes.forEach((s) => addStep(s, nodeId, "yes"))
        step.branches.no.forEach((s)  => addStep(s, nodeId, "no"))
      }
    }

    initial.steps.forEach((s) => addStep(s, "trigger"))

    setNodes(initNodes)
    setEdges(initEdges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Keep trigger node data in sync with panel state ──
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === "trigger"
          ? {
              ...n,
              data: {
                ...n.data,
                triggerType,
                keywords: (triggerConfig.keywords as string[]) ?? [],
                schedule: (triggerConfig.schedule as string) ?? "",
              },
            }
          : n,
      ),
    )
  }, [triggerType, triggerConfig, setNodes])

  // ── Keep step click handlers live (avoid stale closures) ──
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id === "trigger") return { ...n, data: { ...n.data, onClickTrigger: () => { setTriggerPanelOpen(true); setSelectedNodeId(null) } } }
        return {
          ...n,
          data: {
            ...n.data,
            onClickStep: () => { setSelectedNodeId(n.id); setTriggerPanelOpen(false) },
            onDelete: () => {
              setNodes((prev) => prev.filter((x) => x.id !== n.id))
              setEdges((prev) => prev.filter((e) => e.source !== n.id && e.target !== n.id))
              setSelectedNodeId(null)
            },
          },
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length])

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge({ ...connection, animated: true, style: { stroke: "#475569", strokeWidth: 2 } }, eds),
      ),
    [setEdges],
  )

  // ── Add step from palette ──
  function addStep(type: AutomationStepType) {
    idCounter.current += 1
    const id = `n_${Date.now()}_${idCounter.current}`
    const maxY = nodes.reduce((m, n) => Math.max(m, n.position.y), 60)
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "step",
        position: { x: 300, y: maxY + 140 },
        data: {
          stepType: type,
          config: blankConfig(type),
          onClickStep: () => { setSelectedNodeId(id); setTriggerPanelOpen(false) },
          onDelete: () => {
            setNodes((p) => p.filter((x) => x.id !== id))
            setEdges((p) => p.filter((e) => e.source !== id && e.target !== id))
            setSelectedNodeId(null)
          },
        },
      },
    ])
    // Auto-connect to last node
    const lastNode = [...nodes].sort((a, b) => b.position.y - a.position.y)[0]
    if (lastNode) {
      setEdges((es) => [
        ...es,
        { id: `e_${lastNode.id}_${id}`, source: lastNode.id, target: id, animated: true, style: { stroke: "#475569", strokeWidth: 2 } },
      ])
    }
    setSelectedNodeId(id)
    setTriggerPanelOpen(false)
  }

  // ── Drop from palette drag ──
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const type = e.dataTransfer.getData("stepType") as AutomationStepType
    if (!type) return
    addStep(type)
  }

  // ── Update config of selected node ──
  function updateSelectedConfig(config: Record<string, unknown>) {
    if (!selectedNodeId) return
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, config } } : n,
      ),
    )
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId && n.type === "step")

  // ── Save ──
  async function save() {
    setSaving(true)
    try {
      const steps = canvasToApiSteps(nodes, edges)
      const payload = {
        name,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        is_active: isActive,
        steps: toApiSteps(steps),
      }
      const url = isEditing ? `/api/automations/${initial.id}` : "/api/automations"
      const method = isEditing ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const issue = body?.issues?.[0]
        toast.error(issue?.message ?? body?.error ?? "Save failed", {
          description: issue?.path ? `at ${issue.path}` : undefined,
        })
        return
      }
      toast.success(isEditing ? "Automation saved" : "Automation created")
      if (!isEditing && body?.automation?.id) {
        router.replace(`/automations/${body.automation.id}/edit`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => router.push("/automations")}
          className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-sm font-semibold text-white placeholder:text-slate-500 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
          placeholder="Untitled automation"
        />

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:block">
            {isActive ? "Active" : "Draft"}
          </span>
          {isActive
            ? <Pause className="size-3.5 text-emerald-400" />
            : <Play className="size-3.5 text-slate-500" />}
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            aria-label="Active"
          />
        </div>

        <Button
          onClick={save}
          disabled={saving}
          className="bg-violet-600 text-white hover:bg-violet-700"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "Saving…" : "Save"}
        </Button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <PalettePanel onAdd={addStep} />

        {/* Canvas */}
        <div className="flex-1 relative" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: true, style: { stroke: "#475569", strokeWidth: 2 } }}
            onPaneClick={() => { setSelectedNodeId(null); setTriggerPanelOpen(false) }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
            <Controls
              className="!rounded-xl !border !border-slate-800 !bg-slate-900 !shadow-xl"
              showInteractive={false}
            />
            <MiniMap
              className="!rounded-xl !border !border-slate-800 !bg-slate-900"
              nodeColor={(n) => n.type === "trigger" ? "#10b981" : "#7c3aed"}
              maskColor="rgba(15,23,42,0.7)"
            />
          </ReactFlow>

          {/* Empty state hint */}
          {nodes.length <= 1 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-8 py-6 text-center backdrop-blur">
                <p className="text-sm font-semibold text-slate-400">Click a step in the left panel to add it</p>
                <p className="mt-1 text-xs text-slate-600">Or drag steps onto the canvas · Connect nodes by dragging from a handle</p>
              </div>
            </div>
          )}
        </div>

        {/* Right config panel */}
        {triggerPanelOpen && (
          <TriggerPanel
            triggerType={triggerType}
            triggerConfig={triggerConfig}
            onChange={(type, config) => { setTriggerType(type); setTriggerConfig(config) }}
            onClose={() => setTriggerPanelOpen(false)}
          />
        )}
        {selectedNode && !triggerPanelOpen && (
          <ConfigPanel
            stepType={selectedNode.data.stepType}
            config={selectedNode.data.config ?? {}}
            onChange={updateSelectedConfig}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}
