"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlowProvider,
  addEdge, useEdgesState, useNodesState, Handle, Position,
  type Connection, type Edge, type Node, type NodeProps, type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowLeft, Save, Sparkles, ChevronDown, ChevronRight, Plus,
  Zap, MessageSquare, Image as ImageIcon, List as ListIcon, BookOpen,
  Package, Boxes, FileText, UserCheck, TrendingUp, GitBranch, Webhook,
  Tag, Loader2, Power, PowerOff, X, Brain, Settings as SettingsIcon, History,
} from "lucide-react";
import { NODE_CATALOG, type Journey, type JourneyStatus, type NodeType, type Trigger } from "@/types/journey";
import { NodeConfigDrawer } from "@/components/journeys/node-config-drawer";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, Image: ImageIcon, List: ListIcon, BookOpen, Package, Boxes, FileText,
  UserCheck, TrendingUp, GitBranch, Webhook, Tag,
};

const CANVAS_TABS = [
  { slug: "canvas",  label: "Canvas",  icon: SettingsIcon },
  { slug: "brain",   label: "Brain",   icon: Brain },
  { slug: "actions", label: "Actions", icon: Zap },
  { slug: "persona", label: "Persona", icon: Sparkles },
];

function TriggerNode({ data }: NodeProps) {
  const t = (data?.trigger as Trigger) ?? { type: "keyword", keywords: [] };
  return (
    <div
      className="relative rounded-xl border-2 px-5 py-3 shadow-md text-white cursor-pointer transition-all hover:shadow-lg"
      style={{
        minWidth: 220,
        background: "linear-gradient(135deg,#10b981,#059669)",
        borderColor: "#047857",
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-white/20">
          <Zap className="size-3.5" />
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Trigger Node</div>
          <div className="text-xs font-bold leading-tight">
            {t.type === "keyword" && (t.keywords?.length ? `Keyword: ${t.keywords[0]}${t.keywords.length > 1 ? "…" : ""}` : "Set up keyword")}
            {t.type === "regex" && "Regex pattern"}
            {t.type === "template_start" && "Template start"}
            {t.type === "ad_click" && "Ad click"}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-emerald-600" />
    </div>
  );
}

function StepNode({ data }: NodeProps) {
  const meta = NODE_CATALOG.find((m) => m.type === (data?.nodeType as NodeType));
  const Icon = ICONS[meta?.icon ?? "MessageSquare"];
  const accent = meta?.accent ?? "#10b981";
  const hasData = data && Object.keys(data).filter((k) => k !== "nodeType" && k !== "preview").length > 0;
  return (
    <div
      className="relative rounded-xl border bg-white shadow-sm transition-all hover:shadow-md cursor-pointer"
      style={{ minWidth: 200, borderColor: `${accent}30` }}
    >
      <span className="absolute left-0 right-0 top-0 h-[3px] rounded-t-xl" style={{ background: accent }} />
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !border-2 !border-white" style={{ background: accent }} />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-7 items-center justify-center rounded-lg text-white shrink-0"
            style={{ background: `linear-gradient(135deg,${accent},${accent}dd)` }}
          >
            <Icon className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {meta?.group ?? "Step"}
            </div>
            <div className="text-xs font-bold text-[#0c1f17] truncate">{meta?.label ?? "Node"}</div>
          </div>
        </div>
        {hasData && (
          <p className="mt-2 text-[11px] text-slate-500 line-clamp-2">
            {(data.text as string) || (data.notification as string) || (data.body as string) || (data.tagName as string) || "Configured"}
          </p>
        )}
        {!hasData && (
          <p className="mt-1.5 text-[11px] text-amber-600 font-medium">Click to configure →</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !border-2 !border-white" style={{ background: accent }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { trigger: TriggerNode, step: StepNode };

export default function JourneyCanvasPage() {
  return <ReactFlowProvider><CanvasInner /></ReactFlowProvider>;
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
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // ── DRY-RUN SANDBOX HISTORY & STATE ENGINE TRACKERS ──
  const [mockChatHistory, setMockChatHistory] = useState<Array<{ sender: "user" | "bot"; text: string }>>([]);
  const [simulatedPrompts, setSimulatedPrompts] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const idCounter = useRef(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (journeyId.startsWith("temp_")) {
          setJourney({
            id: journeyId, user_id: "", name: "Untitled Journey", status: "draft",
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            trigger: { type: "keyword", keywords: [] }, nodes: [], edges: [],
          });
          setNodes([{ id: "trigger", type: "trigger", position: { x: 250, y: 80 }, data: { trigger: { type: "keyword", keywords: [] } }, deletable: false }]);
          setEdges([]);
        } else {
          const { data, error } = await supabase.from("journeys").select("*").eq("id", journeyId).maybeSingle();
          if (error || !data) { toast.error("Couldn't load journey"); router.push("/journeys"); return; }
          const j = data as Journey;
          setJourney(j);
          const rfNodes: Node[] = j.nodes.length
            ? j.nodes.map((n) =>
                n.type === "TRIGGER"
                  ? { id: n.id, type: "trigger", position: n.position, data: { trigger: j.trigger }, deletable: false }
                  : { id: n.id, type: "step", position: n.position, data: { nodeType: n.type, ...n.data } }
              )
            : [{ id: "trigger", type: "trigger", position: { x: 250, y: 80 }, data: { trigger: j.trigger }, deletable: false }];
          setNodes(rfNodes);
          setEdges(j.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [journeyId]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: "#10b981", strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (node.id === "trigger") {
      setTriggerOpen(true);
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
      setTriggerOpen(false);
    }
  }, []);

  function addNodeOfType(t: NodeType) {
    idCounter.current += 1;
    const id = `n_${Date.now()}_${idCounter.current}`;
    setNodes((prev) => [
      ...prev,
      {
        id, type: "step",
        position: { x: 250, y: 150 + (prev.length * 80) },
        data: { nodeType: t },
      },
    ]);
  }

  const updateNodeData = useCallback((nodeId: string, newData: Record<string, unknown>) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n)));
  }, [setNodes]);

  function updateTrigger(newTrigger: Trigger) {
    if (!journey) return;
    setJourney({ ...journey, trigger: newTrigger });
    setNodes((prev) => prev.map((n) => (n.id === "trigger" ? { ...n, data: { trigger: newTrigger } } : n)));
  }

  async function handleSave() {
    if (!journey) return;
    setSaving(true);
    try {
      const cleanNodes = nodes.map((n) =>
        n.id === "trigger"
          ? { id: n.id, type: "TRIGGER" as NodeType, position: n.position, data: {} }
          : { id: n.id, type: (n.data?.nodeType as NodeType) ?? "TEXT_BUTTONS", position: n.position, data: n.data ?? {} }
      );
      const cleanEdges = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));

      if (journeyId.startsWith("temp_")) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error("Sign in required"); return; }
        const { data, error } = await supabase.from("journeys").insert({
          user_id: user.id, name: journey.name, status: journey.status,
          trigger: journey.trigger, nodes: cleanNodes, edges: cleanEdges,
        }).select().single();
        if (error || !data) { toast.error("Save failed"); return; }
        toast.success("Journey saved");
        router.replace(`/journeys/${data.id}/canvas`);
      } else {
        const { error } = await supabase.from("journeys").update({
          name: journey.name, status: journey.status, trigger: journey.trigger,
          nodes: cleanNodes, edges: cleanEdges, updated_at: new Date().toISOString(),
        }).eq("id", journey.id);
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

  // ── INTERACTIVE DRY-RUN SIMULATOR LOGIC DISPATCHER ──
  const handleSimulateMessage = () => {
    if (!aiPrompt.trim()) return;

    const query = aiPrompt.trim();
    setMockChatHistory((prev) => [...prev, { sender: "user", text: query }]);
    setSimulatedPrompts((prev) => prev.includes(query) ? prev : [query, ...prev]);
    setAiPrompt("");

    setTimeout(() => {
      if (query.toLowerCase() === "pricing") {
        setMockChatHistory((prev) => [...prev, { sender: "bot", text: "Here is our latest software pricing matrix tier package framework. Let me know if you would like a demo!" }]);
      } else {
        setMockChatHistory((prev) => [...prev, { sender: "bot", text: "No matching keyword trigger found on your current canvas layout maps. Try typing 'pricing'!" }]);
      }
      
      const chatPane = document.getElementById("sandbox-chat-flow");
      if (chatPane) chatPane.scrollTo({ top: chatPane.scrollHeight, behavior: "smooth" });
    }, 600);
  };

  if (loading || !journey) {
    return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-white"><Loader2 className="size-6 animate-spin text-emerald-500" /></div>;
  }

  const isLive = journey.status === "active";
  const sendNodes = NODE_CATALOG.filter((n) => n.group === "Send");
  const doNodes = NODE_CATALOG.filter((n) => n.group === "Do");

  return (
    <div className="-m-4 sm:-m-6 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[#f8faf9]">
      {/* Top Header Controls bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#e7ece9] bg-white px-5 py-3 z-10 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/journeys" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <ArrowLeft className="size-4" strokeWidth={2.5} />
          </Link>
          <div className="min-w-0">
            <input
              value={journey.name}
              onChange={(e) => setJourney({ ...journey, name: e.target.value })}
              className="block w-full max-w-xs bg-transparent text-sm font-bold text-[#0c1f17] focus:outline-none focus:underline decoration-emerald-500 decoration-2 underline-offset-4"
            />
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{isLive ? "🟢 Running on WhatsApp" : "⚪ Draft Mode"}</div>
          </div>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="hidden md:flex items-center gap-1 rounded-xl border border-[#e7ece9] bg-[#f8faf9] p-1">
          {CANVAS_TABS.map((t) => {
            const active = t.slug === "canvas";
            return (
              <Link
                key={t.slug}
                href={`/journeys/${journeyId}/${t.slug}`}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  active ? "bg-emerald-500 text-white shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* Operational Command Buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => setAiPanelOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white px-3.5 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-all shadow-xs">
            <Sparkles className="size-3.5" /> Dry-Run Sandbox
          </button>
          <button
            onClick={toggleStatus}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              isLive ? "bg-emerald-600 text-white shadow-sm" : "border border-[#e7ece9] bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {isLive ? <Power className="size-3.5" /> : <PowerOff className="size-3.5" />}
            {isLive ? "Status: Live" : "Status: Draft"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 12px rgba(16,185,129,.2)" }}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PALETTE PANELS ── className SYNTAX FIXED HERE */}
        <aside className="w-60 border-r border-[#e7ece9] bg-white flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-50 bg-slate-50/50">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Automation Steps</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            <PaletteGroup label="Send" open={sendOpen} setOpen={setSendOpen} items={sendNodes} onAdd={addNodeOfType} />
            <PaletteGroup label="Do" open={doOpen} setOpen={setDoOpen} items={doNodes} onAdd={addNodeOfType} />
          </div>
        </aside>

        {/* CENTER INTERACTIVE CANVAS */}
        <div className="flex-1 relative bg-[#fcfdfe]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ animated: true, style: { stroke: "#cbd5d1", strokeWidth: 2 } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5d1" />
            <Controls className="!bottom-4 !right-4 !left-auto !shadow-md !rounded-xl !border !border-[#e7ece9] !bg-white" showInteractive={false} />
            <MiniMap
              nodeColor={(n) => (n.type === "trigger" ? "#10b981" : "#e2e8f0")}
              maskColor="rgba(252,253,254,0.7)"
              className="!bg-white !border !border-[#e7ece9] !rounded-xl"
              pannable zoomable
            />
          </ReactFlow>

          {nodes.length <= 1 && (
            <div className="pointer-events-none absolute bottom-5 left-5 z-10 max-w-xs">
              <div className="rounded-xl border border-dashed border-emerald-300 bg-white/90 backdrop-blur-md p-4 shadow-md">
                <p className="text-xs font-bold text-slate-800">Add Workflow Steps</p>
                <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                  Click components from the left steps sidebar palette to assemble your automated sequence thread map.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT DRAWERS - AI CONTROL PANEL & DRY-RUN SANDBOX ENGINE */}
        {aiPanelOpen && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-[#e7ece9] bg-white flex flex-col justify-between z-10">
            {/* Header with Title & Previous Prompts Dropdown Button */}
            <div className="border-b border-[#e7ece9] p-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-purple-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0c1f17]">Dry-Run Sandbox</h3>
                </div>
                <button onClick={() => setAiPanelOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 transition-colors">
                  <X className="size-4" />
                </button>
              </div>

              {/* Previous Options Dynamic Controller */}
              <div className="mt-3 flex items-center justify-between gap-2 relative">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Simulator Sandbox</label>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-xs"
                  >
                    <History className="size-3 text-slate-400" />
                    Previous Prompts
                    <ChevronDown className="size-3 text-slate-400" />
                  </button>

                  {/* History Prompts Overlay Popover Option List */}
                  {showHistoryDropdown && (
                    <div className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-50 animate-fadeIn">
                      {simulatedPrompts.length === 0 ? (
                        <p className="text-[11px] text-slate-400 p-2 text-center">No simulation history yet</p>
                      ) : (
                        <div className="max-h-36 overflow-y-auto">
                          {simulatedPrompts.map((promptText, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setAiPrompt(promptText);
                                setShowHistoryDropdown(false);
                              }}
                              className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 truncate block"
                            >
                              "{promptText}"
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Mock Chat Simulator Frame Layout */}
            <div className="flex-1 bg-[#efeae2] p-3 overflow-y-auto flex flex-col gap-2 shadow-inner min-h-0" id="sandbox-chat-flow">
              <div className="mx-auto bg-white/80 backdrop-blur border border-slate-200/50 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-500 text-center max-w-[240px] shadow-xs">
                🔒 Sandbox active. Test canvas rules safely.
              </div>

              {mockChatHistory.map((chat, idx) => (
                <div
                  key={idx}
                  className={`max-w-[85%] rounded-xl p-2.5 shadow-xs text-xs relative ${
                    chat.sender === "user" 
                      ? "self-end bg-emerald-600 text-white rounded-tr-none" 
                      : "self-start bg-white text-slate-800 rounded-tl-none border border-slate-200/50"
                  }`}
                >
                  {chat.sender === "bot" && (
                    <span className="block text-[9px] font-bold text-amber-500 uppercase tracking-wide mb-0.5">🤖 Bot Match</span>
                  )}
                  {chat.text}
                </div>
              ))}
            </div>

            {/* Text Input Action Composer Composer Bar Panel */}
            <div className="p-3 border-t border-[#e7ece9] bg-slate-50 flex items-center gap-1.5 shrink-0">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSimulateMessage(); }}
                placeholder="Type 'pricing' to test trigger..."
                className="flex-1 min-w-0 rounded-xl border border-[#e7ece9] bg-white px-3 py-2 text-xs text-[#0c1f17] placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              <button
                onClick={handleSimulateMessage}
                disabled={!aiPrompt.trim()}
                className="h-8 w-8 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-xs disabled:opacity-40"
              >
                <Zap className="size-3.5" />
              </button>
            </div>
          </aside>
        )}
      </div>

      <NodeConfigDrawer node={selectedNode} open={!!selectedNode} onClose={() => setSelectedNode(null)} onSave={updateNodeData} />

      {triggerOpen && (
        <TriggerConfigDrawer open={triggerOpen} trigger={journey.trigger} onClose={() => setTriggerOpen(false)} onSave={(t) => { updateTrigger(t); setTriggerOpen(false); }} />
      )}
    </div>
  );
}

function PaletteGroup({
  label, open, setOpen, items, onAdd,
}: {
  label: string; open: boolean; setOpen: (b: boolean) => void;
  items: typeof NODE_CATALOG; onAdd: (t: NodeType) => void;
}) {
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:bg-slate-50"
      >
        <span>{label}</span>
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {items.map((n) => {
            const Icon = ICONS[n.icon] ?? MessageSquare;
            return (
              <button
                key={n.type}
                onClick={() => onAdd(n.type)}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-1.5 text-left text-xs font-semibold text-slate-600 hover:border-[#e7ece9] hover:bg-[#f8faf9] hover:text-[#0c1f17] transition-all"
              >
                <span
                  className="flex size-6.5 items-center justify-center rounded-lg text-white shrink-0 shadow-xs"
                  style={{ background: `linear-gradient(135deg,${n.accent},${n.accent}dd)` }}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="truncate flex-1 text-xs">{n.label}</span>
                <Plus className="size-3 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TriggerConfigDrawer({
  open, trigger, onClose, onSave,
}: {
  open: boolean; trigger: Trigger;
  onClose: () => void; onSave: (t: Trigger) => void;
}) {
  const [draft, setDraft] = useState<Trigger>(trigger);
  const [kwInput, setKwInput] = useState("");

  if (!open) return null;

  const addKw = () => {
    if (!kwInput.trim()) return;
    setDraft({ ...draft, keywords: [...(draft.keywords ?? []), kwInput.trim()] });
    setKwInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-xs" />
      <aside className="relative w-full max-w-md overflow-y-auto bg-white border-l border-[#e7ece9] shadow-2xl flex flex-col justify-between" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="border-b border-[#e7ece9] px-6 py-4 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                <Zap className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0c1f17]">Configure Trigger Entry</h3>
                <p className="text-[11px] text-slate-400">Determine how this flow session initiates</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600">Trigger Type Rule</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as Trigger["type"] })}
                className="w-full rounded-xl border border-[#e7ece9] bg-white p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
              >
                <option value="keyword">Keyword match</option>
                <option value="regex">Regex pattern</option>
                <option value="template_start">Template-initiated</option>
                <option value="ad_click">Ad click (Click-to-WhatsApp)</option>
              </select>
            </div>

            {draft.type === "keyword" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Target Keywords</label>
                {(draft.keywords?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 border border-slate-100 bg-slate-50/50 rounded-xl">
                    {draft.keywords?.map((kw, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {kw}
                        <button onClick={() => setDraft({ ...draft, keywords: draft.keywords?.filter((_, idx) => idx !== i) })}><X className="size-3 opacity-60 hover:opacity-100" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }}
                    placeholder="e.g. support, catalogue"
                    className="flex-1 rounded-xl border border-[#e7ece9] bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                  <button onClick={addKw} className="h-8 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Add</button>
                </div>
              </div>
            )}

            {draft.type === "regex" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Regex Expression String</label>
                <input
                  value={draft.regex?.pattern ?? ""}
                  onChange={(e) => setDraft({ ...draft, regex: { pattern: e.target.value, caseSensitive: draft.regex?.caseSensitive ?? false } })}
                  placeholder="book.+now"
                  className="w-full rounded-xl border border-[#e7ece9] bg-white p-2.5 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {draft.type === "template_start" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Meta Template Identity</label>
                <input
                  value={draft.templateId ?? ""}
                  onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}
                  placeholder="welcome_broadcast_coupon"
                  className="w-full rounded-xl border border-[#e7ece9] bg-white p-2.5 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#e7ece9] bg-white px-6 py-3.5 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="rounded-xl border border-[#e7ece9] bg-white px-3.5 h-9 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSave(draft)} className="flex items-center gap-1.5 rounded-xl h-9 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm">Save Trigger Profile</button>
        </div>
      </aside>
    </div>
  );
}
