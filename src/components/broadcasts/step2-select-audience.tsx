'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomField, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Users,
  Tags,
  Filter,
  Upload,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useBusiness } from '@/hooks/use-business';

type AudienceType = 'all' | 'tags' | 'custom_field' | 'csv';
type CustomFieldOperator = 'is' | 'is_not' | 'contains';

interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

/** A date-range refinement — either a quick preset or an explicit from/to. */
export interface RecencyFilter {
  preset?: '24h' | '7d' | '30d';
  from?: string;
  to?: string;
}

interface AudienceConfig {
  type: AudienceType;
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  excludeTagIds?: string[];
  /** Only contacts created within this window — mirrors AiSensy's "Created At" filter. */
  createdWithin?: RecencyFilter;
  /** Only contacts with a conversation active within this window — mirrors AiSensy's "Last Seen" filter. */
  lastSeenWithin?: RecencyFilter;
}

/** Turn a RecencyFilter into concrete from/to ISO bounds, or null if empty. */
export function recencyBounds(f?: RecencyFilter): { from?: string; to?: string } | null {
  if (!f) return null;
  if (f.preset) {
    const now = new Date();
    const from = new Date(now);
    if (f.preset === '24h') from.setDate(from.getDate() - 1);
    else if (f.preset === '7d') from.setDate(from.getDate() - 7);
    else from.setDate(from.getDate() - 30);
    return { from: from.toISOString() };
  }
  if (f.from || f.to) {
    return {
      from: f.from ? new Date(f.from).toISOString() : undefined,
      to: f.to ? new Date(new Date(f.to).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() : undefined,
    };
  }
  return null;
}

interface Step2Props {
  audience: AudienceConfig;
  onUpdate: (audience: AudienceConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

const audienceOptions: {
  type: AudienceType;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    type: 'all',
    label: 'All Contacts',
    description: 'Send to every contact in your database',
    icon: Users,
  },
  {
    type: 'tags',
    label: 'Filter by Tags',
    description: 'Target contacts with specific tags',
    icon: Tags,
  },
  {
    type: 'custom_field',
    label: 'Custom Field',
    description: 'Filter by a custom field value',
    icon: Filter,
  },
  {
    type: 'csv',
    label: 'Upload CSV',
    description: 'Upload a list of phone numbers',
    icon: Upload,
  },
];

const OPERATOR_OPTIONS: { value: CustomFieldOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
];

export function Step2SelectAudience({
  audience,
  onUpdate,
  onNext,
  onBack,
}: Step2Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const { businessId } = useBusiness();
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSkipped, setCsvSkipped] = useState(0);

  // Parse an uploaded CSV/TSV into { phone, name } rows.
  // - Accepts comma, semicolon, or tab delimiters.
  // - Detects a header row and locates phone/name columns by name;
  //   falls back to first column = phone, second = name.
  // - Normalizes phones to digits (keeps a leading +), de-dupes, and
  //   reports how many rows were skipped as invalid.
  function handleCsvFile(file: File) {
    setCsvError(null);
    setCsvSkipped(0);
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onerror = () => setCsvError('Could not read that file. Try re-saving it as CSV.');
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const lines = text
          .split(/\r\n|\r|\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          setCsvError('That file looks empty.');
          onUpdate({ ...audience, csvContacts: [] });
          return;
        }

        const delimiter = lines[0].includes('\t')
          ? '\t'
          : lines[0].includes(';')
          ? ';'
          : ',';

        const splitRow = (row: string) =>
          row.split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());

        // Header detection: if the first row has no digits in any cell,
        // treat it as a header and map columns by name.
        const first = splitRow(lines[0]);
        const headerLooksLikeData = first.some((c) => /\d/.test(c));
        let phoneIdx = 0;
        let nameIdx = 1;
        let startRow = 0;

        if (!headerLooksLikeData) {
          startRow = 1;
          const lower = first.map((c) => c.toLowerCase());
          const findCol = (keys: string[]) =>
            lower.findIndex((c) => keys.some((k) => c.includes(k)));
          const p = findCol(['phone', 'mobile', 'number', 'whatsapp', 'contact']);
          const n = findCol(['name', 'first', 'customer']);
          if (p !== -1) phoneIdx = p;
          if (n !== -1) nameIdx = n;
        }

        const seen = new Set<string>();
        const contacts: { phone: string; name?: string }[] = [];
        let skipped = 0;

        for (let i = startRow; i < lines.length; i++) {
          const cols = splitRow(lines[i]);
          const rawPhone = cols[phoneIdx] ?? '';
          // Keep a leading + then strip everything non-digit.
          const hasPlus = rawPhone.trim().startsWith('+');
          const digits = rawPhone.replace(/[^\d]/g, '');
          if (digits.length < 8 || digits.length > 15) {
            skipped++;
            continue;
          }
          const phone = hasPlus ? `+${digits}` : digits;
          if (seen.has(phone)) continue;
          seen.add(phone);
          const name = nameIdx >= 0 ? (cols[nameIdx] || '').trim() : '';
          contacts.push(name ? { phone, name } : { phone });
        }

        setCsvSkipped(skipped);
        if (contacts.length === 0) {
          setCsvError('No valid phone numbers found. Check the column has 8–15 digit numbers.');
        }
        onUpdate({ ...audience, type: 'csv', csvContacts: contacts });
      } catch {
        setCsvError('Could not parse that file. Make sure it is a plain CSV.');
        onUpdate({ ...audience, csvContacts: [] });
      }
    };
    reader.readAsText(file);
  }

  // Tags are used both by the primary "Filter by Tags" audience type
  // AND by the exclude-list below — so always load once on mount.
  useEffect(() => {
    async function fetchTags() {
      setLoadingTags(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.from('tags').select('*').order('name');
        setTags(data ?? []);
      } finally {
        setLoadingTags(false);
      }
    }
    fetchTags();
  }, []);

  // Lazy-load custom fields only when that audience type is active.
  useEffect(() => {
    if (audience.type !== 'custom_field') return;
    async function fetchFields() {
      setLoadingFields(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('custom_fields')
          .select('*')
          .order('field_name');
        setCustomFields(data ?? []);
      } finally {
        setLoadingFields(false);
      }
    }
    fetchFields();
  }, [audience.type]);

  const fetchEstimatedCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const supabase = createClient();

      // Base query — produces the superset before exclude is applied.
      let baseIds: Set<string> | null = null; // null means "all contacts"

      if (audience.type === 'all') {
        // Handled below — full-table count adjusted by excludes.
      } else if (
        audience.type === 'tags' &&
        audience.tagIds &&
        audience.tagIds.length > 0
      ) {
        const { data } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.tagIds);
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'custom_field' &&
        audience.customField?.fieldId &&
        audience.customField.value
      ) {
        const { fieldId, operator, value } = audience.customField;
        let q = supabase
          .from('contact_custom_values')
          .select('contact_id')
          .eq('custom_field_id', fieldId);
        if (operator === 'is') q = q.eq('value', value);
        else if (operator === 'is_not') q = q.neq('value', value);
        else q = q.ilike('value', `%${value}%`);
        const { data } = await q;
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'csv' &&
        audience.csvContacts &&
        audience.csvContacts.length > 0
      ) {
        setEstimatedCount(audience.csvContacts.length);
        return;
      } else {
        // Partially-configured audience — wait for the user to finish.
        setEstimatedCount(null);
        return;
      }

      // Apply exclude tags
      let excludeSet: Set<string> | null = null;
      if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
        const { data: excludeRows } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.excludeTagIds);
        excludeSet = new Set((excludeRows ?? []).map((r) => r.contact_id));
      }

      // Opted-out contacts are never sent to (enforced again, unconditionally,
      // at actual send time) — subtracting them here too keeps this estimate
      // honest instead of promising a reach the send won't deliver.
      const { data: optedOutRows } = await supabase
        .from('contacts')
        .select('id')
        .not('opted_out_at', 'is', null);
      const optedOutSet = new Set((optedOutRows ?? []).map((r) => r.id));

      // "Created At" — contacts.created_at within the chosen window.
      let createdSet: Set<string> | null = null;
      const createdBounds = recencyBounds(audience.createdWithin);
      if (createdBounds) {
        let q = supabase.from('contacts').select('id');
        if (createdBounds.from) q = q.gte('created_at', createdBounds.from);
        if (createdBounds.to) q = q.lte('created_at', createdBounds.to);
        const { data } = await q;
        createdSet = new Set((data ?? []).map((r) => r.id));
      }

      // "Last Seen" — via conversations.last_message_at, the closest
      // thing this schema has to "when did we last hear from them".
      let lastSeenSet: Set<string> | null = null;
      const lastSeenBounds = recencyBounds(audience.lastSeenWithin);
      if (lastSeenBounds) {
        let q = supabase.from('conversations').select('contact_id');
        if (lastSeenBounds.from) q = q.gte('last_message_at', lastSeenBounds.from);
        if (lastSeenBounds.to) q = q.lte('last_message_at', lastSeenBounds.to);
        const { data } = await q;
        lastSeenSet = new Set((data ?? []).map((r) => r.contact_id));
      }

      const passesFilters = (id: string) =>
        !excludeSet?.has(id) &&
        !optedOutSet.has(id) &&
        (!createdSet || createdSet.has(id)) &&
        (!lastSeenSet || lastSeenSet.has(id));

      if (baseIds) {
        const effective = [...baseIds].filter(passesFilters);
        setEstimatedCount(effective.length);
      } else {
        // "All" — fetch every contact id for this business, then apply
        // the same filters client-side. A broadcast goes out from one
        // business, so scoping to it (not the whole account) is what
        // keeps this estimate honest.
        if (!businessId) { setEstimatedCount(null); return; }
        const { data } = await supabase
          .from('contacts')
          .select('id')
          .eq('business_id', businessId)
          // Website widget visitors have no real WhatsApp number
          // ("web_..." placeholder) — a broadcast can't reach them.
          .not('phone', 'ilike', 'web%');
        const ids = (data ?? []).map((r) => r.id);
        setEstimatedCount(ids.filter(passesFilters).length);
      }
    } finally {
      setLoadingCount(false);
    }
  }, [
    businessId,
    audience.type,
    audience.tagIds,
    audience.customField,
    audience.csvContacts,
    audience.excludeTagIds,
    audience.createdWithin,
    audience.lastSeenWithin,
  ]);

  useEffect(() => {
    fetchEstimatedCount();
  }, [fetchEstimatedCount]);

  function toggleTag(tagId: string) {
    const current = audience.tagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, tagIds: updated });
  }

  function toggleExcludeTag(tagId: string) {
    const current = audience.excludeTagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, excludeTagIds: updated });
  }

  function updateCustomField(patch: Partial<CustomFieldFilter>) {
    const prev = audience.customField ?? {
      fieldId: '',
      operator: 'is' as CustomFieldOperator,
      value: '',
    };
    onUpdate({ ...audience, customField: { ...prev, ...patch } });
  }

  function updateRecency(key: 'createdWithin' | 'lastSeenWithin', patch: Partial<RecencyFilter>) {
    const prev = audience[key] ?? {};
    onUpdate({ ...audience, [key]: { ...prev, ...patch } });
  }

  function clearRecency(key: 'createdWithin' | 'lastSeenWithin') {
    onUpdate({ ...audience, [key]: undefined });
  }

  const isValid =
    audience.type === 'all' ||
    (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) ||
    (audience.type === 'custom_field' &&
      !!audience.customField?.fieldId &&
      audience.customField.value.length > 0) ||
    (audience.type === 'csv' &&
      audience.csvContacts &&
      audience.csvContacts.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Select Audience</h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose who will receive this broadcast.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {audienceOptions.map((option) => {
          const isSelected = audience.type === option.type;
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              onClick={() =>
                onUpdate({
                  ...audience,
                  type: option.type,
                  // Wipe shape fields from other types to avoid stale
                  // config leaking across selections.
                  tagIds: option.type === 'tags' ? audience.tagIds : undefined,
                  customField:
                    option.type === 'custom_field'
                      ? audience.customField
                      : undefined,
                  csvContacts:
                    option.type === 'csv' ? audience.csvContacts : undefined,
                })
              }
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-violet-500 bg-violet-500/5 ring-1 ring-violet-500/30'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isSelected
                    ? 'bg-violet-500/10 text-violet-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{option.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {audience.type === 'tags' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-3 text-sm font-medium text-white">Select Tags</p>
          {loadingTags ? (
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          ) : tags.length === 0 ? (
            <p className="text-xs text-slate-400">
              No tags found. Create tags in Settings.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = audience.tagIds?.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-violet-500/30 bg-violet-500/10 text-violet-400'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="mr-1.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {audience.type === 'custom_field' && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm font-medium text-white">Custom Field Filter</p>
          {loadingFields ? (
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          ) : customFields.length === 0 ? (
            <p className="text-xs text-slate-400">
              No custom fields defined. Create one in Settings → Custom Fields.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
              <select
                value={audience.customField?.fieldId ?? ''}
                onChange={(e) => updateCustomField({ fieldId: e.target.value })}
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Select field…</option>
                {customFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.field_name}
                  </option>
                ))}
              </select>
              <select
                value={audience.customField?.operator ?? 'is'}
                onChange={(e) =>
                  updateCustomField({
                    operator: e.target.value as CustomFieldOperator,
                  })
                }
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={audience.customField?.value ?? ''}
                onChange={(e) => updateCustomField({ value: e.target.value })}
                placeholder="Value"
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
          )}
        </div>
      )}

      {audience.type === 'csv' && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm font-medium text-white">Upload contacts (CSV)</p>
          <p className="text-xs text-slate-400">
            CSV with a phone column (with country code, e.g. 919876543210). An
            optional name column is used for personalization. First row can be a
            header.
          </p>

          <label
            htmlFor="csv-upload"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-800/40 px-4 py-6 text-center transition-colors hover:border-violet-500/60"
          >
            <Upload className="h-6 w-6 text-slate-400" />
            <span className="text-sm text-slate-300">
              {csvFileName ? 'Choose a different file' : 'Click to upload a CSV file'}
            </span>
            <span className="text-xs text-slate-500">.csv or .txt · comma, semicolon, or tab</span>
            <input
              id="csv-upload"
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCsvFile(f);
                e.target.value = '';
              }}
            />
          </label>

          {csvFileName && (
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-xs">
              <p className="text-slate-300">
                <span className="font-medium text-white">{csvFileName}</span>
              </p>
              {audience.csvContacts && audience.csvContacts.length > 0 && (
                <p className="mt-1 text-emerald-400">
                  {audience.csvContacts.length.toLocaleString()} valid contact
                  {audience.csvContacts.length === 1 ? '' : 's'} loaded
                  {csvSkipped > 0 && (
                    <span className="text-slate-500"> · {csvSkipped} row{csvSkipped === 1 ? '' : 's'} skipped</span>
                  )}
                </p>
              )}
            </div>
          )}

          {csvError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {csvError}
            </p>
          )}

          {audience.csvContacts && audience.csvContacts.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-2">
              <p className="mb-1 px-1 text-[11px] uppercase tracking-wide text-slate-500">Preview</p>
              <div className="max-h-32 overflow-y-auto">
                {audience.csvContacts.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex justify-between px-1 py-0.5 text-xs text-slate-300">
                    <span>{c.phone}</span>
                    <span className="text-slate-500">{c.name || '—'}</span>
                  </div>
                ))}
                {audience.csvContacts.length > 5 && (
                  <p className="px-1 pt-1 text-[11px] text-slate-500">
                    + {(audience.csvContacts.length - 5).toLocaleString()} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recency filters — apply on top of whatever audience type is
          selected, same as the exclude list below. */}
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div>
          <p className="text-sm font-medium text-white">Recency</p>
          <p className="text-xs text-slate-400">
            Narrow to contacts who joined or were last active recently — optional, and safe to combine.
          </p>
        </div>

        {([
          { key: 'createdWithin' as const, label: 'Created At' },
          { key: 'lastSeenWithin' as const, label: 'Last Seen' },
        ]).map(({ key, label }) => {
          const value = audience[key];
          return (
            <div key={key} className="space-y-2">
              <p className="text-xs font-medium text-slate-300">{label}</p>
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { preset: '24h' as const, label: 'In 24hr' },
                  { preset: '7d' as const, label: 'This Week' },
                  { preset: '30d' as const, label: 'This Month' },
                ]).map((p) => (
                  <button
                    key={p.preset}
                    onClick={() => updateRecency(key, { preset: p.preset, from: undefined, to: undefined })}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                      value?.preset === p.preset
                        ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <input
                  type="date"
                  value={value?.from ?? ''}
                  onChange={(e) => updateRecency(key, { preset: undefined, from: e.target.value })}
                  className="h-7 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-white outline-none focus:border-violet-500"
                />
                <span className="text-xs text-slate-500">to</span>
                <input
                  type="date"
                  value={value?.to ?? ''}
                  onChange={(e) => updateRecency(key, { preset: undefined, to: e.target.value })}
                  className="h-7 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-white outline-none focus:border-violet-500"
                />
                {value && (
                  <button
                    onClick={() => clearRecency(key)}
                    className="text-xs text-slate-500 hover:text-red-400"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Opted-out contacts are always excluded — not a toggle, so this
          can't be left off by accident. AiSensy makes you remember to
          set "Opted In: Yes"; here it's just how sends work. */}
      <div className="flex items-start gap-2 rounded-xl border border-emerald-900/40 bg-emerald-500/5 p-3">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <p className="text-xs text-emerald-300">
          Contacts who&apos;ve opted out are automatically excluded from every send — this isn&apos;t a
          setting you can leave off by mistake.
        </p>
      </div>

      {/* Exclude list — applies regardless of audience type */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <X className="h-4 w-4 text-red-400" />
          <p className="text-sm font-medium text-white">
            Exclude contacts with these tags
          </p>
          <span className="text-xs text-slate-500">(optional)</span>
        </div>
        {tags.length === 0 ? (
          <p className="text-xs text-slate-500">No tags available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isExcluded = audience.excludeTagIds?.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleExcludeTag(tag.id)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isExcluded
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span
                    className="mr-1.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Audience Summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="mb-2 text-sm font-medium text-white">Audience Summary</p>
        {loadingCount ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <span className="text-xs text-slate-400">Calculating…</span>
          </div>
        ) : estimatedCount !== null ? (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-400" />
            <span className="text-sm text-white">
              {estimatedCount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">estimated recipients</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Select an audience type to see the estimate.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-slate-700 text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
