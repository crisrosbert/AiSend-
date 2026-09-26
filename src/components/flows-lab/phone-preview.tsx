"use client";

// src/components/flows-lab/phone-preview.tsx
//
// The phone frame that renders a Lab flow screen the way it would
// appear on a WhatsApp Flow. It's used both in the builder (with
// component-select behaviour) and in the test console (interactive).
//
// This isn't pixel-perfect to WhatsApp's UI — it's close enough that
// the shape and information density read right, and deliberately not
// so close that anyone would mistake the mock for the real thing.

import { CheckCircle2 } from "lucide-react";
import type { FlowComponent, FlowScreen } from "@/lib/flows-lab/types";

interface PhonePreviewProps {
  screen: FlowScreen;
  // Builder mode: click a component to edit it.
  onSelectComponent?: (id: string | null) => void;
  selectedComponentId?: string | null;
  // Test mode: real form controls that call back on change/submit.
  interactive?: boolean;
  values?: Record<string, unknown>;
  onValueChange?: (name: string, value: unknown) => void;
  onSubmit?: (footer: FlowComponent) => void;
  showSuccess?: boolean;
}

export function PhonePreview({
  screen,
  onSelectComponent,
  selectedComponentId,
  interactive = false,
  values = {},
  onValueChange,
  onSubmit,
  showSuccess = false,
}: PhonePreviewProps) {
  return (
    <div className="w-[320px] rounded-[36px] bg-slate-900 p-2 shadow-2xl">
      <div className="rounded-[28px] bg-white overflow-hidden">
        {/* WhatsApp-ish header */}
        <div className="flex items-center gap-2 bg-emerald-700 px-4 py-3 text-white">
          <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">
            L
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold">Lab preview</p>
            <p className="text-[10px] text-emerald-100">online</p>
          </div>
        </div>

        {/* Flow header (title bar) */}
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-[11px] font-medium text-slate-500">Flow</p>
          <h2 className="text-base font-bold text-slate-900">{screen.title || "Untitled screen"}</h2>
        </div>

        {/* Body */}
        <div className="min-h-[440px] max-h-[560px] overflow-y-auto px-4 py-4">
          {showSuccess ? (
            <SuccessState />
          ) : (
            <div className="flex flex-col gap-3">
              {screen.components.map((comp) => (
                <ComponentPreview
                  key={comp.id}
                  component={comp}
                  isSelected={comp.id === selectedComponentId}
                  onClick={
                    onSelectComponent
                      ? () => onSelectComponent(comp.id === selectedComponentId ? null : comp.id)
                      : undefined
                  }
                  interactive={interactive}
                  value={comp.name ? values[comp.name] : undefined}
                  onChange={(v) => comp.name && onValueChange?.(comp.name, v)}
                  onFooterClick={() => onSubmit?.(comp)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessState() {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-emerald-100 p-4">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
      </div>
      <h3 className="mb-1 text-lg font-bold text-slate-900">Flow completed!</h3>
      <p className="text-xs text-slate-500">
        Your response has been submitted.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// One component's rendered form
// ─────────────────────────────────────────────────────────────

function ComponentPreview({
  component, isSelected, onClick, interactive, value, onChange, onFooterClick,
}: {
  component: FlowComponent;
  isSelected: boolean;
  onClick?: () => void;
  interactive: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
  onFooterClick: () => void;
}) {
  // Wrap non-footer components in a click target for builder mode.
  // Footer is a real button in interactive mode, so we skip the wrap.
  const wrapperClass = onClick
    ? `cursor-pointer rounded-lg border-2 transition-all ${
        isSelected
          ? "border-emerald-500 bg-emerald-50/40 p-2 -m-2"
          : "border-transparent hover:border-emerald-200 hover:bg-emerald-50/20 p-2 -m-2"
      }`
    : "";

  const inner = (() => {
    switch (component.type) {
      case "TextHeading":
        return <h2 className="text-lg font-bold text-slate-900">{component.text}</h2>;
      case "TextSubheading":
        return <h3 className="text-sm font-bold text-slate-800">{component.text}</h3>;
      case "TextBody":
        return <p className="text-sm text-slate-700 leading-relaxed">{component.text}</p>;
      case "TextCaption":
        return <p className="text-xs text-slate-500">{component.text}</p>;

      case "Image":
        return component.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={component.src}
            alt={component.altText ?? ""}
            className="w-full rounded-lg object-cover"
            style={{ aspectRatio: (component.aspectRatio ?? "16:9").replace(":", "/") }}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400"
            style={{ aspectRatio: (component.aspectRatio ?? "16:9").replace(":", "/") }}
          >
            Image placeholder
          </div>
        );

      case "EmbeddedLink":
        return (
          <a
            href={component.onClickUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-emerald-600 underline"
            onClick={(e) => !interactive && e.preventDefault()}
          >
            {component.text || "Link"}
          </a>
        );

      case "TextInput":
        return (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {component.label} {component.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type={component.inputType === "phone" ? "tel" : component.inputType ?? "text"}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => interactive && onChange(e.target.value)}
              readOnly={!interactive}
              placeholder={component.placeholder}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
              maxLength={component.maxChars}
            />
          </div>
        );

      case "TextArea":
        return (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {component.label} {component.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={typeof value === "string" ? value : ""}
              onChange={(e) => interactive && onChange(e.target.value)}
              readOnly={!interactive}
              placeholder={component.placeholder}
              rows={3}
              maxLength={component.maxChars}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500 resize-none"
            />
          </div>
        );

      case "RadioButtonsGroup": {
        const current = typeof value === "string" ? value : "";
        return (
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-700">
              {component.label} {component.required && <span className="text-red-500">*</span>}
            </label>
            <div className="flex flex-col gap-1.5">
              {(component.options ?? []).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2 rounded-lg border p-2 text-xs transition-colors ${
                    current === opt.id
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 hover:border-slate-300"
                  } ${interactive ? "cursor-pointer" : ""}`}
                >
                  <input
                    type="radio"
                    checked={current === opt.id}
                    onChange={() => interactive && onChange(opt.id)}
                    disabled={!interactive}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{opt.title}</p>
                    {opt.description && (
                      <p className="text-[10px] text-slate-500">{opt.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        );
      }

      case "CheckboxGroup": {
        const current = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-700">
              {component.label} {component.required && <span className="text-red-500">*</span>}
            </label>
            <div className="flex flex-col gap-1.5">
              {(component.options ?? []).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${
                    current.includes(opt.id)
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 hover:border-slate-300"
                  } ${interactive ? "cursor-pointer" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={current.includes(opt.id)}
                    onChange={() => {
                      if (!interactive) return;
                      onChange(
                        current.includes(opt.id)
                          ? current.filter((v) => v !== opt.id)
                          : [...current, opt.id],
                      );
                    }}
                    disabled={!interactive}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{opt.title}</p>
                    {opt.description && (
                      <p className="text-[10px] text-slate-500">{opt.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        );
      }

      case "Dropdown":
        return (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {component.label} {component.required && <span className="text-red-500">*</span>}
            </label>
            <select
              value={typeof value === "string" ? value : ""}
              onChange={(e) => interactive && onChange(e.target.value)}
              disabled={!interactive}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
            >
              <option value="">Select…</option>
              {(component.options ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.title}</option>
              ))}
            </select>
          </div>
        );

      case "DatePicker":
        return (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {component.label} {component.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="date"
              value={typeof value === "string" ? value : ""}
              onChange={(e) => interactive && onChange(e.target.value)}
              readOnly={!interactive}
              min={component.minDate}
              max={component.maxDate}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
            />
          </div>
        );

      case "OptIn":
        return (
          <label className={`flex items-start gap-2 ${interactive ? "cursor-pointer" : ""}`}>
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => interactive && onChange(e.target.checked)}
              disabled={!interactive}
              className="mt-0.5 accent-emerald-600"
            />
            <span className="text-xs text-slate-700">
              {component.label} {component.required && <span className="text-red-500">*</span>}
            </span>
          </label>
        );

      case "Footer":
        return (
          <button
            onClick={interactive ? onFooterClick : undefined}
            disabled={!interactive}
            className={`mt-2 w-full rounded-full py-3 text-sm font-bold text-white transition-colors ${
              interactive
                ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                : "bg-emerald-600/80 cursor-default"
            }`}
          >
            {component.buttonLabel || "Continue"}
          </button>
        );
    }
  })();

  if (onClick) {
    return (
      <div className={wrapperClass} onClick={onClick}>
        {inner}
      </div>
    );
  }
  return <div>{inner}</div>;
}
