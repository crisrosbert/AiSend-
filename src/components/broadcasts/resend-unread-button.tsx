'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Send, Loader2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Broadcast, Contact } from '@/types';

interface ResendUnreadButtonProps {
  broadcast: Broadcast;
  /** Count of recipients with status sent|delivered (received, not read). */
  unreadCount: number;
}

const SEND_BATCH_SIZE = 10;
const SEND_BATCH_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Resend to non-readers" — creates a NEW broadcast targeting only the
 * recipients of this broadcast who received but did not read it
 * (status 'sent' or 'delivered'). Opted-out contacts are filtered out.
 * Reuses the same /api/whatsapp/broadcast send endpoint with Meta-safe
 * pacing (10 msgs / 1s).
 */
export function ResendUnreadButton({ broadcast, unreadCount }: ResendUnreadButtonProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirm, setConfirm] = useState(false);

  async function handleResend() {
    setSending(true);
    setProgress(0);
    const supabase = createClient();

    try {
      // 1. Create the resend broadcast + recipient rows server-side
      const res = await fetch('/api/broadcasts/resend-unread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcast_id: broadcast.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newBroadcastId: string = data.id;
      const skipped: number = data.skipped_opted_out ?? 0;
      if (skipped > 0) {
        toast.info(`${skipped} opted-out contact${skipped !== 1 ? 's' : ''} skipped.`);
      }

      // 2. Fetch the freshly-created recipients with their contacts
      const { data: rawRecipients, error: recErr } = await supabase
        .from('broadcast_recipients')
        .select('id, contact:contacts(*)')
        .eq('broadcast_id', newBroadcastId);
      if (recErr || !rawRecipients) throw new Error('Failed to load recipients');

      // Supabase types the joined `contact` as an array — normalize each
      // row to a single Contact so the rest of the code is cleanly typed.
      const recipients: { id: string; contact: Contact | null }[] = (
        rawRecipients as unknown as { id: string; contact: Contact | Contact[] | null }[]
      ).map((r) => ({
        id: r.id,
        contact: Array.isArray(r.contact) ? (r.contact[0] ?? null) : r.contact,
      }));

      // 3. Send in paced batches (reuse existing endpoint)
      const stored = (broadcast.template_variables ?? {}) as Record<
        string,
        { type: string; value: string }
      >;
      const resolveParams = (contact: Contact): string[] => {
        const keys = Object.keys(stored).sort((a, b) => Number(a) - Number(b));
        return keys.map((k) => {
          const v = stored[k];
          if (!v) return '';
          if (v.type === 'static') return v.value;
          if (v.type === 'field') {
            const map: Record<string, string | undefined> = {
              name: contact.name, phone: contact.phone,
              email: contact.email, company: contact.company,
            };
            return map[v.value] ?? '';
          }
          return '';
        });
      };

      let failed = 0;
      const total = recipients.length;

      for (let i = 0; i < recipients.length; i += SEND_BATCH_SIZE) {
        const batch = recipients.slice(i, i + SEND_BATCH_SIZE);
        const apiRecipients = batch
          .filter((r) => r.contact?.phone)
          .map((r) => ({
            phone: r.contact!.phone as string,
            params: resolveParams(r.contact as Contact),
          }));

        if (apiRecipients.length > 0) {
          try {
            const sendRes = await fetch('/api/whatsapp/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipients: apiRecipients,
                template_name: broadcast.template_name,
                template_language: broadcast.template_language ?? 'en_US',
              }),
            });
            const sendData = await sendRes.json();
            const byPhone = new Map<string, { status: string; whatsapp_message_id?: string; error?: string }>();
            for (const r of (sendData.results ?? [])) byPhone.set(r.phone, r);

            for (const r of batch) {
              const phone = r.contact?.phone;
              const result = phone ? byPhone.get(phone) : undefined;
              if (result?.status === 'sent') {
                await supabase.from('broadcast_recipients').update({
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  whatsapp_message_id: result.whatsapp_message_id ?? null,
                }).eq('id', r.id);
              } else {
                failed++;
                await supabase.from('broadcast_recipients').update({
                  status: 'failed',
                  error_message: result?.error ?? 'No result',
                }).eq('id', r.id);
              }
            }
          } catch (err) {
            for (const r of batch) {
              failed++;
              await supabase.from('broadcast_recipients').update({
                status: 'failed',
                error_message: err instanceof Error ? err.message : 'Send failed',
              }).eq('id', r.id);
            }
          }
        }

        setProgress(20 + Math.round(((i + batch.length) / total) * 75));
        if (i + SEND_BATCH_SIZE < recipients.length) await sleep(SEND_BATCH_DELAY_MS);
      }

      // 4. Finalize the broadcast row
      const sentCount = total - failed;
      await supabase.from('broadcasts').update({
        status: failed === total ? 'failed' : 'sent',
        sent_count: sentCount,
        failed_count: failed,
        updated_at: new Date().toISOString(),
      }).eq('id', newBroadcastId);

      setProgress(100);
      toast.success(`Follow-up sent to ${sentCount} non-reader${sentCount !== 1 ? 's' : ''}`);
      router.push(`/broadcasts/${newBroadcastId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Resend failed');
    } finally {
      setSending(false);
      setConfirm(false);
    }
  }

  if (unreadCount === 0) return null;

  if (sending) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
        <span className="text-amber-300">Resending… {progress}%</span>
      </div>
    );
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm">
        <span className="text-amber-300">
          Resend to {unreadCount} non-reader{unreadCount !== 1 ? 's' : ''}?
        </span>
        <Button
          variant="outline" size="sm"
          onClick={() => setConfirm(false)}
          className="h-7 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleResend}
          className="h-7 bg-amber-600 text-white hover:bg-amber-700"
        >
          <Send className="h-3 w-3" /> Confirm
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setConfirm(true)}
      className="border-amber-500/30 bg-transparent text-amber-400 hover:bg-amber-500/10"
      title="Send this template again to everyone who received but didn't read it"
    >
      <Bell className="h-3.5 w-3.5" />
      Resend to unread ({unreadCount})
    </Button>
  );
}
