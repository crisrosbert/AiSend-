'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { notifyWhatsappError } from '@/lib/whatsapp/connect-toast';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ArrowRight, RefreshCw, Plus } from 'lucide-react';

const categoryColors: Record<string, string> = {
  Marketing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Utility: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Authentication: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

interface Step1Props {
  selectedTemplate: MessageTemplate | null;
  onSelect: (template: MessageTemplate) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step1ChooseTemplate({ selectedTemplate, onSelect, onNext, onBack }: Step1Props) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setTemplates(data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Same call the Settings > Templates "Sync from Meta" button makes: pulls the
  // account's templates from WhatsApp Manager into this list, so a user who
  // already has approved templates never has to leave the campaign flow.
  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Sync failed (HTTP ${res.status})`);
      toast.success(`Synced ${data.total ?? 0} template${data.total === 1 ? '' : 's'} from Meta`);
      await fetchTemplates();
    } catch (err) {
      notifyWhatsappError(err instanceof Error ? err.message : 'Failed to sync templates');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Choose a Template</h2>
        <p className="mt-1 text-sm text-slate-400">
          Select an approved message template for your broadcast.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50">
          <FileText className="mb-2 h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">No templates available.</p>
          <p className="mt-1 max-w-sm px-4 text-center text-xs text-slate-500">
            A campaign needs a template approved by WhatsApp. Create one, or pull the ones you
            already have in WhatsApp Manager.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync from Meta
            </Button>
            <Link
              href="/settings?tab=templates"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-sm font-medium !text-[#fff] hover:bg-violet-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Create template
            </Link>
          </div>
        </div>
      ) : (
        <>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync from Meta
          </Button>
          <Link
            href="/settings?tab=templates"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Create template
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            const catColor = categoryColors[template.category] ?? categoryColors.Utility;

            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={`flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-violet-500 bg-violet-500/5 ring-1 ring-violet-500/30'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-white">{template.name}</h3>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${catColor}`}
                  >
                    {template.category}
                  </span>
                </div>
                <p className="line-clamp-3 text-xs text-slate-400">{template.body_text}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{template.language ?? 'en_US'}</span>
                  {template.status && (
                    <>
                      <span>-</span>
                      <span>{template.status}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <Button variant="outline" onClick={onBack} className="border-slate-700 text-slate-300">
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedTemplate}
          className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
