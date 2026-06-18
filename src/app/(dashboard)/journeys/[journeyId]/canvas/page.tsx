"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowLeft, Save, Sparkles, ChevronDown, ChevronRight, Plus,
  Zap, MessageSquare, Image as ImageIcon, List as ListIcon, BookOpen,
  Package, Boxes, FileText, UserCheck, TrendingUp, GitBranch, Webhook,
  Tag, Loader2, Power, PowerOff, X,
} from "lucide-react";
import { NODE_CATALOG, type Journey, type JourneyStatus, type NodeType, type Trigger } from "@/types/journey";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, Image: ImageIcon, List: ListIcon, BookOpen, Package, Boxes, FileText,
  UserCheck, TrendingUp, GitBranch, Webhook, Tag,
};

// ── Custom node renderers ──

function TriggerNode({ data }: NodeProps) {
  const t = (data?.trigger as Trigger) ?? { type: "keyword", keywords: [] };
  return (
    <div
      className="relative rounded-full border-2 px-5 py-3 shadow-lg text-white"
      style={{
        minWidth: 220,
        background: "linear-gradient(135deg,#10b981,#059669)",
        borderColor: "#047857",
        boxShadow: "0 10px 30px rgba(16,185,129,.35)",
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-white/20">
          <Zap className="size-3.5" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Trigger</div>
          <div className="text-sm font-bold leading-tight">
            {t.type === "keyword" && (t.keywords?.length ? `Keyword: ${t.keywords[0]}${t.keywords.length > 1 ? "…" : ""}` : "Set up keyword")}
            {t.type === "regex" && "Regex pattern"}
            {t.type === "template_start" && "Template start"}
            {t.type === "ad_click" && "Ad click"}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-white !bg-emerald-600"
      />
    </div>
  );
}

function StepNode({ data, type }: NodeProps & { type?: string }) {
  const meta = NODE_CATALOG.find((m) => m.type === (data?.nodeType as NodeType));
  const Icon = ICONS[meta?.icon ?? "MessageSquare"];
  const accent = meta?.accent ?? "#10b981";
  return (
    <div
      className="relative rounded-xl border bg-white shadow-md transition-all hover:shadow-lg"
      style={{ minWidth: 200, borderColor: `${accent}40` }}
    >
      <span
        className="absolute left-0 right-0 top-0 h-[3px] rounded-t-xl"
        style={{ background: accent }}
      />
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-white" style={{ background: accent }} />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded-lg text-white shrink-0"
            style={{ background: `linear-gradient(135deg,${accent},${accent}dd)`, boxShadow: `0 4px 10px ${accent}55` }}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {meta?.group ?? "Step"}
            </div>
            <div className="text-sm font-bold text-[#0c1f17] truncate">
              {meta?.label ?? "Node"}
            </div>
          </div>
        </div>
        {data?.preview && (
          <p className="mt-2 text-xs text-slate-500 line-clamp-2">{data.preview as string}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-white" style={{ background: accent }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  step: StepNode,
};

// ── Page ──

export default function JourneyCanvasPage() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const params = useParams<{ journeyId: string }>();
  const router = useRouter();
  const supabase = createClient();
  const journeyId = params.journeyId;

  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [sendOpen, setSendOpen] = useState(true);
  const [doOpen, setDoOpen] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const idCounter = useRef(0);

  // Load journey from DB (or use temp shell if it's a temp ID)
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (journeyId.startsWith("temp_")) {
          // No DB record yet — start with an empty trigger
          setJourney({
            id: journeyId,
            user_id: "",
            name: "Untitled Journey",
            status: "draft",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            trigger: { type: "keyword", keywords: [] },
            nodes: [],
            edges: [],
          });
          setNodes([
            {
              id: "trigger",
              type: "trigger",
              position: { x: 60, y: 60 },
              data: { trigger: { type: "keyword", keywords: [] } },
              deletable: false,
            },
          ]);
          setEdges([]);
        } else {
          const { data, error } = await supabase
            .from("journeys")
            .select("*")
            .eq("id", journeyId)
            .maybeSingle();
          if (error || !data) {
            toast.error("Couldn't load journey");
            router.push("/journeys");
            return;
          }
          const j = data as Journey;
          setJourney(j);
          const rfNodes: Node[] = j.nodes.length
            ? j.nodes.map((n) =>
                n.type === "TRIGGER"
                  ? { id: n.id, type: "trigger", position: n.position, data: { trigger: j.trigger }, deletable: false }
                  : { id: n.id, type: "step", position: n.position, data: { nodeType: n.type, ...n.data } }
              )
            : [
                {
                  id: "trigger",
                  type: "trigger",
                  position: { x: 60, y: 60 },
                  data: { trigger: j.trigger },
                  deletable: false,
                },
              ];
          setNodes(rfNodes);
          setEdges(j.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: "#10b981", strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  function addNodeOfType(t: NodeType) {
    idCounter.current += 1;
    const id = `n_${Date.now()}_${idCounter.current}`;
    const meta = NODE_CATALOG.find((m) => m.type === t);
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "step",
        position: { x: 120 + ((prev.length * 30) % 400), y: 220 + ((prev.length * 60) % 400) },
        data: { nodeType: t, preview: meta?.label },
      },
    ]);
  }

  async function handleSave() {
    if (!journey) return;
    setSaving(true);
    try {
      const cleanNodes = nodes.map((n) =>
        n.id === "trigger"
          ? { id: n.id, type: "TRIGGER" as NodeType, position: n.position, data: {} }
          : {
              id: n.id,
              type: (n.data?.nodeType as NodeType) ?? "TEXT_BUTTONS",
              position: n.position,
              data: n.data ?? {},
            }
      );
      const cleanEdges = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));

      if (journeyId.startsWith("temp_")) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error("Sign in required"); return; }
        const { data, error } = await supabase
          .from("journeys")
          .insert({
            user_id: user.id,
            name: journey.name,
            status: journey.status,
            trigger: journey.trigger,
            nodes: cleanNodes,
            edges: cleanEdges,
          })
          .select().single();
        if (error || !data) { toast.error("Save failed (run journeys migration)"); return; }
        toast.success("Journey saved");
        router.replace(`/journeys/${data.id}/canvas`);
      } else {
        const { error } = await supabase
          .from("journeys")
          .update({
            name: journey.name,
            status: journey.status,
            trigger: journey.trigger,
            nodes: cleanNodes,
            edges: cleanEdges,
            updated_at: new Date().toISOString(),
          })
          .eq("id", journey.id);
        if (error) { toast.error("Save failed"); return; }
        toast.success("Journey saved");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!journey) return;
    const next: JourneyStatus = journey.status === "active" ? "draft" : "active";
    setJourney({ ...journey, status: next });
    toast.success(next === "active" ? "Journey is now Live" : "Journey is in Draft");
  }

  // Stub for AI generation (Phase 2 will wire to Gemini/Claude)
  async function generateFromPrompt() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      toast.info("AI Journey generation will be wired up in Phase 2");
      addNodeOfType("TEXT_BUTTONS");
    } finally {
      setAiGenerating(false);
      setAiPrompt("");
    }
  }

  if (loading || !journey) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const isLive = journey.status === "active";
  const sendNodes = NODE_CATALOG.filter((n) => n.group === "Send");
  const doNodes = NODE_CATALOG.filter((n) => n.group === "Do");

  return (
    <div className="-m-4 sm:-m-6 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#e7ece9] bg-white px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/journeys" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <input
              value={journey.name}
              onChange={(e) => setJourney({ ...journey, name: e.target.value })}
              className="block w-full max-w-xs bg-transparent text-sm font-bold text-[#0c1f17] focus:outline-none focus:underline decoration-emerald-500 decoration-2 underline-offset-4"
              style={{ fontFamily: "var(--font-display)" }}
            />
            <div className="text-[10px] text-slate-400">
              {isLive ? "Live · running on WhatsApp" : "Draft · not yet running"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiPanelOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-white px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-50"
          >
            <Sparkles className="size-3.5" />
            Describe journey
          </button>

          {/* Draft/Live toggle */}
          <button
            onClick={toggleStatus}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
              isLive
                ? "bg-emerald-500 text-white shadow-sm"
                : "border border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-400"
            }`}
          >
            {isLive ? <Power className="size-3" /> : <PowerOff className="size-3" />}
            {isLive ? "Live" : "Draft"}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
            style={{
              background: "linear-gradient(135deg,#10b981,#059669)",
              boxShadow: "0 4px 12px rgba(16,185,129,.3)",
            }}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save
          </button>
        </div>
      </div>

      {/* Canvas area with left rail */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — node palette */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-[#e7ece9] bg-white">
          <div className="p-3">
            <h3 className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Nodes
            </h3>

            <PaletteGroup
              label="Send"
              open={sendOpen}
              setOpen={setSendOpen}
              items={sendNodes}
              onAdd={addNodeOfType}
            />
            <PaletteGroup
              label="Do"
              open={doOpen}
              setOpen={setDoOpen}
              items={doNodes}
              onAdd={addNodeOfType}
            />
          </div>
        </aside>

        {/* CENTER — React Flow canvas */}
        <div className="flex-1 relative bg-[#f6faf8]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: true, style: { stroke: "#10b981", strokeWidth: 2 } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5d1" />
            <Controls className="!bottom-4 !right-4 !left-auto !shadow-lg !rounded-xl !border !border-[#e7ece9] !bg-white" showInteractive={false} />
            <MiniMap
              nodeColor={(n) => (n.type === "trigger" ? "#10b981" : "#cbd5d1")}
              maskColor="rgba(246,250,248,0.7)"
              className="!bg-white !border !border-[#e7ece9] !rounded-xl"
              pannable zoomable
            />
          </ReactFlow>

          {nodes.length <= 1 && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="rounded-2xl border border-dashed border-emerald-300 bg-white/70 backdrop-blur px-6 py-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-700">Start by adding a node</p>
                <p className="mt-1 text-xs text-slate-400">Click any node from the left palette to drop it on the canvas.</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — AI Describe panel (toggled) */}
        {aiPanelOpen && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-[#e7ece9] bg-white">
            <div className="border-b border-[#e7ece9] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-purple-600" />
                <h3 className="text-sm font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
                  Describe your journey
                </h3>
              </div>
              <button onClick={() => setAiPanelOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500">
                Describe what you want and we'll draft the journey for you.
              </p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. When a customer asks for the menu, send the catalogue and offer to book a table…"
                rows={6}
                className="w-full rounded-lg border border-[#e7ece9] bg-white p-3 text-sm text-[#0c1f17] placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <button
                onClick={generateFromPrompt}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                  boxShadow: "0 6px 16px rgba(139,92,246,.3)",
                }}
              >
                {aiGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Generate
              </button>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                AI generation comes online in Phase 2 (Brain + Persona). Today it adds a starter node — refine it manually for now.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function PaletteGroup({
  label, open, setOpen, items, onAdd,
}: {
  label: string;
  open: boolean;
  setOpen: (b: boolean) => void;
  items: typeof NODE_CATALOG;
  onAdd: (t: NodeType) => void;
}) {
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {label}
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {items.map((n) => {
            const Icon = ICONS[n.icon] ?? MessageSquare;
            return (
              <button
                key={n.type}
                onClick={() => onAdd(n.type)}
                className="group flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs font-semibold text-slate-600 hover:border-[#e7ece9] hover:bg-[#f8faf9] hover:text-[#0c1f17]"
              >
                <span
                  className="flex size-7 items-center justify-center rounded-lg text-white shrink-0"
                  style={{ background: `linear-gradient(135deg,${n.accent},${n.accent}dd)` }}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="truncate flex-1">{n.label}</span>
                <Plus className="size-3 text-slate-300 group-hover:text-emerald-500" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
