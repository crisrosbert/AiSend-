"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, Search, MoreHorizontal, Copy, Edit2, Trash2, Loader2,
  Sparkles, Workflow, FlaskConical, Phone, BarChart3,
  CheckCircle2, AlertCircle, Power, PowerOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Journey, JourneyStatus, Trigger } from "@/types/journey";
import { triggerSummary } from "@/types/journey";

type TabValue = "yours" | "blueprints" | "routing" | "test_number";

const TABS: { value: TabValue; label: string; icon: typeof Workflow }[] = [
  { value: "yours",       label: "Your Journeys", icon: Workflow },
  { value: "blueprints",  label: "Blueprints",    icon: Sparkles },
  { value: "routing",     label: "AI Routing",    icon: BarChart3 },
  { value: "test_number", label: "Test Number",   icon: Phone },
];

const DEFAULT_TRIGGER: Trigger = { type: "keyword", keywords: [] };

export default function JourneysPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<TabValue>("yours");
  const [search, setSearch] = useState("");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [usage, setUsage] = useState({
    journey_slots_used: 0,
    journey_slots_limit: 5,
    ai_credits_used: 0,
    ai_credits_limit: 500,
  });

  const fetchJourneys = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Fetch journeys; gracefully handle missing table.
      const { data, error } = await supabase
        .from("journeys")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        // Table likely doesn't exist yet — show empty state cleanly
        console.warn("journeys table not yet provisioned:", error.message);
        setJourneys([]);
      } else {
        setJourneys((data ?? []) as Journey[]);
        setUsage((u) => ({ ...u, journey_slots_used: data?.length ?? 0 }));
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchJourneys(); }, [fetchJourneys]);

  // Create a new draft journey and route to its canvas
  async function handleNewJourney() {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in required"); setCreating(false); return; }

      const newJourney = {
        user_id: user.id,
        name: "Untitled Journey",
        status: "draft" as JourneyStatus,
        trigger: DEFAULT_TRIGGER,
        nodes: [],
        edges: [],
      };

      const { data, error } = await supabase
        .from("journeys")
        .insert(newJourney)
        .select()
        .single();

      if (error || !data) {
        // Fallback: still let them into the canvas with a temp ID
        const tempId = `temp_${Date.now()}`;
        toast.warning("Saving locally — run the journeys migration to persist");
        router.push(`/journeys/${tempId}/canvas`);
        return;
      }

      toast.success("Journey created");
      router.push(`/journeys/${data.id}/canvas`);
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(journey: Journey) {
    const newStatus: JourneyStatus = journey.status === "active" ? "draft" : "active";
    // Optimistic UI
    setJourneys((prev) => prev.map((j) => (j.id === journey.id ? { ...j, status: newStatus } : j)));

    const { error } = await supabase
      .from("journeys")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", journey.id);

    if (error) {
      // revert
      setJourneys((prev) => prev.map((j) => (j.id === journey.id ? { ...j, status: journey.status } : j)));
      toast.error("Couldn't change status");
    } else {
      toast.success(newStatus === "active" ? "Journey is now Live" : "Journey is in Draft");
    }
  }

  async function duplicateJourney(journey: Journey) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("journeys")
      .insert({
        user_id: user.id,
        name: `${journey.name} (copy)`,
        status: "draft" as JourneyStatus,
        trigger: journey.trigger,
        nodes: journey.nodes,
        edges: journey.edges,
      })
      .select().single();
    if (error || !data) { toast.error("Couldn't duplicate"); return; }
    toast.success("Journey duplicated");
    fetchJourneys();
  }

  async function deleteJourney(journey: Journey) {
    if (!confirm(`Delete "${journey.name}"? This can't be undone.`)) return;
    const { error } = await supabase.from("journeys").delete().eq("id", journey.id);
    if (error) { toast.error("Couldn't delete"); return; }
    toast.success("Journey deleted");
    fetchJourneys();
  }

  const filtered = journeys.filter((j) =>
    !search.trim() || j.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const slotsPercent = Math.round((usage.journey_slots_used / Math.max(usage.journey_slots_limit, 1)) * 100);
  const creditsPercent = Math.round((usage.ai_credits_used / Math.max(usage.ai_credits_limit, 1)) * 100);
  const slotsNearLimit = slotsPercent >= 80;
  const creditsNearLimit = creditsPercent >= 80;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
            Journeys
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Build conversational flows that run themselves on WhatsApp.
          </p>
        </div>
        <button
          onClick={handleNewJourney}
          disabled={creating}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg,#10b981,#059669)",
            boxShadow: "0 6px 16px rgba(16,185,129,.3)",
          }}
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          New Journey
        </button>
      </div>

      {/* Usage strip — single combined card, not two donuts */}
      <div className="overflow-hidden rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-extrabold text-[#0c1f17] text-lg" style={{ fontFamily: "var(--font-display)" }}>
                  {usage.journey_slots_used}
                </span>
                <span className="text-sm text-slate-400">/ {usage.journey_slots_limit}</span>
                <span className="ml-1 text-xs font-semibold text-slate-500">journeys</span>
                {slotsNearLimit && <AlertCircle className="size-3.5 text-amber-500" />}
              </div>
              <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(slotsPercent, 100)}%`,
                    background: slotsNearLimit ? "linear-gradient(90deg,#f59e0b,#d97706)" : "linear-gradient(90deg,#10b981,#059669)",
                  }}
                />
              </div>
            </div>
            <div className="hidden sm:block h-10 w-px bg-[#d1fae5]" />
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-extrabold text-[#0c1f17] text-lg" style={{ fontFamily: "var(--font-display)" }}>
                  {usage.ai_credits_used}
                </span>
                <span className="text-sm text-slate-400">/ {usage.ai_credits_limit}</span>
                <span className="ml-1 text-xs font-semibold text-slate-500">AI credits this cycle</span>
                {creditsNearLimit && <AlertCircle className="size-3.5 text-amber-500" />}
              </div>
              <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(creditsPercent, 100)}%`,
                    background: creditsNearLimit ? "linear-gradient(90deg,#f59e0b,#d97706)" : "linear-gradient(90deg,#8b5cf6,#6d28d9)",
                  }}
                />
              </div>
            </div>
          </div>
          {(slotsNearLimit || creditsNearLimit) && (
            <Link
              href="/billing"
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
            >
              Upgrade plan →
            </Link>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[#e7ece9] bg-white p-1.5 shadow-sm w-fit">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                active
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      {tab === "yours" && (
        <YourJourneys
          journeys={filtered}
          loading={loading}
          search={search}
          setSearch={setSearch}
          onToggle={toggleStatus}
          onDuplicate={duplicateJourney}
          onDelete={deleteJourney}
          onNew={handleNewJourney}
        />
      )}
      {tab === "blueprints" && <StubPanel title="Blueprints" subtitle="Pre-built journeys by industry — coming in Phase 4." icon={<Sparkles className="size-7" />} />}
      {tab === "routing" && <StubPanel title="AI Routing" subtitle="Configure when AI takes over and when humans handle the chat — coming next." icon={<BarChart3 className="size-7" />} />}
      {tab === "test_number" && <StubPanel title="Test Number" subtitle="Send your journey to a test number before going live — coming next." icon={<FlaskConical className="size-7" />} />}
    </div>
  );
}

function YourJourneys({
  journeys, loading, search, setSearch, onToggle, onDuplicate, onDelete, onNew,
}: {
  journeys: Journey[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  onToggle: (j: Journey) => void;
  onDuplicate: (j: Journey) => void;
  onDelete: (j: Journey) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search journeys..."
          className="w-full rounded-lg border border-[#e7ece9] bg-white py-2.5 pl-10 pr-4 text-sm text-[#0c1f17] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        <div className="hidden md:grid grid-cols-[1.5fr_100px_1.4fr_1fr_120px_60px] gap-3 border-b border-[#e7ece9] bg-[#f8faf9] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <div>Name</div>
          <div>Status</div>
          <div>Trigger</div>
          <div>Created by</div>
          <div>Last edited</div>
          <div></div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-emerald-500" />
          </div>
        ) : journeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Workflow className="size-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {search ? "No journeys match your search" : "No journeys yet"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {search
                ? "Try a different search term."
                : "Create your first journey to start automating WhatsApp conversations."}
            </p>
            {!search && (
              <button
                onClick={onNew}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
              >
                <Plus className="size-4" /> New Journey
              </button>
            )}
          </div>
        ) : (
          <div>
            {journeys.map((j) => (
              <JourneyRow
                key={j.id} journey={j}
                onToggle={onToggle} onDuplicate={onDuplicate} onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JourneyRow({
  journey, onToggle, onDuplicate, onDelete,
}: {
  journey: Journey;
  onToggle: (j: Journey) => void;
  onDuplicate: (j: Journey) => void;
  onDelete: (j: Journey) => void;
}) {
  const isLive = journey.status === "active";
  const updated = journey.updated_at
    ? formatDistanceToNow(new Date(journey.updated_at), { addSuffix: true })
    : "—";

  return (
    <div className="group grid grid-cols-1 md:grid-cols-[1.5fr_100px_1.4fr_1fr_120px_60px] gap-3 items-center border-b border-[#e7ece9] px-5 py-3.5 hover:bg-[#f8faf9] transition-colors last:border-b-0">
      <Link href={`/journeys/${journey.id}/canvas`} className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 shrink-0">
            <Workflow className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[#0c1f17]">{journey.name}</div>
            <div className="md:hidden text-[11px] text-slate-400 mt-0.5">
              {triggerSummary(journey.trigger)}
            </div>
          </div>
        </div>
      </Link>

      <div>
        <button
          onClick={(e) => { e.preventDefault(); onToggle(journey); }}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
            isLive
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          {isLive ? <Power className="size-3" /> : <PowerOff className="size-3" />}
          {isLive ? "Live" : "Draft"}
        </button>
      </div>

      <div className="hidden md:block min-w-0">
        <div className="truncate text-xs text-slate-600 font-medium">
          {triggerSummary(journey.trigger)}
        </div>
      </div>

      <div className="hidden md:block text-xs text-slate-500 truncate">
        {journey.created_by || "You"}
      </div>

      <div className="hidden md:block text-xs text-slate-400">{updated}</div>

      <div onClick={(e) => e.stopPropagation()} className="justify-self-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border-[#e7ece9]">
            <DropdownMenuItem onClick={() => onDuplicate(journey)} className="text-slate-700 focus:bg-slate-100">
              <Copy className="size-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#e7ece9]" />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(journey)}>
              <Trash2 className="size-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function StubPanel({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#e7ece9] bg-white py-16 px-6 text-center shadow-sm">
      <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-400 max-w-sm">{subtitle}</p>
    </div>
  );
}
