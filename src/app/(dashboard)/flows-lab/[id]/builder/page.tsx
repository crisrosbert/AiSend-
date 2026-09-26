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
//   scoped to the current screen.
//
// Everything is saved back to localStorage on every edit — no explicit
// Save button. That's deliberate: this is a test lab, not production;
// losing your work because you forgot to click Save would be a bad
// first impression for a section we might promote.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Plus, Trash2, GripVertical,
  AlertTriangle, Check, LayoutGrid, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  ComponentType, FlowComponent, FlowDefinition, FlowScreen,
} from "@/lib/flows-lab/types";
import { newComponent, newScreen, validateFlow, FLOW_CATEGORIES } from "@/lib/flows-lab/types";
import { getFlow, saveFlow } from "@/lib/flows-lab/storage";
import { PhonePreview } from "@/components/flows-lab/phone-preview";

const COMPONENT_MENU: { type: ComponentType; label: string; group: string }[] = [
  { type: "TextHeading",       label: "Heading",       group: "Text" },
  { type: "TextSubheading",    label: "Subheading",    group: "Text" },
  { type: "TextBody",          label: "Body",          group: "Text" },
  { type: "TextCaption",       label: "Caption",       group: "Text" },
  { type: "Image",             label: "Image",         group: "Media" },
  { type: "TextInput",         label: "Text input",    group: "Input" },
  { type: "TextArea",          label: "Text area",     group: "Input" },
  { type: "RadioButtonsGroup", label: "Single choice", group: "Input" },
  { type: "CheckboxGroup",     label: "Multi choice",  group: "Input" },
  { type: "Dropdown",          label: "Dropdown",      group: "Input" },
  { type: "DatePicker",        label: "Date picker",   group: "Input" },
  { type: "OptIn",             label: "Consent checkbox", group: "Input" },
  { type: "EmbeddedLink",      label: "Link",          group: "Text" },
];

export default function FlowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  const slug = profile?.slug ?? "";

  // ── Load flow on mount ───────────────────────────────────────────
  // localStorage is an external store, so hydrating client-only state
  // in an effect is exactly what this pattern is for.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!id) return;
    const loaded = getFlow(id);
    if (!loaded) {
      toast.error("Flow not found");
      router.replace(`/${slug}/flows-lab`);
      return;
    }
    setFlow(loaded);
    setSelectedScreenId(loaded.startScreenId);
  }, [id, router, slug]);
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
        Loading flow…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}/flows-lab`}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <Input
              value={flow.name}
              onChange={(e) => updateFlowMeta({ name: e.target.value })}
              className="border-0 bg-transparent px-0 text-xl font-bold text-slate-900 shadow-none focus-visible:ring-0"
              placeholder="Untitled flow"
            />
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
              <span>v{flow.version}</span>
              <span className="text-slate-300">•</span>
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-bold text-amber-700">BETA</span>
              <span className="text-slate-300">•</span>
              <span>Saved automatically</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {problems.length > 0 ? (
            <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {problems.length} issue{problems.length === 1 ? "" : "s"}
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              Ready to test
            </div>
          )}
          <Link
            href={`/${slug}/flows-lab/${flow.id}/test`}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <Play className="h-3.5 w-3.5" />
            Test flow
          </Link>
        </div>
      </div>

      {/* ── Three-pane layout ────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: screens list */}
        <div className="col-span-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              <LayoutGrid className="h-3 w-3" />
              Screens
            </h3>
            <button
              onClick={addScreen}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-emerald-600"
              title="Add screen"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {flow.screens.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setSelectedScreenId(s.id);
                    setSelectedComponentId(null);
                  }}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    selectedScreenId === s.id
                      ? "bg-emerald-50 text-emerald-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <GripVertical className="h-3.5 w-3.5 text-slate-300" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-semibold">{s.title || `Screen ${i + 1}`}</p>
                    <p className="text-[10px] text-slate-500">
                      {s.components.length} component{s.components.length === 1 ? "" : "s"}
                      {flow.startScreenId === s.id && " · Start"}
                    </p>
                  </div>
                  {flow.screens.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteScreen(s.id);
                      }}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
                    </button>
                  )}
                </button>
              </li>
            ))}
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
        <div className="col-span-5 flex justify-center rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6">
          <PhonePreview
            screen={selectedScreen}
            onSelectComponent={setSelectedComponentId}
            selectedComponentId={selectedComponentId}
          />
        </div>

        {/* Right: inspector */}
        <div className="col-span-4 rounded-2xl border border-slate-200 bg-white">
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
            onSetAsStart={() => updateFlowMeta({ startScreenId: selectedScreen.id })}
          />
        </div>
      </div>

      {/* Problems panel */}
      {problems.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
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
  onUpdateScreen, onUpdateComponent, onDeleteComponent, onAddComponent, onSetAsStart,
}: {
  flow: FlowDefinition;
  screen: FlowScreen;
  component: FlowComponent | null;
  onUpdateScreen: (patch: Partial<FlowScreen>) => void;
  onUpdateComponent: (patch: Partial<FlowComponent>) => void;
  onDeleteComponent: () => void;
  onAddComponent: (type: ComponentType) => void;
  onSetAsStart: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Screen properties */}
      <div className="border-b border-slate-100 p-4">
        <Label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Screen title
        </Label>
        <Input
          value={screen.title}
          onChange={(e) => onUpdateScreen({ title: e.target.value })}
          className="h-8 text-xs"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-[11px] ${flow.startScreenId === screen.id ? "border-emerald-400 bg-emerald-50 text-emerald-700" : ""}`}
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
          <AddComponentMenu onAdd={onAddComponent} />
        )}
      </div>
    </div>
  );
}

function AddComponentMenu({ onAdd }: { onAdd: (t: ComponentType) => void }) {
  // Group the menu so the phone components (which read as "text /
  // media / input") map to the same buckets a user thinks in.
  const groups = COMPONENT_MENU.reduce<Record<string, typeof COMPONENT_MENU>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-700">
        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
        Add component
      </div>
      <p className="mb-4 text-[11px] text-slate-500">
        Click a component to add it to this screen. It&apos;ll appear in the preview and can be reordered.
      </p>
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {group}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <button
                key={item.type}
                onClick={() => onAdd(item.type)}
                className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <Plus className="h-3 w-3 text-slate-400 group-hover:text-emerald-600" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
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

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
          {component.type}
        </span>
        <button
          onClick={onDelete}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
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

      {/* Footer specifics */}
      {isFooter && (
        <>
          <Field label="Button label">
            <Input
              value={component.buttonLabel ?? ""}
              onChange={(e) => onUpdate({ buttonLabel: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="On click">
            <Select
              value={component.onClickAction ?? "navigate"}
              onValueChange={(v) => onUpdate({ onClickAction: v as FlowComponent["onClickAction"] })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="navigate">Go to another screen</SelectItem>
                <SelectItem value="complete">Complete flow (SUCCESS)</SelectItem>
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
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
        </>
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
