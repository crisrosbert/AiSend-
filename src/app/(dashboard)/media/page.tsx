"use client";

// src/app/(dashboard)/media/page.tsx
//
// Media Library — manage the images, PDFs/brochures, and video/social
// links each agent can send in chat. Upload files (to Supabase Storage)
// or add YouTube/Instagram links. Pick which agent the media belongs to.

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Image as ImageIcon, FileText, Video, Link2, Loader2, Trash2,
  Upload, Plus, Bot,
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
  const [userId, setUserId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedAgent) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${selectedAgent}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false });
      if (upErr) { toast.error("Upload failed: " + upErr.message); return; }

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
      if (insErr) { toast.error("Saved file but couldn't record it: " + insErr.message); return; }
      toast.success("Uploaded");
      loadMedia(selectedAgent);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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
          <h3 className="text-sm font-bold text-[#0c1f17] mb-2 flex items-center gap-2"><Upload className="size-4 text-emerald-600" /> Upload image or PDF</h3>
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#d1fae5] bg-emerald-50/40 p-6 cursor-pointer hover:bg-emerald-50">
            {uploading ? <Loader2 className="size-6 animate-spin text-emerald-500" /> : <Upload className="size-6 text-emerald-400" />}
            <span className="text-xs text-slate-500">{uploading ? "Uploading…" : "Click to choose a file (image or PDF)"}</span>
            <input type="file" accept="image/*,application/pdf" onChange={handleUpload} disabled={uploading} className="hidden" />
          </label>
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
        <h3 className="text-sm font-bold text-[#0c1f17] mb-3">Media for this agent ({media.length})</h3>
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
                  <div className="text-xs font-bold text-[#0c1f17] truncate">{m.title}</div>
                  <a href={m.url} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline truncate block">open</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
