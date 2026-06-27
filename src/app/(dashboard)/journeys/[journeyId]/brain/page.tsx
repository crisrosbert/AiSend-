"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, FileText, Link as LinkIcon, HelpCircle, Loader2,
  Trash2, CheckCircle2, AlertCircle, X, Upload, BookOpen,
} from "lucide-react";
import type { BrainSource, BrainSourceType, BrainSourceStatus } from "@/types/journey";

type AddType = BrainSourceType | null;

const SOURCE_META: Record<BrainSourceType, {
  label: string; description: string; icon: typeof FileText; accent: string;
}> = {
  file: { label: "File",     description: "Upload PDFs, docs, or text files", icon: FileText, accent: "#10b981" },
  url:  { label: "URL",      description: "Crawl a webpage for content",      icon: LinkIcon, accent: "#3b82f6" },
  faq:  { label: "FAQ Pair", description: "Add a structured question + answer", icon: HelpCircle, accent: "#8b5cf6" },
};

const STATUS_META: Record<BrainSourceStatus, { label: string; class: string; icon: typeof CheckCircle2 }> = {
  ready:      { label: "Ready",      class: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  processing: { label: "Processing", class: "bg-amber-50 text-amber-700 border-amber-200",       icon: Loader2 },
  failed:     { label: "Failed",     class: "bg-red-50 text-red-700 border-red-200",             icon: AlertCircle },
};

export default function BrainPage() {
  const params = useParams<{ journeyId: string }>();
  const supabase = createClient();
  const journeyId = params.journeyId;

  const [sources, setSources] = useState<BrainSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [addType, setAddType] = useState<AddType>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSources([]); setLoading(false); return; }

      const { data, error } = await supabase
        .from("brain_sources")
        .select("*")
        .eq("user_id", user.id)
        .eq("journey_id", journeyId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("brain_sources table not provisioned:", error.message);
        setSources([]);
      } else {
        setSources((data ?? []) as BrainSource[]);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, journeyId]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  function resetForm() {
    setTitle(""); setContent(""); setSourceUrl("");
    setFaqQuestion(""); setFaqAnswer("");
    setAddType(null);
  }

  async function handleAdd() {
    if (!addType) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in required"); return; }

      let payload: Partial<BrainSource> & { user_id: string; journey_id: string };

      if (addType === "faq") {
        if (!faqQuestion.trim() || !faqAnswer.trim()) {
          toast.error("Both question and answer are required");
          setSaving(false);
          return;
        }
        payload = {
          user_id: user.id,
          journey_id: journeyId,
          type: "faq",
          title: faqQuestion.slice(0, 100),
          content: `Q: ${faqQuestion}\n\nA: ${faqAnswer}`,
          status: "processing", // changed from "ready" — ingestSource() will flip to "ready"
        };
      } else if (addType === "url") {
        if (!sourceUrl.trim()) {
          toast.error("URL is required");
          setSaving(false);
          return;
        }
        payload = {
          user_id: user.id,
          journey_id: journeyId,
          type: "url",
          title: title.trim() || new URL(sourceUrl).hostname,
          source_url: sourceUrl.trim(),
          status: "processing",
        };
      } else {
        if (!title.trim() || !content.trim()) {
          toast.error("Title and content are required");
          setSaving(false);
          return;
        }
        payload = {
          user_id: user.id,
          journey_id: journeyId,
          type: "file",
          title: title.trim(),
          content: content.trim(),
          status: "processing", // changed from "ready" — ingestSource() will flip to "ready"
        };
      }

      const { data, error } = await supabase
        .from("brain_sources")
        .insert(payload)
        .select().single();

      if (error || !data) {
        toast.error("Couldn't save source. Run the brain_sources migration.");
        return;
      }

      toast.success(`${SOURCE_META[addType].label} added`);
      setSources((prev) => [data as BrainSource, ...prev]);
      resetForm();

      // Trigger ingestion — chunk the content into agent_kb_chunks so the
      // AI agent can search it. Without this the source is saved but the
      // agent has nothing to retrieve.
      void ingestSource(data as BrainSource);
    } finally {
      setSaving(false);
    }
  }

  async function ingestSource(source: BrainSource) {
    // FAQ and file/text are ready immediately to ingest from their content.
    // URL sources need the server to fetch the page first.
    try {
      // Optimistically show "processing" while chunks are created
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id ? { ...s, status: "processing" as const } : s
        )
      );

      const res = await fetch("/api/agent/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_id: source.id,
          journey_id: journeyId,
          source_type: source.type === "file" ? "text" : source.type,
          content: source.content ?? undefined,
          url: source.source_url ?? undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.status === "failed") {
        toast.error(`Indexing failed: ${result.error || "unknown error"}`);
        setSources((prev) =>
          prev.map((s) =>
            s.id === source.id ? { ...s, status: "failed" as const } : s
          )
        );
        return;
      }

      toast.success(`Indexed ${result.chunksCreated} chunks`);
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id ? { ...s, status: "ready" as const } : s
        )
      );
    } catch (err) {
      console.error("ingestSource error:", err);
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id ? { ...s, status: "failed" as const } : s
        )
      );
    }
  }

  async function handleDelete(source: BrainSource) {
    if (!confirm(`Delete "${source.title}"?`)) return;
    const { error } = await supabase.from("brain_sources").delete().eq("id", source.id);
    if (error) { toast.error("Couldn't delete"); return; }
    toast.success("Source removed");
    setSources((prev) => prev.filter((s) => s.id !== source.id));
  }

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
            <BookOpen className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
              Knowledge sources
            </h2>
            <p className="mt-1 text-xs text-slate-500 max-w-xl">
              Add files, URLs, and FAQ pairs your AI agent can reference when replying.
              These ground the agent's answers in your actual business content.
            </p>
          </div>
        </div>
      </div>

      {/* Add source CTA */}
      {!addType && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(SOURCE_META) as BrainSourceType[]).map((type) => {
            const meta = SOURCE_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                onClick={() => setAddType(type)}
                className="group flex items-start gap-3 rounded-xl border border-[#e7ece9] bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <div
                  className="flex size-10 items-center justify-center rounded-xl text-white shrink-0 transition-transform group-hover:scale-110"
                  style={{
                    background: `linear-gradient(135deg,${meta.accent},${meta.accent}dd)`,
                    boxShadow: `0 6px 14px ${meta.accent}55`,
                  }}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-[#0c1f17]">{meta.label}</h3>
                    <Plus className="size-3 text-slate-300 group-hover:text-emerald-500" />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {addType && (
        <div className="rounded-2xl border border-[#e7ece9] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
              Add {SOURCE_META[addType].label}
            </h3>
            <button onClick={resetForm} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
              <X className="size-4" />
            </button>
          </div>

          {addType === "file" && (
            <div className="space-y-3">
              <Field label="Title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Product FAQ Document"
                  className={inputCls}
                />
              </Field>
              <Field label="Content">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your document content here..."
                  rows={8}
                  className={inputCls}
                />
              </Field>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Upload className="size-3" />
                File upload (PDF, DOCX) parsing comes in the next iteration.
              </p>
            </div>
          )}

          {addType === "url" && (
            <div className="space-y-3">
              <Field label="Title (optional)">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Pricing page"
                  className={inputCls}
                />
              </Field>
              <Field label="URL">
                <input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  className={inputCls}
                />
              </Field>
              <p className="text-[11px] text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="size-3" />
                URL crawling happens in background — status will show "Processing" until ready.
              </p>
            </div>
          )}

          {addType === "faq" && (
            <div className="space-y-3">
              <Field label="Question">
                <input
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="What are your business hours?"
                  className={inputCls}
                />
              </Field>
              <Field label="Answer">
                <textarea
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  placeholder="We're open Mon-Sat, 10 AM to 8 PM. Sundays we're closed."
                  rows={4}
                  className={inputCls}
                />
              </Field>
              <p className="text-[11px] text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="size-3" />
                Structured FAQ pairs give the most reliable AI answers.
              </p>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="rounded-lg border border-[#e7ece9] bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg,#10b981,#059669)",
                boxShadow: "0 4px 12px rgba(16,185,129,.3)",
              }}
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Add Source
            </button>
          </div>
        </div>
      )}

      {/* Sources list */}
      <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
        <div className="border-b border-[#e7ece9] bg-[#f8faf9] px-5 py-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Your sources ({sources.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <BookOpen className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No knowledge sources yet</p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              Add your first source above — your AI will use it to ground answers in real business content.
            </p>
          </div>
        ) : (
          <div>
            {sources.map((source) => {
              const meta = SOURCE_META[source.type];
              const status = STATUS_META[source.status];
              const Icon = meta.icon;
              const StatusIcon = status.icon;

              return (
                <div
                  key={source.id}
                  className="group flex items-center gap-3 border-b border-[#e7ece9] px-5 py-3.5 last:border-b-0 hover:bg-[#f8faf9]"
                >
                  <div
                    className="flex size-9 items-center justify-center rounded-lg text-white shrink-0"
                    style={{ background: `linear-gradient(135deg,${meta.accent},${meta.accent}dd)` }}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#0c1f17] truncate">{source.title}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.class}`}>
                        <StatusIcon className={`size-2.5 ${source.status === "processing" ? "animate-spin" : ""}`} />
                        {status.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {meta.label}
                      {source.source_url && ` · ${source.source_url}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(source)}
                    className="rounded-md p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition"
                  >
                    <Trash2 className="size-4" />
                  </button>
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
