"use client";

// src/components/settings/business-manager.tsx
//
// Where businesses are created, renamed, made default, and removed.
//
// ── WHAT THIS SCREEN IS ACTUALLY FOR ─────────────────────────────────
// Until now every account has had exactly one business, created by a
// migration, and the switcher in the header has rendered as a label.
// This is the screen that makes a second one possible — which is the
// moment the whole boundary starts doing visible work.
//
// ── WHY DELETION IS THIS AWKWARD ─────────────────────────────────────
// business_id cascades across twenty-eight tables. Removing a business
// removes its agents, its contacts, its conversations and every message
// in them. There is no undo and no export step in between. So the
// delete path asks for the name to be typed, and says plainly what
// goes with it. Friction is the feature.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Camera, Check, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBusiness } from "@/hooks/use-business";
import { createClient } from "@/lib/supabase/client";
import type { BusinessRef } from "@/lib/business/resolve";

export function BusinessManager() {
  const { user } = useAuth();
  const { businesses, businessId, loading, refresh, switchTo } = useBusiness();
  const supabase = createClient();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoTargetId = useRef<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  // Anchor for the switcher's "Add a business" link, which points at
  // /settings#businesses.
  useEffect(() => {
    if (window.location.hash === "#businesses") {
      document.getElementById("businesses")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  async function call(
    method: "POST" | "PATCH" | "DELETE",
    body?: Record<string, unknown>,
    query = "",
  ): Promise<boolean> {
    const res = await fetch(`/api/businesses${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json?.error ?? "Something went wrong");
      return false;
    }
    // The provider owns the list; re-reading it here keeps the header
    // switcher and this screen from disagreeing.
    await refresh();
    return true;
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusy("create");
    if (await call("POST", { name })) {
      toast.success(`${name} added`);
      setNewName("");
      setCreating(false);
    }
    setBusy(null);
  }

  async function handleRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    setBusy(id);
    if (await call("PATCH", { id, name })) {
      toast.success("Renamed");
      setRenamingId(null);
    }
    setBusy(null);
  }

  async function handleMakeDefault(id: string) {
    setBusy(id);
    if (await call("PATCH", { id, is_default: true })) {
      toast.success("Default updated");
    }
    setBusy(null);
  }

  function triggerLogoUpload(id: string) {
    logoTargetId.current = id;
    logoInputRef.current?.click();
  }

  async function handleLogoFile(file: File) {
    const id = logoTargetId.current;
    if (!id || !user?.id) return;

    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) {
      toast.error("Use a PNG, JPG, WebP, GIF or SVG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.`);
      return;
    }

    setUploadingLogoId(id);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      // Timestamped rather than overwritten: a stable filename would be
      // served from cache long after the change, and the merchant would
      // conclude the upload silently failed.
      const path = `${user.id}/business-${id}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      if (await call("PATCH", { id, logo_url: publicUrl })) {
        toast.success("Logo updated");
      }
    } finally {
      setUploadingLogoId(null);
    }
  }

  async function handleDelete(b: BusinessRef) {
    setBusy(b.id);
    const ok = await call(
      "DELETE",
      undefined,
      `?id=${encodeURIComponent(b.id)}&confirm=${encodeURIComponent(confirmText)}`,
    );
    if (ok) {
      toast.success(`${b.name} deleted`);
      setDeletingId(null);
      setConfirmText("");
      // If they deleted the one they were looking at, the pages behind
      // this screen are now showing rows that no longer exist. Move to
      // whatever is left rather than leaving that on screen.
      if (b.id === businessId) {
        const next = businesses.find((x) => x.id !== b.id);
        if (next) switchTo(next.id);
      }
    }
    setBusy(null);
  }

  return (
    <div id="businesses" className="bm">
      <style>{css}</style>

      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="bm-hidden-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleLogoFile(file);
        }}
      />

      <div className="bm-head">
        <div>
          <h2 className="bm-title">Businesses</h2>
          <p className="bm-sub">
            Each business keeps its own agents, contacts, conversations and
            automations. Billing and your plan stay on the account.
          </p>
        </div>
        {!creating && (
          <button type="button" className="bm-primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> Add business
          </button>
        )}
      </div>

      {creating && (
        <div className="bm-create">
          <input
            className="bm-input"
            placeholder="Business name"
            value={newName}
            maxLength={60}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
          />
          <button
            type="button"
            className="bm-primary"
            disabled={!newName.trim() || busy === "create"}
            onClick={() => void handleCreate()}
          >
            {busy === "create" ? <Loader2 size={15} className="bm-spin" /> : <Check size={15} />}
            Create
          </button>
          <button
            type="button"
            className="bm-ghost"
            onClick={() => { setCreating(false); setNewName(""); }}
          >
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div className="bm-skeleton" aria-hidden="true" />
      ) : businesses.length === 0 ? (
        <p className="bm-empty">
          No businesses yet. Add one to get started.
        </p>
      ) : (
        <ul className="bm-list">
          {businesses.map((b) => (
            <li key={b.id} className={b.id === businessId ? "bm-row current" : "bm-row"}>
              <button
                type="button"
                className="bm-mark"
                title={b.logo_url ? "Change logo" : "Add a logo"}
                disabled={uploadingLogoId === b.id}
                onClick={() => triggerLogoUpload(b.id)}
              >
                {uploadingLogoId === b.id ? (
                  <Loader2 size={14} className="bm-spin" />
                ) : b.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logo_url} alt="" className="bm-mark-img" />
                ) : (
                  <Building2 size={15} />
                )}
                <span className="bm-mark-hint"><Camera size={10} /></span>
              </button>

              <div className="bm-main">
                {renamingId === b.id ? (
                  <div className="bm-rename">
                    <input
                      className="bm-input"
                      value={renameValue}
                      maxLength={60}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRename(b.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                    />
                    <button
                      type="button"
                      className="bm-icon ok"
                      aria-label="Save name"
                      disabled={busy === b.id}
                      onClick={() => void handleRename(b.id)}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      className="bm-icon"
                      aria-label="Cancel rename"
                      onClick={() => setRenamingId(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="bm-name">{b.name}</span>
                    <span className="bm-tags">
                      {b.is_default && <span className="bm-tag">Default</span>}
                      {b.id === businessId && <span className="bm-tag on">Viewing</span>}
                    </span>
                  </>
                )}
              </div>

              {renamingId !== b.id && (
                <div className="bm-actions">
                  {b.id !== businessId && (
                    <button type="button" className="bm-link" onClick={() => switchTo(b.id)}>
                      Switch to
                    </button>
                  )}
                  <button
                    type="button"
                    className="bm-link"
                    onClick={() => { setRenamingId(b.id); setRenameValue(b.name); }}
                  >
                    Rename
                  </button>
                  {!b.is_default && (
                    <button
                      type="button"
                      className="bm-link"
                      disabled={busy === b.id}
                      onClick={() => void handleMakeDefault(b.id)}
                    >
                      <Star size={13} /> Make default
                    </button>
                  )}
                  {businesses.length > 1 && (
                    <button
                      type="button"
                      className="bm-link danger"
                      onClick={() => { setDeletingId(b.id); setConfirmText(""); }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}

              {deletingId === b.id && (
                <div className="bm-danger">
                  <p className="bm-danger-title">Delete {b.name}?</p>
                  <p className="bm-danger-body">
                    This also deletes its agents, contacts, conversations and
                    every message in them. It cannot be undone.
                  </p>
                  <div className="bm-danger-row">
                    <input
                      className="bm-input"
                      placeholder={`Type "${b.name}" to confirm`}
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                    />
                    <button
                      type="button"
                      className="bm-danger-btn"
                      disabled={confirmText !== b.name || busy === b.id}
                      onClick={() => void handleDelete(b)}
                    >
                      {busy === b.id ? <Loader2 size={14} className="bm-spin" /> : <Trash2 size={14} />}
                      Delete
                    </button>
                    <button
                      type="button"
                      className="bm-ghost"
                      onClick={() => { setDeletingId(null); setConfirmText(""); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const css = `
.bm { background: #fff; border: 1px solid #e8ede9; border-radius: 14px; padding: 20px; }

.bm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.bm-title { margin: 0; font-size: 15px; font-weight: 700; color: #0c1f17; }
.bm-sub { margin: 4px 0 0; font-size: 12.5px; color: #7b8b83; max-width: 52ch; line-height: 1.5; }

.bm-primary {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
  padding: 8px 13px; border: none; border-radius: 8px;
  background: #112118; color: #22c55e; font-size: 13px; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.bm-primary:disabled { opacity: .5; cursor: default; }

.bm-ghost {
  padding: 8px 12px; border: 1px solid #e8ede9; border-radius: 8px;
  background: #fff; color: #5b6b63; font-size: 13px; font-weight: 600;
  cursor: pointer; font-family: inherit;
}

.bm-create { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }

.bm-input {
  flex: 1; min-width: 180px;
  padding: 8px 11px; border: 1.5px solid #e7ece9; border-radius: 8px;
  font-size: 13px; font-family: inherit; color: #0c1f17; background: #fff;
}
.bm-input:focus { outline: none; border-color: #10b981; }

.bm-skeleton { height: 64px; margin-top: 16px; border-radius: 10px; background: #f1f5f4; }
.bm-empty { margin: 16px 0 0; font-size: 13px; color: #8a978f; }

.bm-list { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }

.bm-row {
  display: flex; align-items: center; gap: 11px; flex-wrap: wrap;
  padding: 12px 13px; border: 1px solid #eef2f0; border-radius: 11px;
}
.bm-row.current { border-color: #bfe8d5; background: #f7fdfa; }

.bm-hidden-input { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }

.bm-mark {
  position: relative;
  width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
  background: #ecfdf5; color: #059669; border: none; padding: 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; overflow: hidden;
}
.bm-mark:hover { background: #d8f5e6; }
.bm-mark:disabled { cursor: default; }

.bm-mark-img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }

.bm-mark-hint {
  position: absolute; right: -1px; bottom: -1px;
  width: 13px; height: 13px; border-radius: 4px;
  background: #0c1f17; color: #fff;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid #fff;
}

.bm-main { flex: 1; min-width: 140px; display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.bm-name { font-size: 13.5px; font-weight: 600; color: #0c1f17; }
.bm-tags { display: flex; gap: 5px; }
.bm-tag {
  font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  padding: 2px 7px; border-radius: 5px; background: #f1f5f4; color: #7b8b83;
}
.bm-tag.on { background: #ecfdf5; color: #059669; }

.bm-rename { display: flex; align-items: center; gap: 6px; width: 100%; }

.bm-actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.bm-link {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 8px; border: none; border-radius: 6px; background: none;
  font-size: 12.5px; font-weight: 600; color: #5b6b63;
  cursor: pointer; font-family: inherit;
}
.bm-link:hover { background: #f4f7f5; color: #0c1f17; }
.bm-link:disabled { opacity: .5; cursor: default; }
.bm-link.danger { color: #b4483c; }
.bm-link.danger:hover { background: #fef2f2; color: #dc2626; }

.bm-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: 1px solid #e8ede9; border-radius: 7px;
  background: #fff; color: #5b6b63; cursor: pointer;
}
.bm-icon.ok { color: #059669; border-color: #bfe8d5; }

.bm-danger {
  width: 100%; margin-top: 10px; padding: 13px;
  border: 1px solid #f6d5d0; border-radius: 10px; background: #fffaf9;
}
.bm-danger-title { margin: 0; font-size: 13px; font-weight: 700; color: #b4483c; }
.bm-danger-body { margin: 5px 0 11px; font-size: 12.5px; color: #8a6a66; line-height: 1.5; }
.bm-danger-row { display: flex; gap: 8px; flex-wrap: wrap; }
.bm-danger-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 13px; border: none; border-radius: 8px;
  background: #dc2626; color: #fff; font-size: 13px; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.bm-danger-btn:disabled { opacity: .45; cursor: default; }

.bm-spin { animation: bm-rot 1s linear infinite; }
@keyframes bm-rot { to { transform: rotate(360deg); } }
`;
