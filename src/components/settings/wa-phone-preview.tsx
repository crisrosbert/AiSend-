'use client';

// src/components/settings/wa-phone-preview.tsx
//
// A live, premium phone simulation of how a WhatsApp message template arrives
// on a customer's phone. Pure display: it reads what the user is typing in the
// template form and redraws instantly. Nothing is saved or sent from here.
//
//   header (image / video / text / document)  ->  body (with WhatsApp *bold*
//   _italic_ ~strike~ formatting and links)  ->  footer  ->  time + ticks
//   -> action buttons below the bubble (Visit Website / Call / Quick replies)
//
// NOTE: white text is written as text-[#fff]. globals.css has a legacy
// .text-white rule that turns white text dark; the bracket form avoids it.

import { useMemo, useState, type ReactNode } from 'react';
import {
  ChevronLeft, Phone, Video, ExternalLink, MessageSquareReply, Image as ImageIcon,
  Play, FileText, Plus, Camera, Mic, BadgeCheck, Signal, Wifi, BatteryFull,
} from 'lucide-react';

export interface PreviewButton {
  type: 'url' | 'phone' | 'quick_reply';
  text: string;
  value: string;
}

export interface WaPhonePreviewProps {
  businessName: string;
  headerType: string;
  headerContent: string;
  body: string;
  footer: string;
  buttons: PreviewButton[];
  /** One sample value per {{n}} placeholder, index-aligned. */
  sampleValues: string[];
}

/**
 * Saved templates keep buttons as [{ type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY', text, ... }].
 * The form uses lower-case 'url' | 'phone' | 'quick_reply'. This accepts either, and ignores
 * anything it does not recognise, so a template with odd data never breaks the preview.
 */
export function normalizeTemplateButtons(raw: unknown): PreviewButton[] {
  if (!Array.isArray(raw)) return [];
  const out: PreviewButton[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Record<string, unknown>;
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text) continue;
    const t = String(b.type ?? '').toLowerCase();
    if (t === 'url') out.push({ type: 'url', text, value: String(b.url ?? b.value ?? '') });
    else if (t === 'phone' || t === 'phone_number') out.push({ type: 'phone', text, value: String(b.phoneNumber ?? b.value ?? '') });
    else if (t === 'quick_reply') out.push({ type: 'quick_reply', text, value: '' });
  }
  return out;
}

// ── text helpers ───────────────────────────────────────────────────────

/** Replace {{n}} with the sample value when there is one; keep {{n}} otherwise. */
export function fillVariables(text: string, samples: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n: string) => {
    const v = samples[Number(n) - 1]?.trim();
    return v ? v : `{{${n}}}`;
  });
}

/** Unfilled {{n}} placeholders are drawn as small amber chips so the user sees what is missing. */
function withChips(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\{\{\d+\}\})/g).map((part, i) =>
    /^\{\{\d+\}\}$/.test(part) ? (
      <span
        key={`${keyBase}-${i}`}
        className="rounded bg-amber-100 px-1 font-medium text-amber-800"
      >
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * WhatsApp's own inline formatting: *bold*, _italic_, ~strike~, ```mono```,
 * plus links. One level of nesting (e.g. *bold _and italic_*) is supported.
 */
export function formatWhatsapp(text: string, depth = 0, keyBase = 'f'): ReactNode[] {
  const re = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s]+)/g;
  return text.split(re).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (!part) return null;
    if (part.startsWith('```') && part.endsWith('```') && part.length > 6) {
      return <code key={key} className="rounded bg-black/5 px-1 font-mono text-[12px]">{part.slice(3, -3)}</code>;
    }
    if (depth < 2 && part.length > 2) {
      const inner = part.slice(1, -1);
      if (part.startsWith('*') && part.endsWith('*')) return <strong key={key}>{formatWhatsapp(inner, depth + 1, key)}</strong>;
      if (part.startsWith('_') && part.endsWith('_')) return <em key={key}>{formatWhatsapp(inner, depth + 1, key)}</em>;
      if (part.startsWith('~') && part.endsWith('~')) return <s key={key}>{formatWhatsapp(inner, depth + 1, key)}</s>;
    }
    if (/^https?:\/\//.test(part)) {
      return <span key={key} className="break-all text-[#027eb5] underline">{part}</span>;
    }
    return <span key={key}>{withChips(part, key)}</span>;
  });
}

// ── the phone ─────────────────────────────────────────────────────────

function Tail() {
  // The little notch on the top-left of an incoming WhatsApp bubble.
  return (
    <span
      aria-hidden
      className="absolute -left-[5px] top-0 h-3 w-3 bg-[#fff]"
      style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
    />
  );
}

export function WaPhonePreview({
  businessName, headerType, headerContent, body, footer, buttons, sampleValues,
}: WaPhonePreviewProps) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

  const now = useMemo(
    () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    // Redraw the clock only when the content changes; it never needs to tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [body, headerContent, footer],
  );

  const media = headerContent.trim();
  const imageBroken = brokenSrc === media;
  const bodyText = fillVariables(body, sampleValues);
  const shownButtons = buttons.filter((b) => b.text.trim());
  const name = businessName.trim() || 'Your Business';

  return (
    <div className="mx-auto w-[292px] select-none" aria-label="Live phone preview">
      {/* Titanium frame */}
      <div
        className="relative rounded-[2.9rem] p-[10px] shadow-[0_30px_60px_-20px_rgba(12,31,23,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset]"
        style={{ background: 'linear-gradient(145deg,#3b4a43 0%,#1b2420 45%,#2b3732 100%)' }}
      >
        {/* side keys */}
        <span aria-hidden className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l bg-[#2b3732]" />
        <span aria-hidden className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l bg-[#2b3732]" />
        <span aria-hidden className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r bg-[#2b3732]" />

        {/* Screen */}
        <div className="relative flex h-[590px] flex-col overflow-hidden rounded-[2.2rem] bg-[#efeae2]">
          {/* status bar + dynamic island */}
          <div className="relative z-20 flex h-11 shrink-0 items-end justify-between bg-[#f7f7f7] px-6 pb-1.5 text-[11px] font-semibold text-[#111]">
            <span>{now}</span>
            <span aria-hidden className="absolute left-1/2 top-2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-1">
              <Signal className="h-3 w-3" />
              <Wifi className="h-3 w-3" />
              <BatteryFull className="h-3.5 w-3.5" />
            </span>
          </div>

          {/* WhatsApp chat header */}
          <div className="z-10 flex shrink-0 items-center gap-2 border-b border-black/5 bg-[#f7f7f7] px-2 pb-2 pt-1">
            <ChevronLeft className="h-5 w-5 text-[#007aff]" />
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-[12px] font-bold text-[#fff]">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="flex items-center gap-1 truncate text-[12.5px] font-semibold text-[#111]">
                <span className="truncate">{name}</span>
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-emerald-500 text-[#fff]" />
              </p>
              <p className="text-[10px] text-[#667781]">Business Account</p>
            </div>
            <Video className="h-[18px] w-[18px] text-[#007aff]" />
            <Phone className="mr-1 h-[17px] w-[17px] text-[#007aff]" />
          </div>

          {/* Chat area with a soft doodle wallpaper */}
          <div
            className="relative flex-1 overflow-y-auto px-2.5 py-3"
            style={{
              backgroundColor: '#efeae2',
              backgroundImage:
                'radial-gradient(rgba(11,20,26,0.05) 1px, transparent 1px), radial-gradient(rgba(11,20,26,0.04) 1px, transparent 1px)',
              backgroundSize: '18px 18px, 18px 18px',
              backgroundPosition: '0 0, 9px 9px',
            }}
          >
            <div className="mb-2.5 flex justify-center">
              <span className="rounded-md bg-[#fff]/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#54656f] shadow-sm">
                Today
              </span>
            </div>

            {/* Incoming template message */}
            <div className="relative max-w-[88%]">
              <div className="relative rounded-lg rounded-tl-none bg-[#fff] p-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                <Tail />

                {/* header media */}
                {headerType === 'image' && (
                  media && !imageBroken ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media}
                      alt=""
                      onError={() => setBrokenSrc(media)}
                      className="mb-1 h-[150px] w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="mb-1 flex h-[150px] w-full flex-col items-center justify-center gap-1 rounded-md bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                      <ImageIcon className="h-7 w-7" />
                      <span className="text-[10px]">{media && imageBroken ? 'Image could not load' : 'Your image appears here'}</span>
                    </div>
                  )
                )}
                {headerType === 'video' && (
                  <div className="relative mb-1 flex h-[150px] w-full items-center justify-center overflow-hidden rounded-md bg-slate-900">
                    {media && (
                      <video src={media} muted preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-[#fff]">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </span>
                  </div>
                )}
                {headerType === 'document' && (
                  <div className="mb-1 flex items-center gap-2 rounded-md bg-slate-100 px-3 py-4 text-slate-500">
                    <FileText className="h-6 w-6" />
                    <span className="text-[11px]">Document</span>
                  </div>
                )}

                <div className="px-1.5 pb-1 pt-0.5">
                  {headerType === 'text' && headerContent.trim() && (
                    <p className="mb-1 whitespace-pre-line text-[13px] font-bold leading-snug text-[#111b21]">
                      {formatWhatsapp(fillVariables(headerContent, sampleValues), 0, 'h')}
                    </p>
                  )}

                  <p className="whitespace-pre-line break-words text-[13px] leading-[1.35] text-[#111b21]">
                    {bodyText.trim()
                      ? formatWhatsapp(bodyText)
                      : <span className="text-slate-400">Your message appears here as you type…</span>}
                  </p>

                  {footer.trim() && (
                    <p className="mt-1 whitespace-pre-line break-words text-[11px] leading-snug text-[#667781]">
                      {footer}
                    </p>
                  )}

                  <p className="mt-0.5 text-right text-[10px] text-[#667781]">{now}</p>
                </div>
              </div>

              {/* action buttons: separate cards under the bubble, as WhatsApp draws them */}
              {shownButtons.length > 0 && (
                <div className="mt-[3px] flex flex-col gap-[3px]">
                  {shownButtons.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-[#fff] px-3 py-2 text-[12.5px] font-medium text-[#027eb5] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]"
                    >
                      {b.type === 'url' && <ExternalLink className="h-3.5 w-3.5" />}
                      {b.type === 'phone' && <Phone className="h-3.5 w-3.5" />}
                      {b.type === 'quick_reply' && <MessageSquareReply className="h-3.5 w-3.5" />}
                      <span className="truncate">{b.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* fake input bar */}
          <div className="z-10 flex shrink-0 items-center gap-2 bg-[#f7f7f7] px-2.5 pb-5 pt-2">
            <Plus className="h-5 w-5 text-[#007aff]" />
            <div className="flex h-8 flex-1 items-center rounded-full border border-black/10 bg-[#fff] px-3 text-[11.5px] text-slate-400">
              Message
            </div>
            <Camera className="h-5 w-5 text-[#007aff]" />
            <Mic className="h-5 w-5 text-[#007aff]" />
          </div>
          <span aria-hidden className="absolute bottom-1.5 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-black/80" />
        </div>
      </div>
    </div>
  );
}
