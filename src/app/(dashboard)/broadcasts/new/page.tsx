'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Broadcast } from '@/types';
import { getBroadcastStatus } from '@/lib/broadcast-status';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileEdit,
  Plus,
  Radio,
  Trash2,
  Play,
} from 'lucide-react';

function RateCell({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-300">{pct}%</span>
    </div>
  );
}

export default function BroadcastsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [drafts, setDrafts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState<Broadcast | null>(null);

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const all = data ?? [];
      setDrafts(all.filter((b) => b.status === 'draft'));
      setBroadcasts(all.filter((b) => b.status !== 'draft'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  async function deleteDraft(draft: Broadcast) {
    setDeletingId(draft.id);
    try {
      const res = await fetch(`/api/broadcasts/draft?id=${draft.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Delete failed');
      }
      toast.success('Draft deleted');
      fetchBroadcasts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete draft');
    } finally {
      setDeletingId(null);
      setConfirmDeleteDraft(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-400">
            Send bulk messages to your contacts using approved templates.
          </p>
        </div>
        <Button
          onClick={() => router.push('/broadcasts/new')}
          className="bg-violet-600 text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      {/* ── Drafts section ──────────────────────────────────────── */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileEdit className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-300">
              Saved drafts ({drafts.length})
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map((draft) => {
              const af = (draft.audience_filter as Record<string, unknown>) ?? {};
              const audienceType = (af.type as string) ?? 'all';
              const step = typeof af._current_step === 'number' ? af._current_step : 0;
              const stepLabels = ['Template', 'Audience', 'Personalise', 'Review'];
              const isDeleting = deletingId === draft.id;

              return (
                <div
                  key={draft.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-700 bg-slate-900/60 p-4"
                >
                  <div className="mb-3 space-y-1">
                    <p className="font-medium text-white">{draft.name}</p>
                    {draft.template_name && (
                      <p className="text-xs text-slate-400">
                        Template: <span className="text-slate-300">{draft.template_name}</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-400">
                      Audience: <span className="text-slate-300 capitalize">{audienceType}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Last step:{' '}
                      <span className="text-violet-400">{stepLabels[step] ?? 'Template'}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(draft.created_at).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/broadcasts/new?draft=${draft.id}`)}
                      className="flex-1 bg-violet-600 text-white hover:bg-violet-700"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Resume
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDeleting}
                      onClick={() => setConfirmDeleteDraft(draft)}
                      className="border-slate-700 bg-transparent text-slate-400 hover:bg-slate-800 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sent broadcasts ─────────────────────────────────────── */}
      <div className="space-y-3">
        {drafts.length > 0 && (
          <h2 className="text-sm font-semibold text-slate-300">Sent campaigns</h2>
        )}

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-slate-400">Loading…</span>
          </div>
        ) : broadcasts.length === 0 && drafts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
            <Radio className="mb-3 h-10 w-10 text-slate-600" />
            <p className="text-sm font-medium text-white">No broadcasts yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Create your first broadcast to reach your contacts at scale.
            </p>
            <Button
              onClick={() => router.push('/broadcasts/new')}
              className="mt-4 bg-violet-600 text-white hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              New Broadcast
            </Button>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
            <p className="text-sm text-slate-400">No sent campaigns yet. Finish a draft to send your first broadcast.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="hidden text-slate-400 md:table-cell">Template</TableHead>
                  <TableHead className="hidden text-right text-slate-400 sm:table-cell">
                    Recipients
                  </TableHead>
                  <TableHead className="hidden text-slate-400 lg:table-cell">Delivery</TableHead>
                  <TableHead className="hidden text-slate-400 lg:table-cell">Read</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="hidden text-slate-400 sm:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((broadcast) => {
                  const status = getBroadcastStatus(broadcast.status);
                  return (
                    <TableRow
                      key={broadcast.id}
                      className="cursor-pointer border-slate-800 hover:bg-slate-800/50"
                      onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                    >
                      <TableCell className="font-medium text-white">
                        {broadcast.name}
                      </TableCell>
                      <TableCell className="hidden text-slate-300 md:table-cell">
                        {broadcast.template_name}
                      </TableCell>
                      <TableCell className="hidden text-right text-slate-300 tabular-nums sm:table-cell">
                        {broadcast.total_recipients}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RateCell
                          value={broadcast.delivered_count}
                          total={broadcast.total_recipients}
                          color="bg-violet-500"
                        />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RateCell
                          value={broadcast.read_count}
                          total={broadcast.total_recipients}
                          color="bg-blue-500"
                        />
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.classes}`}
                        >
                          {status.pulse && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
                            </span>
                          )}
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-slate-400 sm:table-cell">
                        {new Date(broadcast.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Confirm delete draft dialog */}
      <AlertDialog
        open={!!confirmDeleteDraft}
        onOpenChange={(open) => { if (!open) setConfirmDeleteDraft(null); }}
      >
        <AlertDialogContent className="border-slate-800 bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete draft?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              &ldquo;{confirmDeleteDraft?.name}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteDraft && deleteDraft(confirmDeleteDraft)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
