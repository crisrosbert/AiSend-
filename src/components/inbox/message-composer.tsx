"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { Send, LayoutTemplate, Paperclip, Sparkles, Loader2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";

interface ReplyDraft {
  id: string;
  authorLabel: string;
  preview: string;
}

interface CannedReply {
  id: string;
  shortcode: string;
  title: string;
  content: string;
  category: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (text: string, replyToId?: string) => void;
  onSendMedia?: (file: File, contentType: "image" | "video" | "audio" | "document") => Promise<void>;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onSendMedia,
  onOpenTemplates,
  replyTo,
  onClearReply,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Canned reply picker state
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerIndex, setPickerIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load canned replies once on mount
  useEffect(() => {
    fetch("/api/canned-replies")
      .then((r) => r.json())
      .then((d) => { if (d.replies) setCannedReplies(d.replies); })
      .catch(() => {});
  }, []);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  // Filter canned replies by query (shortcode or title)
  const pickerResults = pickerQuery
    ? cannedReplies.filter(
        (r) =>
          r.shortcode.includes(pickerQuery) ||
          r.title.toLowerCase().includes(pickerQuery.toLowerCase()) ||
          r.content.toLowerCase().includes(pickerQuery.toLowerCase()),
      )
    : cannedReplies;

  // Insert a canned reply and close the picker
  function insertReply(reply: CannedReply) {
    setText(reply.content);
    setShowPicker(false);
    setPickerQuery("");
    setPickerIndex(0);
    setTimeout(() => {
      textareaRef.current?.focus();
      adjustHeight();
    }, 0);
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      adjustHeight();

      // Detect "/" at start or after whitespace
      const slashMatch = val.match(/(^|\s)\/(\S*)$/);
      if (slashMatch) {
        setPickerQuery(slashMatch[2] ?? "");
        setShowPicker(true);
        setPickerIndex(0);
      } else {
        setShowPicker(false);
        setPickerQuery("");
      }
    },
    [adjustHeight],
  );

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;
    setSending(true);
    try {
      onSend(trimmed, replyTo?.id);
      setText("");
      setShowPicker(false);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Navigate picker with arrow keys
      if (showPicker && pickerResults.length > 0) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setPickerIndex((i) => (i <= 0 ? pickerResults.length - 1 : i - 1));
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setPickerIndex((i) => (i >= pickerResults.length - 1 ? 0 : i + 1));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const chosen = pickerResults[pickerIndex];
          if (chosen) insertReply(chosen);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowPicker(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showPicker, pickerResults, pickerIndex, handleSend],
  );

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    function onOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [showPicker]);

  // File upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onSendMedia) return;
    setUploading(true);
    try {
      let contentType: "image" | "video" | "audio" | "document" = "document";
      if (file.type.startsWith("image/")) contentType = "image";
      else if (file.type.startsWith("video/")) contentType = "video";
      else if (file.type.startsWith("audio/")) contentType = "audio";
      await onSendMedia(file, contentType);
    } catch (err) {
      console.error("File upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // AI assist handler
  const handleAiAssist = async () => {
    if (sessionExpired || aiLoading) return;
    const promptContext = text.trim() || "Write a professional customer follow-up response";
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptContext, conversationId }),
      });
      const data = await res.json();
      if (data.reply) {
        setText(data.reply);
        setTimeout(adjustHeight, 50);
      }
    } catch (err) {
      console.error("AI Assistant error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="border-t border-[#e7ece9] bg-[#f8faf9] p-3">
      {replyTo && (
        <div className="mb-2">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}

      {sessionExpired && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-600">24-hour session expired. Use a template to re-engage.</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-600 hover:text-amber-300"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Templates
          </Button>
        </div>
      )}

      {/* Canned reply picker popup */}
      {showPicker && pickerResults.length > 0 && (
        <div
          ref={pickerRef}
          className="mb-2 max-h-56 overflow-y-auto rounded-xl border border-[#e7ece9] bg-white shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 border-b border-[#f0f4f2] px-3 py-2">
            <Zap className="size-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-slate-500">
              Quick replies
              {pickerQuery && <span className="ml-1 text-emerald-600">/{pickerQuery}</span>}
            </span>
            <span className="ml-auto text-[10px] text-slate-400">↑↓ navigate · Enter insert · Esc close</span>
          </div>

          {/* Results */}
          {pickerResults.map((r, i) => (
            <button
              key={r.id}
              onMouseDown={(e) => { e.preventDefault(); insertReply(r); }}
              onMouseEnter={() => setPickerIndex(i)}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                i === pickerIndex ? "bg-emerald-50" : "hover:bg-slate-50",
              )}
            >
              <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-emerald-600">
                /{r.shortcode}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#0c1f17]">{r.title}</p>
                <p className="truncate text-[11px] text-slate-500">{r.content}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                {r.category}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No results state */}
      {showPicker && pickerResults.length === 0 && pickerQuery && (
        <div className="mb-2 rounded-xl border border-[#e7ece9] bg-white px-3 py-3 text-center">
          <p className="text-xs text-slate-400">
            No reply matches <span className="font-mono font-semibold text-emerald-600">/{pickerQuery}</span>
            {" — "}
            <a href="/settings/canned-replies" className="text-emerald-600 underline">
              add one in Settings
            </a>
          </p>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={uploading}
          className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file or media"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> : <Paperclip className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-[#0c1f17] rounded-xl"
          onClick={onOpenTemplates}
          title="Send template"
        >
          <LayoutTemplate className="h-4 w-4" />
        </Button>

        <div className="relative flex-1 flex items-center">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={sessionExpired ? "Session expired - use a template" : "Type a message… or / for quick replies"}
            disabled={sessionExpired}
            rows={1}
            className={cn(
              "w-full resize-none rounded-xl border border-[#e7ece9] bg-white pl-4 pr-10 py-2.5 text-sm text-[#0c1f17] placeholder-slate-400 outline-none transition-all focus:border-emerald-500",
              sessionExpired && "cursor-not-allowed opacity-50",
            )}
          />
          <button
            type="button"
            onClick={handleAiAssist}
            disabled={sessionExpired || aiLoading}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors",
              aiLoading && "text-blue-500 animate-pulse",
            )}
            title="Ask AI to write response"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>
        </div>

        <Button
          size="sm"
          className="h-9 w-9 shrink-0 bg-emerald-600 p-0 hover:bg-emerald-500 disabled:opacity-40 rounded-xl shadow-sm"
          disabled={!text.trim() || sessionExpired || sending || uploading}
          onClick={handleSend}
        >
          <Send className="h-4 w-4 text-white" />
        </Button>
      </div>

      <p className="mt-1 pl-[88px] text-[10px] text-slate-400 selection:bg-transparent">
        Type <span className="font-semibold text-emerald-600">/</span> for quick replies · Shift+Enter for new line
      </p>
    </div>
  );
}
