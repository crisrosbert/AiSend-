"use client";

// src/app/(dashboard)/media/page.tsx
//
// Media Library — manage the images, PDFs/brochures, and video/social
// links each agent can send in chat. Upload files (to Supabase Storage)
// or add YouTube/Instagram links. Pick which agent the media belongs to.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Image as ImageIcon, FileText, Video, Link2, Loader2, Trash2,
  Upload, Plus, Bot, ArrowLeft, Save, Check,
} from "lucide-react";

interface Agent { id: string; name: string; media_enabled: boolean }
interface MediaItem {
  id: string;
  media_type: string;
  title: string;
  url: string;
  description: string | null;
  storage_path: string | null;
}

const BUCKET = "agent-media";

export default function MediaLibraryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Progress across a multi-file upload, so a batch of twenty photos
  // shows movement instead of one long spinner.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Edited titles that have not been written back yet: id → new title.
  //
  // Titles matter more than they look. The title is what the agent sends
  // as the caption, so "IMG_20240715_112233" arrives at the customer
  // exactly like that. Being able to rename it to "3BHK living room" is
  // the difference between a useful photo and a confusing one — and it
  // gives the Save button something real to save.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingEdits, setSavingEdits] = useState(false);
  const dirtyCount = Object.keys(drafts).length;

  // link form
  const [linkType, setLinkType] = useState<"video" | "instagram">("video");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");

  const loadAgents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from("agents")
      .select("id, name, media_enabled")
      .eq("tenant_id", user.id)
      .order("name");
    const list = data || [];
    setAgents(list);
    if (list.length && !selectedAgent) setSelectedAgent(list[0].id);
    setLoading(false);
  }, [supabase, selectedAgent]);

  const loadMedia = useCallback(async (agentId: string) => {
    if (!agentId) return;
    const { data } = await supabase
      .from("agent_media")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });
    setMedia(data || []);
  }, [supabase]);

  useEffect(() => { loadAgents(); }, [loadAgents]);
  useEffect(() => { if (selectedAgent) loadMedia(selectedAgent); }, [selectedAgent, loadMedia]);

  /** Upload one file. Returns null on success, or why it failed. */
  async function uploadOne(file: File, index: number): Promise<string | null> {
    const ext = file.name.split(".").pop();
    // Date.now() alone collided when a batch uploaded inside one
    // millisecond, so the second file silently overwrote the first.
    // The index makes each path unique within a batch.
    const path = `${userId}/${selectedAgent}/${Date.now()}-${index}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });
    if (upErr) return upErr.message;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const isPdf = (file.type || "").includes("pdf") || ext?.toLowerCase() === "pdf";

    const { error: insErr } = await supabase.from("agent_media").insert({
      agent_id: selectedAgent,
      tenant_id: userId,
      media_type: isPdf ? "pdf" : "image",
      title: file.name.replace(/\.[^.]+$/, ""),
      url: pub.publicUrl,
      storage_path: path,
    });
    if (insErr) return insErr.message;

    return null;
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedAgent) return;

    setUploading(true);
    setProgress({ done: 0, total: files.length });

    // Sequential on purpose. Firing thirty uploads at once is how you
    // get throttled by storage and end up with a half-finished library
    // and no clear idea which files made it.
    const failed: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const error = await uploadOne(files[i], i);
        if (error) failed.push(`${files[i].name}: ${error}`);
        setProgress({ done: i + 1, total: files.length });
      }

      const ok = files.length - failed.length;
      if (ok > 0) toast.success(`${ok} file${ok === 1 ? "" : "s"} uploaded`);
      // Name what failed. "Some uploads failed" leaves them re-uploading
      // everything to find out which.
      for (const f of failed.slice(0, 3)) toast.error(f);
      if (failed.length > 3) toast.error(`…and ${failed.length - 3} more failed`);

      loadMedia(selectedAgent);
    } finally {
      setUploading(false);
      setProgress(null);
      e.target.value = "";
    }
  }

  /** Write every edited title back. This is what Save actually does. */
  async function saveEdits() {
    const entries = Object.entries(drafts);
    if (entries.length === 0) return;

    setSavingEdits(true);
    try {
      const results = await Promise.all(
        entries.map(([id, title]) =>
          supabase.from("agent_media").update({ title: title.trim() || "Untitled" }).eq("id", id),
        ),
      );
      const failed = results.filter((r) => r.error).length;
      if (failed > 0) {
        toast.error(`${failed} change${failed === 1 ? "" : "s"} could not be saved`);
        return; // keep the drafts so nothing the user typed is lost
      }
      toast.success(`${entries.length} change${entries.length === 1 ? "" : "s"} saved`);
      setDrafts({});
      loadMedia(selectedAgent);
    } finally {
      setSavingEdits(false);
    }
  }

  /** Back, but never at the cost of unsaved edits. */
  function goBack() {
    if (dirtyCount > 0 && !confirm(`You have ${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}. Leave without saving?`)) {
      return;
    }
    router.back();
  }

  async function addLink() {
    if (!linkUrl.trim() || !selectedAgent) { toast.error("Enter a URL"); return; }
    const { error } = await supabase.from("agent_media").insert({
      agent_id: selectedAgent,
      tenant_id: userId,
      media_type: linkType,
      title: linkTitle.trim() || (linkType === "video" ? "Video" : "Instagram"),
      url: linkUrl.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Link added");
    setLinkUrl(""); setLinkTitle("");
    loadMedia(selectedAgent);
  }

  async function remove(item: MediaItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    if (item.storage_path) {
      await supabase.storage.from(BUCKET).remove([item.storage_path]);
    }
    const { error } = await supabase.from("agent_media").delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    loadMedia(selectedAgent);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-emerald-500" /></div>;
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e7ece9] bg-white p-8 text-center">
        <Bot className="size-8 mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">No agents yet. Create an agent first, then add its media here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Back — checks for unsaved edits before leaving */}
      <button
        onClick={goBack}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-[#0c1f17] transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      {/* Header + agent picker */}
      <div className="rounded-2xl border border-[#d1fae5] bg-gradient-to-br from-white to-emerald-50 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
            <ImageIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]">Media Library</h1>
            <p className="text-xs text-slate-500">Images, PDFs, and video links your agent can send in chat.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">Agent:</span>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="rounded-lg border border-[#e7ece9] bg-white px-3 py-1.5 text-sm text-[#0c1f17] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {agents.find((a) => a.id === selectedAgent && !a.media_enabled) && (
            <span className="text-xs text-amber-600">⚠ media disabled for this agent — enable it to send media</span>
          )}
        </div>
      </div>

      {/* Add controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upload */}
        <div className="rounded-2xl border border-[#e7ece9] bg-white p-4">
          <h3 className="text-sm font-bold text-[#0c1f17] mb-2 flex items-center gap-2"><Upload className="size-4 text-emerald-600" /> Upload images or PDFs</h3>
          <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#d1fae5] bg-emerald-50/40 p-6 ${uploading ? "cursor-wait" : "cursor-pointer hover:bg-emerald-50"}`}>
            {uploading ? <Loader2 className="size-6 animate-spin text-emerald-500" /> : <Upload className="size-6 text-emerald-400" />}
            <span className="text-xs text-slate-500">
              {uploading
                ? progress
                  ? `Uploading ${progress.done} of ${progress.total}…`
                  : "Uploading…"
                : "Click to choose files — select as many as you like"}
            </span>
            {/* multiple: the whole point. Select a folder of photos at once. */}
            <input
              type="file" multiple accept="image/*,application/pdf"
              onChange={handleUpload} disabled={uploading} className="hidden"
            />
          </label>
          {progress && progress.total > 1 && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Add link */}
        <div className="rounded-2xl border border-[#e7ece9] bg-white p-4">
          <h3 className="text-sm font-bold text-[#0c1f17] mb-2 flex items-center gap-2"><Link2 className="size-4 text-emerald-600" /> Add video / Instagram link</h3>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setLinkType("video")} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${linkType === "video" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><Video className="size-3.5 inline mr-1" />YouTube</button>
            <button onClick={() => setLinkType("instagram")} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${linkType === "instagram" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>Instagram</button>
          </div>
          <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Title (e.g. Project walkthrough)" className="w-full rounded-lg border border-[#e7ece9] p-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
          <div className="flex gap-2">
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Paste the URL" className="flex-1 rounded-lg border border-[#e7ece9] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            <button onClick={addLink} className="rounded-lg bg-emerald-500 px-3 text-white hover:bg-emerald-600"><Plus className="size-4" /></button>
          </div>
        </div>
      </div>

      {/* Media grid */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-bold text-[#0c1f17]">Media for this agent ({media.length})</h3>

          {/* Save state. Says plainly whether anything is outstanding —
              which is the reassurance, more than the button itself. */}
          {media.length > 0 && (
            dirtyCount > 0 ? (
              <button
                onClick={saveEdits}
                disabled={savingEdits}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                {savingEdits
                  ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</>
                  : <><Save className="size-3.5" /> Save {dirtyCount} change{dirtyCount === 1 ? "" : "s"}</>}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <Check className="size-3.5" /> All changes saved
              </span>
            )
          )}
        </div>
        {media.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e7ece9] bg-white p-8 text-center text-sm text-slate-400">No media yet. Upload a file or add a link above.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {media.map((m) => (
              <div key={m.id} className="rounded-xl border border-[#e7ece9] bg-white overflow-hidden group">
                <div className="aspect-video bg-slate-50 flex items-center justify-center relative">
                  {m.media_type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      {m.media_type === "pdf" || m.media_type === "brochure" ? <FileText className="size-8" /> :
                       m.media_type === "instagram" ? <Link2 className="size-8" /> : <Video className="size-8" />}
                      <span className="text-[10px] uppercase">{m.media_type}</span>
                    </div>
                  )}
                  <button onClick={() => remove(m)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 rounded-md bg-red-500 p-1 text-white transition-opacity"><Trash2 className="size-3" /></button>
                </div>
                <div className="p-2">
                  {/* Editable, because this text is the caption the
                      customer receives with the file. */}
                  <input
                    value={drafts[m.id] ?? m.title}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDrafts((prev) => {
                        const rest = { ...prev };
                        // Typing it back to the original is not a change,
                        // so the Save count stays honest.
                        if (next === m.title) delete rest[m.id];
                        else rest[m.id] = next;
                        return rest;
                      });
                    }}
                    aria-label={`Caption for ${m.title}`}
                    className={`w-full rounded-md border px-1.5 py-1 text-xs font-bold text-[#0c1f17] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                      drafts[m.id] !== undefined
                        ? "border-amber-300 bg-amber-50"
                        : "border-transparent bg-transparent hover:border-[#e7ece9]"
                    }`}
                  />
                  <a href={m.url} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline truncate block px-1.5">open</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
