"use client";

import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Plus, X, Loader2, Save } from "lucide-react";
import type { Node } from "reactflow";
import type { NodeType } from "@/types/journey";
import { NODE_CATALOG } from "@/types/journey";

interface NodeConfigDrawerProps {
  node: Node | null;
  open: boolean;
  onClose: () => void;
  onSave: (nodeId: string, data: Record<string, unknown>) => void;
}

export function NodeConfigDrawer({ node, open, onClose, onSave }: NodeConfigDrawerProps) {
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node) setDraft({ ...node.data });
  }, [node]);

  if (!node) return null;

  const nodeType = (node.data?.nodeType ?? node.type) as NodeType;
  const meta = NODE_CATALOG.find((m) => m.type === nodeType);

  function save() {
    onSave(node!.id, draft);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-white border-l border-[#e7ece9] overflow-y-auto">
        <SheetHeader className="border-b border-[#e7ece9] pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-xl text-white"
              style={{
                background: `linear-gradient(135deg,${meta?.accent ?? "#10b981"},${meta?.accent ?? "#10b981"}dd)`,
                boxShadow: `0 6px 14px ${meta?.accent ?? "#10b981"}55`,
              }}
            >
              <span className="text-lg">⚙</span>
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
                Configure {meta?.label ?? "Node"}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                {meta?.group} · Set up what this node does
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 py-5">
          <NodeFormBody nodeType={nodeType} draft={draft} setDraft={setDraft} />
        </div>

        <div className="sticky bottom-0 -mx-6 border-t border-[#e7ece9] bg-white px-6 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white"
            style={{
              background: "linear-gradient(135deg,#10b981,#059669)",
              boxShadow: "0 4px 12px rgba(16,185,129,.3)",
            }}
          >
            <Save className="size-3.5" /> Save Node
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NodeFormBody({
  nodeType, draft, setDraft,
}: {
  nodeType: NodeType;
  draft: Record<string, any>;
  setDraft: (d: Record<string, any>) => void;
}) {
  const set = (k: string, v: unknown) => setDraft({ ...draft, [k]: v });

  // TEXT_BUTTONS — message text + up to 3 reply buttons
  if (nodeType === "TEXT_BUTTONS") {
    const buttons: string[] = draft.buttons ?? [];
    return (
      <>
        <Field label="Message text">
          <textarea
            value={draft.text ?? ""}
            onChange={(e) => set("text", e.target.value)}
            placeholder="Hi! How can we help you today?"
            rows={4}
            className={inputCls}
          />
        </Field>
        <Field label={`Buttons (${buttons.length}/3)`}>
          <div className="space-y-2">
            {buttons.map((btn, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={btn}
                  onChange={(e) => {
                    const next = [...buttons];
                    next[i] = e.target.value;
                    set("buttons", next);
                  }}
                  placeholder={`Button ${i + 1} text`}
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() => set("buttons", buttons.filter((_, idx) => idx !== i))}
                  className="rounded-lg border border-[#e7ece9] p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {buttons.length < 3 && (
              <button
                onClick={() => set("buttons", [...buttons, ""])}
                className="flex items-center gap-1 rounded-lg border border-dashed border-[#e7ece9] px-3 py-2 text-xs font-semibold text-slate-500 hover:border-emerald-300 hover:text-emerald-700"
              >
                <Plus className="size-3" /> Add button
              </button>
            )}
          </div>
        </Field>
      </>
    );
  }

  // MEDIA_BUTTONS — media URL + caption + buttons
  if (nodeType === "MEDIA_BUTTONS") {
    return (
      <>
        <Field label="Media type">
          <select value={draft.mediaType ?? "image"} onChange={(e) => set("mediaType", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="document">Document</option>
          </select>
        </Field>
        <Field label="Media URL">
          <input
            value={draft.mediaUrl ?? ""}
            onChange={(e) => set("mediaUrl", e.target.value)}
            placeholder="https://yourcdn.com/banner.jpg"
            className={inputCls}
          />
        </Field>
        <Field label="Caption">
          <textarea value={draft.caption ?? ""} onChange={(e) => set("caption", e.target.value)} rows={3} className={inputCls} />
        </Field>
      </>
    );
  }

  // LIST — header + body + sections
  if (nodeType === "LIST") {
    return (
      <>
        <Field label="Header"><input value={draft.header ?? ""} onChange={(e) => set("header", e.target.value)} className={inputCls} /></Field>
        <Field label="Body"><textarea value={draft.body ?? ""} onChange={(e) => set("body", e.target.value)} rows={3} className={inputCls} /></Field>
        <Field label="Button text"><input value={draft.buttonText ?? "Select"} onChange={(e) => set("buttonText", e.target.value)} className={inputCls} /></Field>
        <p className="text-[11px] text-slate-400">List items editor coming soon — for now the body and button text take effect.</p>
      </>
    );
  }

  // CATALOGUE / SINGLE_PRODUCT / MULTI_PRODUCT
  if (nodeType === "CATALOGUE" || nodeType === "SINGLE_PRODUCT" || nodeType === "MULTI_PRODUCT") {
    return (
      <>
        <Field label="Catalog ID"><input value={draft.catalogId ?? ""} onChange={(e) => set("catalogId", e.target.value)} placeholder="From Meta Commerce Manager" className={`${inputCls} font-mono text-xs`} /></Field>
        {nodeType !== "CATALOGUE" && (
          <Field label="Product retailer IDs (comma-separated)">
            <input value={draft.productIds ?? ""} onChange={(e) => set("productIds", e.target.value)} className={`${inputCls} font-mono text-xs`} />
          </Field>
        )}
        <Field label="Message text"><textarea value={draft.text ?? ""} onChange={(e) => set("text", e.target.value)} rows={3} className={inputCls} /></Field>
      </>
    );
  }

  // TEMPLATE
  if (nodeType === "TEMPLATE") {
    return (
      <>
        <Field label="Template name"><input value={draft.templateName ?? ""} onChange={(e) => set("templateName", e.target.value)} placeholder="welcome_msg" className={`${inputCls} font-mono`} /></Field>
        <Field label="Language"><input value={draft.language ?? "en"} onChange={(e) => set("language", e.target.value)} className={inputCls} /></Field>
        <Field label="Template variables (JSON)">
          <textarea
            value={draft.variables ?? "{}"}
            onChange={(e) => set("variables", e.target.value)}
            placeholder='{"name": "{{contact.name}}", "order_id": "{{order_id}}"}'
            rows={4}
            className={`${inputCls} font-mono text-xs`}
          />
        </Field>
      </>
    );
  }

  // HANDOFF_TO_HUMAN
  if (nodeType === "HANDOFF_TO_HUMAN") {
    return (
      <>
        <Field label="Notification message to agent">
          <textarea value={draft.notification ?? ""} onChange={(e) => set("notification", e.target.value)} placeholder="Customer needs help with their order" rows={3} className={inputCls} />
        </Field>
        <Field label="Assign to (agent ID, optional)"><input value={draft.assignTo ?? ""} onChange={(e) => set("assignTo", e.target.value)} className={inputCls} /></Field>
        <Field label="Message to customer">
          <textarea value={draft.customerMessage ?? "An agent will reply shortly."} onChange={(e) => set("customerMessage", e.target.value)} rows={2} className={inputCls} />
        </Field>
      </>
    );
  }

  // CONVERSION_EVENT
  if (nodeType === "CONVERSION_EVENT") {
    return (
      <>
        <Field label="Event name">
          <select value={draft.eventName ?? "Purchase"} onChange={(e) => set("eventName", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="Purchase">Purchase</option>
            <option value="Lead">Lead</option>
            <option value="AddToCart">Add To Cart</option>
            <option value="InitiateCheckout">Initiate Checkout</option>
            <option value="Subscribe">Subscribe</option>
            <option value="Contact">Contact</option>
          </select>
        </Field>
        <Field label="Value (optional)"><input type="number" value={draft.value ?? ""} onChange={(e) => set("value", e.target.value)} placeholder="500" className={inputCls} /></Field>
        <Field label="Currency"><input value={draft.currency ?? "INR"} onChange={(e) => set("currency", e.target.value)} className={inputCls} /></Field>
      </>
    );
  }

  // CONDITION
  if (nodeType === "CONDITION") {
    return (
      <>
        <Field label="Variable to check"><input value={draft.variable ?? ""} onChange={(e) => set("variable", e.target.value)} placeholder="contact.tag or last_message" className={`${inputCls} font-mono text-xs`} /></Field>
        <Field label="Operator">
          <select value={draft.operator ?? "equals"} onChange={(e) => set("operator", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="equals">Equals</option>
            <option value="contains">Contains</option>
            <option value="starts_with">Starts with</option>
            <option value="greater_than">Greater than</option>
            <option value="less_than">Less than</option>
            <option value="exists">Exists</option>
          </select>
        </Field>
        <Field label="Compare value"><input value={draft.value ?? ""} onChange={(e) => set("value", e.target.value)} className={inputCls} /></Field>
        <p className="text-[11px] text-slate-400">This node has two output handles: Yes (right) and No (down). Connect each branch.</p>
      </>
    );
  }

  // WEBHOOK_CALL
  if (nodeType === "WEBHOOK_CALL") {
    return (
      <>
        <Field label="Action binding">
          <select value={draft.actionId ?? ""} onChange={(e) => set("actionId", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">Choose an action…</option>
            <option value="__create_new">+ Create new action (from Actions tab)</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            Action bindings are defined in the Actions tab. Create one there, then select it here.
          </p>
        </Field>
      </>
    );
  }

  // TAG_CONTACT
  if (nodeType === "TAG_CONTACT") {
    return (
      <>
        <Field label="Operation">
          <select value={draft.operation ?? "add"} onChange={(e) => set("operation", e.target.value)} className={`${inputCls} bg-white`}>
            <option value="add">Add tag</option>
            <option value="remove">Remove tag</option>
          </select>
        </Field>
        <Field label="Tag name"><input value={draft.tagName ?? ""} onChange={(e) => set("tagName", e.target.value)} placeholder="vip-customer" className={inputCls} /></Field>
      </>
    );
  }

  // Fallback
  return (
    <Field label="Notes">
      <textarea value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={4} className={inputCls} />
    </Field>
  );
}

const inputCls =
  "w-full rounded-lg border border-[#e7ece9] bg-white p-2.5 text-sm text-[#0c1f17] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-600">{label}</label>
      {children}
    </div>
  );
}
