"use client";

// src/app/(dashboard)/flows-lab/[id]/builder/page.tsx
//
// ── WHAT THIS PAGE IS ────────────────────────────────────────────
// The three-pane visual builder for a Lab flow.
//
//   ┌──────────┬─────────────────────┬──────────────┐
//   │ Screens  │  Live phone preview │ Component    │
//   │ list     │  (mid pane)         │ inspector    │
//   │          │                     │ (right pane) │
//   └──────────┴─────────────────────┴──────────────┘
//
// - Left pane: every screen in the flow, with add/reorder/delete.
// - Middle pane: a phone frame that renders the currently-selected
//   screen exactly as a user would see it on WhatsApp. Clicking a
//   component in the preview selects it in the inspector.
// - Right pane: the properties of the selected component or screen
//   (label, name, options, etc.), plus a "+ Add component" menu
//   scoped to the current screen, including one-click Quick Blocks
//   (e.g. a 3-field lead form) so a common pattern doesn't need
//   assembling field by field.
//
// Everything is saved back to localStorage on every edit — no explicit
// Save button. That's deliberate: this is a test lab, not production;
// losing your work because you forgot to click Save would be a bad
// first impression for a section we might promote.
//
// ── VISUAL SYSTEM ────────────────────────────────────────────────
// Every component category gets a fixed color so the builder reads
// at a glance, the way a real design tool does: Text = sky, Media =
// fuchsia, Input = indigo, Action = emerald, Quick blocks = amber.
// Tailwind classes are written out per-color (not templated) because
// dynamic `bg-${color}-50` strings get purged by the JIT compiler.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Plus, Trash2, GripVertical,
  AlertTriangle, Check, LayoutGrid, Sparkles, Zap,
  Heading1, Heading2, AlignLeft, Minus, Link2, ImageIcon,
  TextCursorInput, CircleDot, CheckSquare, ChevronDownSquare,
  Calendar, ShieldCheck, Send, UserPlus, MessageSquarePlus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  ComponentType, FlowComponent, FlowDefinition, FlowScreen, QuickBlockKey,
} from "@/lib/flows-lab/types";
import {
  newComponent, newScreen, validateFlow, FLOW_CATEGORIES,
  newQuickBlock, QUICK_BLOCKS,
} from "@/lib/flows-lab/types";
import { getFlow, saveFlow } from "@/lib/flows-lab/storage";
import { PhonePreview } from "@/components/flows-lab/phone-preview";

// ── Category color system ───────────────────────────────────────
type CategoryColor = "sky" | "fuchsia" | "indigo" | "emerald" | "amber";

const COLOR_STYLES: Record<CategoryColor, {
  chipBg: string; chipText: string; iconBg: string; iconText: string;
  hoverBorder: string; hoverBg: string; dot: string;
}> = {
  sky: {
    chipBg: "bg-sky-50", chipText: "text-sky-700",
    iconBg: "bg-sky-100", iconText: "text-sky-600",
    hoverBorder: "hover:border-sky-300", hoverBg: "hover:bg-sky-50/60",
    dot: "bg-sky-500",
  },
  fuchsia: {
    chipBg: "bg-fuchsia-50", chipText: "text-fuchsia-700",
    iconBg: "bg-fuchsia-100", iconText: "text-fuchsia-600",
    hoverBorder: "hover:border-fuchsia-300", hoverBg: "hover:bg-fuchsia-50/60",
    dot: "bg-fuchsia-500",
  },
  indigo: {
    chipBg: "bg-indigo-50", chipText: "text-indigo-700",
    iconBg: "bg-indigo-100", iconText: "text-indigo-600",
    hoverBorder: "hover:border-indigo-300", hoverBg: "hover:bg-indigo-50/60",
    dot: "bg-indigo-500",
  },
  emerald: {
    chipBg: "bg-emerald-50", chipText: "text-emerald-700",
    iconBg: "bg-emerald-100", iconText: "text-emerald-600",
    hoverBorder: "hover:border-emerald-300", hoverBg: "hover:bg-emerald-50/60",
    dot: "bg-emerald-500",
  },
  amber: {
    chipBg: "bg-amber-50", chipText: "text-amber-700",
    iconBg: "bg-amber-100", iconText: "text-amber-600",
    hoverBorder: "hover:border-amber-300", hoverBg: "hover:bg-amber-50/60",
    dot: "bg-amber-500",
  },
};

const GROUP_COLOR: Record<string, CategoryColor> = {
  Text: "sky",
  Media: "fuchsia",
  Input: "indigo",
  Action: "emerald",
};

const COMPONENT_MENU: { type: ComponentType; label: string; group: string; icon: LucideIcon }[] = [
  { type: "TextHeading",       label: "Heading",          group: "Text",   icon: Heading1 },
  { type: "TextSubheading",    label: "Subheading",       group: "Text",   icon: Heading2 },
  { type: "TextBody",          label: "Body text",        group: "Text",   icon: AlignLeft },
  { type: "TextCaption",       label: "Caption",          group: "Text",   icon: Minus },
  { type: "EmbeddedLink",      label: "Link",             group: "Text",   icon: Link2 },
  { type: "Image",             label: "Image",            group: "Media",  icon: ImageIcon },
  { type: "TextInput",         label: "Text input",       group: "Input",  icon: TextCursorInput },
  { type: "TextArea",          label: "Text area",        group: "Input",  icon: AlignLeft },
  { type: "RadioButtonsGroup", label: "Single choice",    group: "Input",  icon: CircleDot },
  { type: "CheckboxGroup",     label: "Multi choice",     group: "Input",  icon: CheckSquare },
  { type: "Dropdown",          label: "Dropdown",         group: "Input",  icon: ChevronDownSquare },
  { type: "DatePicker",        label: "Date picker",      group: "Input",  icon: Calendar },
  { type: "OptIn",             label: "Consent checkbox", group: "Input",  icon: ShieldCheck },
  { type: "Footer",            label: "Submit button",    group: "Action", icon: Send },
];

const QUICK_BLOCK_ICON: Record<QuickBlockKey, LucideIcon> = {
  lead_form: UserPlus,
  contact_form: MessageSquarePlus,
};

export default function FlowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  // Every route in Flows Lab is served from /flows-lab/... regardless
  // of the caller's tenant slug — the [slug]/flows-lab/ shim sends
  // sidebar links here (and /admin/flows-lab/ has its own shim). So
  // internal links stay slug-free and work across tenants, including
  // the reserved "admin" one.

  // ── Load flow on mount ───────────────────────────────────────────
  // localStorage is an external store, so hydrating client-only state
  // in an effect is exactly what this pattern is for.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!id) return;
    const loaded = getFlow(id);
    if (!loaded) {
      toast.error("Flow not found");
      router.replace(`/flows-lab`);
      return;
    }
    setFlow(loaded);
    setSelectedScreenId(loaded.startScreenId);
  }, [id, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedScreen = useMemo(
    () => flow?.screens.find((s) => s.id === selectedScreenId) ?? null,
    [flow, selectedScreenId],
  );
  const selectedComponent = useMemo(
    () => selectedScreen?.components.find((c) => c.id === selectedComponentId) ?? null,
    [selectedScreen, selectedComponentId],
  );

  const problems = useMemo(() => (flow ? validateFlow(flow) : []), [flow]);

  // ── Mutation helpers ─────────────────────────────────────────────
  // Every mutation goes through `update`, which writes to storage in
  // the same tick as it updates state. That way tabs, reloads and the
  // Test button all see the same source of truth.
  function update(mutator: (draft: FlowDefinition) => void) {
    if (!flow) return;
    const draft: FlowDefinition = JSON.parse(JSON.stringify(flow));
    mutator(draft);
    saveFlow(draft);
    setFlow(draft);
  }

  function addScreen() {
    update((draft) => {
      const s = newScreen(`Screen ${draft.screens.length + 1}`);
      draft.screens.push(s);
      setSelectedScreenId(s.id);
      setSelectedComponentId(null);
    });
  }

  function deleteScreen(screenId: string) {
    if (!flow) return;
    if (flow.screens.length === 1) {
      toast.error("A flow needs at least one screen");
      return;
    }
    if (!confirm("Delete this screen?")) return;
    update((draft) => {
      draft.screens = draft.screens.filter((s) => s.id !== screenId);
      if (draft.startScreenId === screenId) draft.startScreenId = draft.screens[0].id;
      // Redirect any Footer that pointed at the deleted screen back to SUCCESS
      for (const s of draft.screens) {
        for (const c of s.components) {
          if (c.type === "Footer" && c.nextScreen === screenId) c.nextScreen = "SUCCESS";
        }
      }
      setSelectedScreenId(draft.screens[0].id);
      setSelectedComponentId(null);
    });
  }

  function addComponent(type: ComponentType) {
    if (!selectedScreen) return;

    // A screen has exactly one submit button. If one already exists,
    // "Add" just selects it rather than creating a second — otherwise
    // the flow would validate with "more than one Footer button".
    const existingFooter = selectedScreen.components.find((c) => c.type === "Footer");
    if (type === "Footer" && existingFooter) {
      setSelectedComponentId(existingFooter.id);
      toast.info("This screen already has a submit button — selected it below");
      return;
    }

    update((draft) => {
      const screen = draft.screens.find((s) => s.id === selectedScreen.id);
      if (!screen) return;
      const comp = newComponent(type);
      // A Footer should always be the last component on a screen.
      const footerIdx = screen.components.findIndex((c) => c.type === "Footer");
      if (footerIdx >= 0 && type !== "Footer") {
        screen.components.splice(footerIdx, 0, comp);
      } else {
        screen.components.push(comp);
      }
      setSelectedComponentId(comp.id);
    });
  }

  // Quick blocks add several components at once (e.g. a 3-field lead
  // form) right before the screen's submit button, so a common
  // pattern doesn't need assembling one field at a time.
  function addQuickBlock(key: QuickBlockKey) {
    if (!selectedScreen) return;
    update((draft) => {
      const screen = draft.screens.find((s) => s.id === selectedScreen.id);
      if (!screen) return;
      const fields = newQuickBlock(key);
      const footerIdx = screen.components.findIndex((c) => c.type === "Footer");
      if (footerIdx >= 0) {
        screen.components.splice(footerIdx, 0, ...fields);
      } else {
        screen.components.push(...fields);
      }
      setSelectedComponentId(fields[0].id);
    });
    toast.success("Fields added");
  }

  function updateComponent(componentId: string, patch: Partial<FlowComponent>) {
    update((draft) => {
      const screen = draft.screens.find((s) => s.id === selectedScreenId);
      if (!screen) return;
      const idx = screen.components.findIndex((c) => c.id === componentId);
      if (idx < 0) return;
      screen.components[idx] = { ...screen.components[idx], ...patch };
    });
  }

  function deleteComponent(componentId: string) {
    update((draft) => {
      const screen = draft.screens.find((s) => s.id === selectedScreenId);
      if (!screen) return;
      screen.components = screen.components.filter((c) => c.id !== componentId);
      setSelectedComponentId(null);
    });
  }

  function updateScreen(screenId: string, patch: Partial<FlowScreen>) {
    update((draft) => {
      const screen = draft.screens.find((s) => s.id === screenId);
      if (!screen) return;
      Object.assign(screen, patch);
    });
  }

  function updateFlowMeta(patch: Partial<FlowDefinition>) {
    update((draft) => Object.assign(draft, patch));
  }

  // ── Loading state ────────────────────────────────────────────────
  if (!flow || !selectedScreen) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
          Loading flow…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/flows-lab`}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/30">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <Input
              value={flow.name}
              onChange={(e) => updateFlowMeta({ name: e.target.value })}
              className="h-7 border-0 bg-transparent px-0 text-lg font-bold text-slate-900 shadow-none focus-visible:ring-0"
              placeholder="Untitled flow"
            />
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-medium">v{flow.version}</span>
              <span className="text-slate-300">•</span>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700">BETA</span>
              <span className="text-slate-300">•</span>
              <span>Saved automatically</span>
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {problems.length > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              {problems.length} issue{problems.length === 1 ? "" : "s"}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <Check className="h-3.5 w-3.5" />
              Ready to test
            </div>
          )}
          <Link
            href={`/flows-lab/${flow.id}/test`}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-emerald-600/30 transition-all hover:shadow-md hover:shadow-emerald-600/40 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            Test flow
          </Link>
        </div>
      </div>

      {/* ── Three-pane layout ────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: screens list */}
        <div className="col-span-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-2 pt-1">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              <LayoutGrid className="h-3.5 w-3.5 text-emerald-600" />
              Screens
            </h3>
            <button
              onClick={addScreen}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
              title="Add screen"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {flow.screens.map((s, i) => {
              const active = selectedScreenId === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setSelectedScreenId(s.id);
                      setSelectedComponentId(null);
                    }}
                    className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm transition-all ${
                      active
                        ? "bg-emerald-50 ring-1 ring-emerald-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                        active
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`truncate text-xs font-semibold ${active ? "text-emerald-900" : "text-slate-700"}`}>
                        {s.title || `Screen ${i + 1}`}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {s.components.length} component{s.components.length === 1 ? "" : "s"}
                        {flow.startScreenId === s.id && (
                          <span className="ml-1 font-semibold text-emerald-600">· Start</span>
                        )}
                      </p>
                    </div>
                    <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-slate-300 opacity-0 group-hover:opacity-100" />
                    {flow.screens.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteScreen(s.id);
                        }}
                        className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
                      </button>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Flow-level meta at the bottom of this pane */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <Label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Category
            </Label>
            <Select
              value={flow.category}
              onValueChange={(v) => updateFlowMeta({ category: v as FlowDefinition["category"] })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLOW_CATEGORIES.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.emoji} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label className="mt-3 mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Description
            </Label>
            <Textarea
              value={flow.description ?? ""}
              onChange={(e) => updateFlowMeta({ description: e.target.value })}
              placeholder="Internal note about this flow"
              className="h-16 text-xs resize-none"
            />
          </div>
        </div>

        {/* Middle: phone preview */}
        <div className="col-span-5 flex flex-col items-center rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 via-white to-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live preview — click any element to edit it
          </div>
          <PhonePreview
            screen={selectedScreen}
            onSelectComponent={setSelectedComponentId}
            selectedComponentId={selectedComponentId}
          />
        </div>

        {/* Right: inspector */}
        <div className="col-span-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <InspectorPanel
            flow={flow}
            screen={selectedScreen}
            component={selectedComponent}
            onUpdateScreen={(patch) => updateScreen(selectedScreen.id, patch)}
            onUpdateComponent={(patch) =>
              selectedComponent && updateComponent(selectedComponent.id, patch)
            }
            onDeleteComponent={() =>
              selectedComponent && deleteComponent(selectedComponent.id)
            }
            onAddComponent={addComponent}
            onAddQuickBlock={addQuickBlock}
            onSetAsStart={() => updateFlowMeta({ startScreenId: selectedScreen.id })}
          />
        </div>
      </div>

      {/* Problems panel */}
      {problems.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" />
            {problems.length} issue{problems.length === 1 ? "" : "s"} to fix
          </div>
          <ul className="ml-5 list-disc space-y-0.5 text-xs text-amber-800">
            {problems.map((p, i) => (<li key={i}>{p}</li>))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Inspector Panel — screen title + component editor
// ─────────────────────────────────────────────────────────────

function InspectorPanel({
  flow, screen, component,
  onUpdateScreen, onUpdateComponent, onDeleteComponent, onAddComponent, onAddQuickBlock, onSetAsStart,
}: {
  flow: FlowDefinition;
  screen: FlowScreen;
  component: FlowComponent | null;
  onUpdateScreen: (patch: Partial<FlowScreen>) => void;
  onUpdateComponent: (patch: Partial<FlowComponent>) => void;
  onDeleteComponent: () => void;
  onAddComponent: (type: ComponentType) => void;
  onAddQuickBlock: (key: QuickBlockKey) => void;
  onSetAsStart: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Screen properties */}
      <div className="border-b border-slate-100 bg-slate-50/60 p-4 rounded-t-2xl">
        <Label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Screen title
        </Label>
        <Input
          value={screen.title}
          onChange={(e) => onUpdateScreen({ title: e.target.value })}
          className="h-8 bg-white text-xs"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-[11px] ${flow.startScreenId === screen.id ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "bg-white"}`}
            onClick={onSetAsStart}
            disabled={flow.startScreenId === screen.id}
          >
            {flow.startScreenId === screen.id ? "✓ Start screen" : "Set as start"}
          </Button>
        </div>
      </div>

      {/* Component editor or add menu */}
      <div className="flex-1 overflow-y-auto">
        {component ? (
          <ComponentInspector
            key={component.id}
            component={component}
            screens={flow.screens}
            onUpdate={onUpdateComponent}
            onDelete={onDeleteComponent}
          />
        ) : (
          <AddComponentMenu onAdd={onAddComponent} onAddQuickBlock={onAddQuickBlock} />
        )}
      </div>
    </div>
  );
}

function AddComponentMenu({
  onAdd, onAddQuickBlock,
}: {
  onAdd: (t: ComponentType) => void;
  onAddQuickBlock: (key: QuickBlockKey) => void;
}) {
  // Group the menu so the phone components (which read as "text /
  // media / input") map to the same buckets a user thinks in.
  const groups = COMPONENT_MENU.reduce<Record<string, typeof COMPONENT_MENU>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
        Add to this screen
      </div>
      <p className="mb-4 text-[11px] text-slate-500">
        Click anything below to drop it onto the screen. Everything shows up instantly in the preview.
      </p>

      {/* ── Quick blocks — one click for a whole field group ──────── */}
      <div className="mb-5">
        <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
          <Zap className="h-3 w-3" />
          Quick blocks
        </p>
        <div className="flex flex-col gap-2">
          {QUICK_BLOCKS.map((block) => {
            const Icon = QUICK_BLOCK_ICON[block.key];
            const s = COLOR_STYLES.amber;
            return (
              <button
                key={block.key}
                onClick={() => onAddQuickBlock(block.key)}
                className={`group flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-left transition-all ${s.hoverBorder} hover:bg-amber-50 hover:shadow-sm`}
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${s.iconBg} ${s.iconText}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800">{block.label}</p>
                  <p className="text-[10.5px] text-slate-500">{block.description}</p>
                </div>
                <Plus className="h-3.5 w-3.5 flex-shrink-0 text-amber-500 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Individual components, grouped and color-coded ────────── */}
      {Object.entries(groups).map(([group, items]) => {
        const color = GROUP_COLOR[group] ?? "sky";
        const s = COLOR_STYLES[color];
        return (
          <div key={group} className="mb-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {group}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => onAdd(item.type)}
                    className={`group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition-all ${s.hoverBorder} ${s.hoverBg}`}
                  >
                    <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${s.iconBg} ${s.iconText}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ComponentInspector({
  component, screens, onUpdate, onDelete,
}: {
  component: FlowComponent;
  screens: FlowScreen[];
  onUpdate: (patch: Partial<FlowComponent>) => void;
  onDelete: () => void;
}) {
  const isText = ["TextHeading", "TextSubheading", "TextBody", "TextCaption"].includes(component.type);
  const isInput = ["TextInput", "TextArea"].includes(component.type);
  const hasOptions = ["RadioButtonsGroup", "CheckboxGroup", "Dropdown"].includes(component.type);
  const isDate = component.type === "DatePicker";
  const isFooter = component.type === "Footer";
  const isImage = component.type === "Image";
  const isOptIn = component.type === "OptIn";
  const isLink = component.type === "EmbeddedLink";

  const menuEntry = COMPONENT_MENU.find((m) => m.type === component.type);
  const color = menuEntry ? (GROUP_COLOR[menuEntry.group] ?? "sky") : "sky";
  const s = COLOR_STYLES[color];
  const Icon = menuEntry?.icon ?? Sparkles;

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.iconBg} ${s.iconText}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${s.chipBg} ${s.chipText}`}>
            {menuEntry?.label ?? component.type}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Text components */}
      {isText && (
        <Field label="Text">
          <Textarea
            value={component.text ?? ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            className="text-xs"
            rows={3}
          />
        </Field>
      )}

      {isLink && (
        <>
          <Field label="Link text">
            <Input
              value={component.text ?? ""}
              onChange={(e) => onUpdate({ text: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="URL">
            <Input
              value={component.onClickUrl ?? ""}
              onChange={(e) => onUpdate({ onClickUrl: e.target.value })}
              placeholder="https://…"
              className="h-8 text-xs"
            />
          </Field>
        </>
      )}

      {isImage && (
        <>
          <Field label="Image URL">
            <Input
              value={component.src ?? ""}
              onChange={(e) => onUpdate({ src: e.target.value })}
              placeholder="https://…"
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Alt text">
            <Input
              value={component.altText ?? ""}
              onChange={(e) => onUpdate({ altText: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Aspect ratio">
            <Select
              value={component.aspectRatio ?? "16:9"}
              onValueChange={(v) => onUpdate({ aspectRatio: (v as string) ?? undefined })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">Square (1:1)</SelectItem>
                <SelectItem value="4:3">Standard (4:3)</SelectItem>
                <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}

      {/* Input-y components (all share label + name + required) */}
      {(isInput || hasOptions || isDate || isOptIn) && (
        <>
          <Field label="Label">
            <Input
              value={component.label ?? ""}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Field name (in response payload)">
            <Input
              value={component.name ?? ""}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g. full_name"
              className="h-8 text-xs font-mono"
            />
          </Field>
          <div className="mb-3 flex items-center gap-2">
            <Switch
              checked={component.required ?? false}
              onCheckedChange={(v) => onUpdate({ required: v })}
            />
            <Label className="text-xs">Required</Label>
          </div>
        </>
      )}

      {/* Free-text specifics */}
      {isInput && (
        <>
          <Field label="Placeholder">
            <Input
              value={component.placeholder ?? ""}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          {component.type === "TextInput" && (
            <Field label="Input type">
              <Select
                value={component.inputType ?? "text"}
                onValueChange={(v) => onUpdate({ inputType: v as FlowComponent["inputType"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="password">Password</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Field label="Min chars" small>
              <Input
                type="number"
                value={component.minChars ?? ""}
                onChange={(e) => onUpdate({ minChars: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Max chars" small>
              <Input
                type="number"
                value={component.maxChars ?? ""}
                onChange={(e) => onUpdate({ maxChars: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-xs"
              />
            </Field>
          </div>
        </>
      )}

      {hasOptions && <OptionsEditor component={component} onUpdate={onUpdate} />}

      {isDate && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Earliest" small>
            <Input
              type="date"
              value={component.minDate ?? ""}
              onChange={(e) => onUpdate({ minDate: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Latest" small>
            <Input
              type="date"
              value={component.maxDate ?? ""}
              onChange={(e) => onUpdate({ maxDate: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
        </div>
      )}

      {/* Footer / submit-button specifics */}
      {isFooter && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            <Send className="h-3 w-3" />
            Submit button
          </div>
          <Field label="Button label">
            <Input
              value={component.buttonLabel ?? ""}
              onChange={(e) => onUpdate({ buttonLabel: e.target.value })}
              className="h-8 bg-white text-xs"
            />
          </Field>
          <Field label="When tapped">
            <Select
              value={component.onClickAction ?? "navigate"}
              onValueChange={(v) => onUpdate({ onClickAction: v as FlowComponent["onClickAction"] })}
            >
              <SelectTrigger className="h-8 bg-white text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="navigate">Go to another screen</SelectItem>
                <SelectItem value="complete">Submit &amp; complete flow</SelectItem>
                <SelectItem value="data_exchange">Fetch next screen from server</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {(component.onClickAction === "navigate" || !component.onClickAction) && (
            <Field label="Go to screen">
              <Select
                value={component.nextScreen ?? "SUCCESS"}
                onValueChange={(v) => onUpdate({ nextScreen: (v as string) ?? undefined })}
              >
                <SelectTrigger className="h-8 bg-white text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {screens.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                  <SelectItem value="SUCCESS">✓ End flow (SUCCESS)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {component.onClickAction === "complete" && (
            <p className="text-[10.5px] leading-relaxed text-emerald-700">
              This is the final submit — tapping it ends the flow and hands every answer collected so far back to your workflow.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, small, children }: { label: string; small?: boolean; children: React.ReactNode }) {
  return (
    <div className={small ? "mb-2" : "mb-3"}>
      <Label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </Label>
      {children}
    </div>
  );
}

function OptionsEditor({
  component, onUpdate,
}: {
  component: FlowComponent;
  onUpdate: (patch: Partial<FlowComponent>) => void;
}) {
  const options = component.options ?? [];
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Options</Label>
        <button
          onClick={() => {
            const id = `opt_${Math.random().toString(36).slice(2, 6)}`;
            onUpdate({ options: [...options, { id, title: `Option ${options.length + 1}` }] });
          }}
          className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {options.map((opt, i) => (
          <li key={opt.id} className="flex items-center gap-1">
            <Input
              value={opt.title}
              onChange={(e) => {
                const next = [...options];
                next[i] = { ...opt, title: e.target.value };
                onUpdate({ options: next });
              }}
              className="h-7 text-xs"
              placeholder={`Option ${i + 1}`}
            />
            <button
              onClick={() => {
                onUpdate({ options: options.filter((_, idx) => idx !== i) });
              }}
              className="p-1 text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
