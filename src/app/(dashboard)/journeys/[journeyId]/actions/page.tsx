"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, Zap, Globe, Loader2, Trash2, Pencil, X, Save,
  ChevronDown, ChevronRight, Workflow,
} from "lucide-react";
import type { ActionBinding } from "@/types/journey";

interface ActionWithUsage extends ActionBinding {
  used_in_journeys?: { id: string; name: string }[];
}

const EMPTY_FORM: Partial<ActionBinding> = {
  name: "",
  trigger_keywords: [],
  method: "POST",
  endpoint: "",
  headers: {},
  body_template: "",
  response_mapping: {},
};

export default function ActionsPage() {
  const params = useParams<{ journeyId: string }>();
  const supabase = createClient();

  const [actions, setActions] = useState<ActionWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Partial<ActionBinding>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("action_bindings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("action_bindings table not provisioned:", error.message);
        setActions([]);
      } else {
        setActions((data ?? []) as ActionWithUsage[]);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function startNew() {
    setEditingId("new");
    setForm(EMPTY_FORM);
    setKeywordDraft("");
  }

  function startEdit(action: ActionWithUsage) {
    setEditingId(action.id);
    setForm(action);
    setKeywordDraft("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setKeywordDraft("");
  }

  function addKeyword() {
    if (!keywordDraft.trim()) return;
    const next = [...(form.trigger_keywords ?? []), keywordDraft.trim()];
    setForm({ ...form, trigger_keywords: next });
    setKeywordDraft("");
  }

  function removeKeyword(idx: number) {
    const next = (form.trigger_keywords ?? []).filter((_, i) => i !== idx);
    setForm({ ...form, trigger_keywords: next });
  }

  async function handleSave() {
    if (!form.name?.trim() || !form.endpoint?.trim()) {
      toast.error("Name and endpoint are required");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        user_id: user.id,
        name: form.name,
        trigger_keywords: form.trigger_keywords ?? [],
        method: form.method ?? "POST",
        endpoint: form.endpoint,
        headers: form.headers ?? {},
        body_template: form.body_template ?? "",
        response_mapping: form.response_mapping ?? {},
      };

      if (editingId === "new") {
        const { data, error } = await supabase
          .from("action_bindings")
          .insert(payload)
          .select().single();
        if (error || !data) { toast.error("Couldn't save action"); return; }
        setActions((prev) => [data as ActionWithUsage, ...prev]);
        toast.success("Action created");
      } else if (editingId) {
        const { data, error } = await supabase
          .from("action_bindings")
          .update(payload)
          .eq("id", editingId)
          .select().single();
        if (error || !data) { toast.error("Couldn't update action"); return; }
        setActions((prev) => prev.map((a) => (a.id === editingId ? (data as ActionWithUsage) : a)));
        toast.success("Action updated");
      }
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(action: ActionWithUsage) {
    if (action.used_in_journeys?.length) {
      toast.error(`Used in ${action.used_in_journeys.length} journey(s) — remove from canvas first`);
      return;
    }
    if (!confirm(`Delete "${action.name}"?`)) return;
    const { error } = await supabase.from("action_bindings").delete().eq("id", action.id);
    if (error) { toast.error("Couldn't delete"); return; }
    setActions((prev) => prev.filter((a) => a.id !== action.id));
    toast.success("Action removed");
  }

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-md">
              <Zap className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
                External actions
              </h2>
              <p className="mt-1 text-xs text-slate-500 max-w-xl">
                Connect your AI agent to APIs. When a customer&apos;s intent matches the keywords,
                this action fires and the response feeds back into the conversation.
              </p>
            </div>
          </div>
          {!editingId && (
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white"
              style={{
                background: "linear-gradient(135deg,#10b981,#059669)",
                boxShadow: "0 4px 12px rgba(16,185,129,.3)",
              }}
            >
              <Plus className="size-3.5" /> New Action
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      {editingId && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-md overflow-hidden relative">
          <span className="absolute left-0 right-0 top-0 h-[3px] bg-emerald-500" />
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
              {editingId === "new" ? "New action" : "Edit action"}
            </h3>
            <button onClick={cancelEdit} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name">
              <input
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Check Order Status"
                className={inputCls}
              />
            </Field>
            <Field label="HTTP Method">
              <select
                value={form.method ?? "POST"}
                onChange={(e) => setForm({ ...form, method: e.target.value as "GET" | "POST" })}
                className={`${inputCls} bg-white`}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Endpoint URL">
              <input
                value={form.endpoint ?? ""}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder="https://api.yourstore.com/orders/{{order_id}}"
                className={`${inputCls} font-mono`}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Trigger keywords">
              {(form.trigger_keywords?.length ?? 0) > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {form.trigger_keywords?.map((kw, i) => (
                    <span
                      key={i}
                      className="group inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                    >
                      {kw}
                      <button onClick={() => removeKeyword(i)} className="opacity-50 hover:opacity-100">
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="order status, track my order"
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={addKeyword}
                  className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  <Plus className="size-3" /> Add
                </button>
              </div>
            </Field>
          </div>

          {form.method === "POST" && (
            <div className="mt-4">
              <Field label="Body template (JSON)">
                <textarea
                  value={form.body_template ?? ""}
                  onChange={(e) => setForm({ ...form, body_template: e.target.value })}
                  placeholder='{\n  "order_id": "{{order_id}}",\n  "customer_phone": "{{phone}}"\n}'
                  rows={5}
                  className={`${inputCls} font-mono text-xs`}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Use <code className="bg-slate-100 px-1 rounded">{`{{variable}}`}</code> placeholders.
                </p>
              </Field>
            </div>
          )}

          <div className="mt-4">
            <Field label="Response mapping">
              <textarea
                value={JSON.stringify(form.response_mapping ?? {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setForm({ ...form, response_mapping: parsed });
                  } catch {
                    // accept invalid JSON during typing; only save when valid
                  }
                }}
                placeholder='{\n  "order_status": "status",\n  "tracking_url": "shipping.tracking_url"\n}'
                rows={4}
                className={`${inputCls} font-mono text-xs`}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Map API response fields → conversation variables.
              </p>
            </Field>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={cancelEdit}
              className="rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg,#10b981,#059669)",
                boxShadow: "0 4px 12px rgba(16,185,129,.3)",
              }}
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Save Action
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        <div className="border-b border-[#e7ece9] bg-[#f8faf9] px-5 py-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Your actions ({actions.length}) — shared across all journeys
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
              <Zap className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No actions yet</p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              Create your first API binding above. Actions can be reused across multiple journeys.
            </p>
          </div>
        ) : (
          <div>
            {actions.map((action) => {
              const expanded = expandedId === action.id;
              const usageCount = action.used_in_journeys?.length ?? 0;
              return (
                <div key={action.id} className="border-b border-[#e7ece9] last:border-b-0">
                  <div className="group flex items-center gap-3 px-5 py-3.5 hover:bg-[#f8faf9]">
                    <button
                      onClick={() => setExpandedId(expanded ? null : action.id)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                    <div
                      className="flex size-9 items-center justify-center rounded-lg text-white shrink-0"
                      style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
                    >
                      <Globe className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#0c1f17] truncate">{action.name}</span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                          {action.method}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate font-mono">
                        {action.endpoint}
                      </div>
                    </div>
                    {usageCount > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        <Workflow className="size-2.5" />
                        Used in {usageCount}
                      </span>
                    )}
                    <button
                      onClick={() => startEdit(action)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(action)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  {expanded && (
                    <div className="px-5 pb-4 pl-16 bg-[#f8faf9] border-t border-[#e7ece9]">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mt-3">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Trigger keywords
                          </div>
                          {action.trigger_keywords.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {action.trigger_keywords.map((kw, i) => (
                                <span key={i} className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">No keywords set</span>
                          )}
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Used in journeys
                          </div>
                          {action.used_in_journeys?.length ? (
                            <ul className="space-y-0.5">
                              {action.used_in_journeys.map((j) => (
                                <li key={j.id} className="text-[11px] text-emerald-700 font-semibold">
                                  · {j.name}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-[11px] text-slate-400">Not used anywhere yet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
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
