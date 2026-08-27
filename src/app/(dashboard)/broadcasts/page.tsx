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
import { FileEdit, Plus, Radio, Trash2, Play } from 'lucide-react';
import { useBusiness } from '@/hooks/use-business';

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
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#e7ece9]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{pct}%</span>
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { businessId, loading: businessLoading } = useBusiness();

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      if (businessLoading) return;
      if (!businessId) { setDrafts([]); setBroadcasts([]); setLoading(false); return; }

      const { data, error } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('business_id', businessId)
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
  }, [supabase, businessId, businessLoading]);

  useEffect(() => { fetchBroadcasts(); }, [fetchBroadcasts]);

  async function deleteDraft(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/broadcasts/draft?id=${id}`, { method: 'DELETE' });
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
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Send bulk messages to your contacts using approved templates.
          </p>
        </div>
        <Button
          onClick={() => router.push('/broadcasts/new')}
          className="bg-emerald-500 text-white hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      {/* Drafts section */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileEdit className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold text-[#0c1f17]">
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
              const isConfirming = confirmDeleteId === draft.id;

              return (
                <div
                  key={draft.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#e7ece9] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 space-y-1">
                    <p className="font-semibold text-[#0c1f17]">{draft.name}</p>
                    {draft.template_name && (
                      <p className="text-xs text-slate-500">
                        Template: <span className="font-medium text-slate-700">{draft.template_name}</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      Audience: <span className="font-medium capitalize text-slate-700">{audienceType}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Last step:{' '}
                      <span className="font-medium text-emerald-600">{stepLabels[step] ?? 'Template'}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(draft.created_at).toLocaleDateString(undefined, {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/broadcasts/new?draft=${draft.id}`)}
                      className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Resume
                    </Button>

                    {/* Inline confirm — same pattern as broadcasts/[id]/page.tsx */}
                    {isConfirming ? (
                      <div className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1">
                        <span className="text-xs text-red-600">Sure?</span>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1 text-xs text-slate-400 hover:text-slate-700"
                        >
                          No
                        </button>
                        <button
                          onClick={() => deleteDraft(draft.id)}
                          disabled={isDeleting}
                          className="px-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          {isDeleting ? '…' : 'Yes'}
                        </button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDeleteId(draft.id)}
                        className="border-[#e7ece9] bg-white text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sent broadcasts */}
      <div className="space-y-3">
        {drafts.length > 0 && broadcasts.length > 0 && (
          <h2 className="text-sm font-bold text-[#0c1f17]">Sent campaigns</h2>
        )}

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-sm text-slate-400">Loading…</span>
          </div>
        ) : broadcasts.length === 0 && drafts.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Radio className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-[#0c1f17]">No broadcasts yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Create your first broadcast to reach your contacts at scale.
            </p>
            <Button
              onClick={() => router.push('/broadcasts/new')}
              className="mt-4 bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <Plus className="h-4 w-4" />
              New Broadcast
            </Button>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
            <p className="text-sm text-slate-400">
              No sent campaigns yet — finish a draft to send your first broadcast.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-[#e7ece9] hover:bg-transparent">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="hidden text-slate-400 md:table-cell">Template</TableHead>
                  <TableHead className="hidden text-right text-slate-400 sm:table-cell">Recipients</TableHead>
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
                      className="cursor-pointer border-[#e7ece9] hover:bg-[#f8faf9]"
                      onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                    >
                      <TableCell className="font-semibold text-[#0c1f17]">{broadcast.name}</TableCell>
                      <TableCell className="hidden text-slate-600 md:table-cell">{broadcast.template_name}</TableCell>
                      <TableCell className="hidden text-right text-slate-600 tabular-nums sm:table-cell">{broadcast.total_recipients}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RateCell value={broadcast.delivered_count} total={broadcast.total_recipients} color="bg-emerald-500" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RateCell value={broadcast.read_count} total={broadcast.total_recipients} color="bg-blue-500" />
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.classes}`}>
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
    </div>
  );
}
