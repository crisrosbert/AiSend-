"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, LayoutTemplate, Paperclip, Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";

interface ReplyDraft {
  id: string;
  authorLabel: string;
  preview: string;
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
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(trimmed, replyTo?.id);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  // ── FILE UPLOAD HANDLER ──
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

  // ── META-AI STYLE INLINE ASSISTANT ──
  const handleAiAssist = async () => {
    if (sessionExpired || aiLoading) return;
    
    // If the composer is empty, ask for an opening line/hook. Otherwise, use what's typed as a prompt context.
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

      <div className="flex items-end gap-2">
        {/* Hidden Native Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />

        {/* Upload File Attachment Trigger Button */}
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

        {/* Templates Picker Trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-[#0c1f17] rounded-xl"
          onClick={onOpenTemplates}
          title="Send template"
        >
          <LayoutTemplate className="h-4 w-4" />
        </Button>

        {/* Text Input Container with Inline Meta AI Helper */}
        <div className="relative flex-1 flex items-center">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={sessionExpired ? "Session expired - use a template" : "Type a message... (Shift+Enter for new line)"}
            disabled={sessionExpired}
            rows={1}
            className={cn(
              "w-full resize-none rounded-xl border border-[#e7ece9] bg-white pl-4 pr-10 py-2.5 text-sm text-[#0c1f17] placeholder-slate-400 outline-none transition-all focus:border-emerald-500",
              sessionExpired && "cursor-not-allowed opacity-50"
            )}
          />
          
          {/* WhatsApp / Meta AI Style Right Trigger */}
          <button
            type="button"
            onClick={handleAiAssist}
            disabled={sessionExpired || aiLoading}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors",
              aiLoading && "text-blue-500 animate-pulse"
            )}
            title="Ask AI to write response"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>
        </div>

        {/* Send Button */}
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
        Type <span className="font-semibold text-emerald-600">/</span> for quick replies
      </p>
    </div>
  );
}
