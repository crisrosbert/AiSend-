"use client";

// src/components/broadcasts/resume-broadcast-button.tsx
//
// Finishes a campaign that stopped part-way through.
//
// Sending runs in the browser: the dashboard walks the contact list and
// posts batches to the send endpoint. Close the tab, sleep the laptop,
// lose signal — the loop ends, and everyone it had not reached stays
// pending. On a large campaign that can be most of the list, already
// budgeted for and never delivered, with nothing in the UI admitting it.
//
// This button only appears when there is genuinely something left to
// send, so it is invisible on a campaign that completed normally.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlayCircle, Loader2 } from "lucide-react";

interface Props {
  broadcastId: string;
  /** Refresh the page's own data once the campaign finishes. */
  onFinished?: () => void;
}

export function ResumeBroadcastButton({ broadcastId, onFinished }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [sentThisRun, setSentThisRun] = useState(0);

  const check = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/whatsapp/broadcast/resume?broadcast_id=${encodeURIComponent(broadcastId)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setRemaining(typeof data.remaining === "number" ? data.remaining : 0);
    } catch {
      // A failed check just means no button. Nothing worth interrupting
      // the page for.
    }
  }, [broadcastId]);

  useEffect(() => { void check(); }, [check]);

  async function resume() {
    setRunning(true);
    setSentThisRun(0);
    try {
      // The endpoint works to a time budget and reports what is left, so
      // a large campaign finishes over several rounds rather than one
      // request that cannot complete. Bounded, so a server that keeps
      // reporting work cannot spin here forever.
      let total = 0;
      for (let round = 0; round < 40; round++) {
        const res = await fetch("/api/whatsapp/broadcast/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ broadcast_id: broadcastId }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error || "Could not resume this campaign");
          return;
        }

        total += data.sent ?? 0;
        setSentThisRun(total);
        setRemaining(data.remaining ?? 0);

        if (data.complete) {
          toast.success(
            total > 0
              ? `Campaign finished — ${total} more message${total === 1 ? "" : "s"} sent`
              : "Campaign was already complete",
          );
          onFinished?.();
          return;
        }
      }

      // Ran out of rounds with work still outstanding. Say so plainly
      // rather than implying it finished.
      toast.message(`Sent ${total} so far — press Resume again to continue`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resume");
    } finally {
      setRunning(false);
      void check();
    }
  }

  // Nothing outstanding: no button, no explanation needed.
  if (remaining === null || remaining === 0) return null;

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-amber-500">
        {remaining.toLocaleString()} recipient{remaining === 1 ? "" : "s"} never sent
      </span>
      <Button size="sm" onClick={resume} disabled={running}>
        {running ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            {sentThisRun > 0 ? `Sent ${sentThisRun}…` : "Resuming…"}
          </>
        ) : (
          <>
            <PlayCircle className="mr-1.5 size-3.5" />
            Resume sending
          </>
        )}
      </Button>
    </div>
  );
}
