'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Sparkles, Search, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  TEMPLATE_LIBRARY,
  TEMPLATE_INDUSTRIES,
  filterTemplates,
  type LibraryTemplate,
} from '@/lib/template-library';

const CATEGORIES = ['All', 'Marketing', 'Utility', 'Authentication'] as const;

const categoryStyle: Record<string, string> = {
  Marketing: 'bg-purple-50 text-purple-700 border-purple-200',
  Utility: 'bg-blue-50 text-blue-700 border-blue-200',
  Authentication: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function TemplateLibrary({ onUsed }: { onUsed?: () => void }) {
  const { user } = useAuth();
  const supabase = createClient();
  const [industry, setIndustry] = useState<string>('All');
  const [category, setCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [usingId, setUsingId] = useState<string | null>(null);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());

  const filtered = filterTemplates(industry, category, search);

  const useTemplate = async (tpl: LibraryTemplate) => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    setUsingId(tpl.id);
    try {
      const { error } = await supabase.from('message_templates').insert({
        user_id: user.id,
        name: tpl.name,
        category: tpl.category,
        language: tpl.language,
        header_type: tpl.header_type || null,
        header_content: tpl.header_content || null,
        body_text: tpl.body_text,
        footer_text: tpl.footer_text || null,
        status: 'Draft',
      });
      if (error) throw new Error(error.message);

      setUsedIds((prev) => new Set(prev).add(tpl.id));
      toast.success('Template added to your drafts', {
        description: 'Submit it in WhatsApp Manager for Meta approval.',
      });
      onUsed?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add template');
    } finally {
      setUsingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900" style={{ fontFamily: 'var(--font-display)' }}>
              Pre-built Template Library
            </h3>
            <p className="mt-1 text-xs text-emerald-700">
              These templates follow Meta&apos;s content guidelines. Click &quot;Use&quot; to add one to
              your drafts, then submit it in WhatsApp Manager for Meta approval before sending.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#e7ece9] bg-white py-2.5 pl-10 pr-4 text-sm text-[#0c1f17] placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="rounded-lg border border-[#e7ece9] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
        >
          {TEMPLATE_INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-[#e7ece9] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#e7ece9] bg-white py-12 text-center text-sm text-slate-400">
          No templates match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((tpl) => {
            const used = usedIds.has(tpl.id);
            return (
              <div
                key={tpl.id}
                className="flex flex-col rounded-xl border border-[#e7ece9] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#0c1f17]">{tpl.title}</h4>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryStyle[tpl.category]}`}>
                    {tpl.category}
                  </span>
                </div>

                <p className="mb-3 text-xs text-slate-500">{tpl.description}</p>

                {/* Preview bubble */}
                <div className="mb-3 flex-1 rounded-lg bg-[#f0f7f3] p-3">
                  <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">
                    {tpl.body_text}
                  </p>
                  {tpl.footer_text && (
                    <p className="mt-2 text-[10px] text-slate-400">{tpl.footer_text}</p>
                  )}
                </div>

                {/* Variables */}
                <div className="mb-3 flex flex-wrap gap-1">
                  {tpl.variables.map((v, i) => (
                    <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {`{{${i + 1}}}`} = {v}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-[#e7ece9] pt-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {tpl.industry} · {tpl.language}
                  </span>
                  <button
                    onClick={() => useTemplate(tpl)}
                    disabled={usingId === tpl.id || used}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
                      used
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'
                    }`}
                  >
                    {usingId === tpl.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : used ? (
                      <><Check className="h-3.5 w-3.5" /> Added</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5" /> Use</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
