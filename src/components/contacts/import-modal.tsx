'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Download,
  ArrowLeft, ArrowRight, X,
} from 'lucide-react';
import type { Tag } from '@/types';
import {
  CONTACT_FIELDS,
  readContactFile,
  guessMapping,
  prepareContacts,
  rejectedRowsToCsv,
  isLegacySpreadsheetFile,
  XlsxError,
  type Sheet,
  type ColumnMapping,
  type ContactField,
  type PrepareResult,
} from '@/lib/contacts/import-parse';
import { useScopedBusinessId } from '@/hooks/use-business';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type Step = 'upload' | 'map' | 'done';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const CHUNK_SIZE = 500;
const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xlsm';

const SAMPLE_CSV = [
  'phone,name,email,company',
  '919876543210,Asha Patel,asha@example.com,Patel Realty',
  '919812345678,Vikram Shah,vikram@example.com,Shah Estates',
].join('\r\n');

function downloadCsv(filename: string, csv: string) {
  // The BOM makes Excel open UTF-8 correctly instead of mangling accents.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportModal({ open, onOpenChange, onImported }: ImportModalProps) {
  const supabase = createClient();
  const businessId = useScopedBusinessId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  const [existingPhones, setExistingPhones] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  // Load tags once the dialog opens so the picker is ready on the mapping step.
  useEffect(() => {
    if (!open) return;
    supabase
      .from('tags')
      .select('*')
      .order('name')
      .then(({ data }) => setAllTags((data ?? []) as Tag[]));
  }, [open, supabase]);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setSheet(null);
    setMapping(null);
    setResult(null);
    setProgress(0);
    setTagIds(new Set());
    setExistingPhones(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  /**
   * Pull every number already in the account so the preview can tell the user
   * up front how many rows are new, rather than failing them at insert time.
   */
  const loadExistingPhones = useCallback(async () => {
    const phones = new Set<string>();
    const pageSize = 1000;
    for (let from = 0; from < 100_000; from += pageSize) {
      const { data, error } = await supabase
        .from('contacts')
        .select('phone')
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      for (const row of data) if (row.phone) phones.add(String(row.phone));
      if (data.length < pageSize) break;
    }
    setExistingPhones(phones);
  }, [supabase]);

  const loadFile = useCallback(async (selected: File, sheetName?: string) => {
    if (selected.size > MAX_FILE_BYTES) {
      toast.error('File is larger than 15 MB. Split it into smaller files.');
      return;
    }

    setReading(true);
    try {
      const parsed = await readContactFile(selected, sheetName);

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error('That file has no data rows', {
          description: 'The first row must be your column headings.',
        });
        return;
      }

      setFile(selected);
      setSheet(parsed);
      setMapping(guessMapping(parsed.headers));
      setStep('map');
      void loadExistingPhones();
    } catch (err) {
      console.error('[import] parse failed:', err);
      // XlsxError messages are written for the user and already say what to do.
      toast.error('Could not read that file', {
        description: err instanceof XlsxError
          ? err.message
          : isLegacySpreadsheetFile(selected.name)
            ? 'Re-save it as Excel Workbook (.xlsx) and try again.'
            : 'The file may be password-protected or corrupted. Try re-saving it as .xlsx or CSV.',
      });
    } finally {
      setReading(false);
    }
  }, [loadExistingPhones]);

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) void loadFile(selected);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void loadFile(dropped);
  }

  const preparation: PrepareResult | null = useMemo(() => {
    if (!sheet || !mapping) return null;
    return prepareContacts(sheet, mapping, { existingPhones });
  }, [sheet, mapping, existingPhones]);

  function setField(field: ContactField, value: string) {
    setMapping((prev) => (prev ? { ...prev, [field]: value === '' ? null : Number(value) } : prev));
  }

  function toggleTag(id: string) {
    setTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (!preparation || preparation.valid.length === 0) return;

    setImporting(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('Your session expired — please sign in again.');

      const rows = preparation.valid;
      const selectedTags = [...tagIds];
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE).map((row) => ({
          user_id: userId,
          business_id: businessId,
          phone: row.phone,
          name: row.name,
          email: row.email,
          company: row.company,
        }));

        const { data, error } = await supabase.from('contacts').insert(chunk).select('id');

        if (error) {
          // One bad row shouldn't cost the whole chunk — retry individually.
          for (const row of chunk) {
            const { data: single, error: singleError } = await supabase
              .from('contacts').insert(row).select('id').single();
            if (singleError || !single) {
              failed++;
            } else {
              imported++;
              if (selectedTags.length) await attachTags(single.id, selectedTags);
            }
          }
        } else {
          imported += data?.length ?? chunk.length;
          if (selectedTags.length && data?.length) {
            await supabase.from('contact_tags').insert(
              data.flatMap((c) => selectedTags.map((tagId) => ({ contact_id: c.id, tag_id: tagId }))),
            );
          }
        }

        setProgress(Math.round(Math.min(i + CHUNK_SIZE, rows.length) / rows.length * 100));
      }

      setResult({ imported, failed });
      setStep('done');
      if (imported > 0) onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function attachTags(contactId: string, selectedTags: string[]) {
    await supabase.from('contact_tags').insert(
      selectedTags.map((tagId) => ({ contact_id: contactId, tag_id: tagId })),
    );
  }

  function downloadRejected() {
    if (!sheet || !preparation) return;
    downloadCsv('aisend-import-errors.csv', rejectedRowsToCsv(sheet.headers, preparation.rejected));
  }

  const previewRows = useMemo(() => preparation?.valid.slice(0, 5) ?? [], [preparation]);
  const phoneMapped = mapping?.phone !== null && mapping?.phone !== undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-white border-[#e7ece9] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#0c1f17]">Import Contacts</DialogTitle>
          <DialogDescription className="text-slate-500">
            Upload an Excel or CSV file, match your columns, and review before importing.
          </DialogDescription>
        </DialogHeader>

        <Stepper step={step} />

        {/* ── STEP 1: UPLOAD ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 transition-colors ${
                dragging ? 'border-emerald-500 bg-emerald-50' : 'border-[#e7ece9] hover:border-emerald-400 hover:bg-emerald-50/40'
              }`}
            >
              {reading ? (
                <>
                  <Loader2 className="size-8 animate-spin text-emerald-500" />
                  <p className="text-sm text-slate-500">Reading your file…</p>
                </>
              ) : (
                <>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50">
                    <Upload className="size-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-semibold text-[#0c1f17]">
                    Drop your file here, or click to browse
                  </p>
                  <p className="text-xs text-slate-400">
                    Excel (.xlsx) or CSV — up to 15 MB
                  </p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={onFileInput}
              className="hidden"
            />

            <div className="rounded-xl border border-[#e7ece9] bg-[#f7faf8] p-4">
              <p className="text-xs font-semibold text-[#0c1f17]">Your column names don&apos;t need to match</p>
              <p className="mt-1 text-xs text-slate-500">
                Headings like <code className="rounded bg-white px-1">Broker Name</code> or{' '}
                <code className="rounded bg-white px-1">Email ID</code> are fine — you&apos;ll match
                them to fields on the next step. Only a mobile number column is required.
              </p>
              <button
                onClick={() => downloadCsv('aisend-sample-contacts.csv', SAMPLE_CSV)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
              >
                <Download className="size-3.5" /> Download a sample file
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: MAP ── */}
        {step === 'map' && sheet && mapping && preparation && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-[#e7ece9] bg-white px-4 py-3">
              <FileSpreadsheet className="size-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0c1f17]">{file?.name}</p>
                <p className="text-xs text-slate-500">
                  {sheet.rows.length.toLocaleString()} rows · {sheet.headers.length} columns
                </p>
              </div>
              <button
                onClick={reset}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Choose a different file"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Multi-sheet workbooks: let the user pick which tab holds the data. */}
            {sheet.sheetNames && sheet.sheetNames.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Sheet:</span>
                {sheet.sheetNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => file && loadFile(file, name)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      sheet.activeSheet === name
                        ? 'bg-emerald-500 text-white'
                        : 'border border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-400'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Match your columns
              </p>
              <div className="space-y-2">
                {CONTACT_FIELDS.map((spec) => (
                  <div key={spec.field} className="grid grid-cols-[140px_1fr] items-center gap-3">
                    <label className="text-sm font-medium text-slate-700">
                      {spec.label}
                      {spec.required && <span className="ml-0.5 text-red-500">*</span>}
                    </label>
                    <select
                      value={mapping[spec.field] ?? ''}
                      onChange={(e) => setField(spec.field, e.target.value)}
                      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#0c1f17] focus:outline-none ${
                        spec.required && mapping[spec.field] === null
                          ? 'border-red-300 focus:border-red-500'
                          : 'border-[#e7ece9] focus:border-emerald-500'
                      }`}
                    >
                      <option value="">
                        {spec.required ? '— Select a column —' : "— Don't import —"}
                      </option>
                      {sheet.headers.map((header, index) => (
                        <option key={index} value={index}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {!phoneMapped && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">
                  Pick which column holds the mobile number to continue.
                </p>
              </div>
            )}

            {/* Counts */}
            {phoneMapped && (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Ready to import" value={preparation.valid.length} tone="emerald" />
                <Stat label="Duplicates in file" value={preparation.duplicatesInFile} tone="slate" />
                <Stat label="Skipped rows" value={preparation.rejected.length} tone="red" />
              </div>
            )}

            {/* Preview */}
            {previewRows.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Preview
                </p>
                <div className="overflow-x-auto rounded-xl border border-[#e7ece9]">
                  <table className="w-full text-xs">
                    <thead className="bg-[#f7faf8]">
                      <tr>
                        {['Mobile Number', 'Name', 'Email', 'Company'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-t border-[#f0f4f2]">
                          <td className="px-3 py-2 font-medium text-[#0c1f17]">{row.phone}</td>
                          <td className="px-3 py-2 text-slate-600">{row.name ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.email ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.company ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Numbers are saved in international format. 10-digit numbers get +91 added.
                </p>
              </div>
            )}

            {preparation.rejected.length > 0 && (
              <button
                onClick={downloadRejected}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
              >
                <Download className="size-3.5" />
                Download {preparation.rejected.length} skipped row
                {preparation.rejected.length !== 1 ? 's' : ''} with reasons
              </button>
            )}

            {/* Tags */}
            {allTags.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tag these contacts <span className="font-medium normal-case tracking-normal">(optional)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const active = tagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          active ? 'border-transparent text-white' : 'border-[#e7ece9] bg-white text-slate-500 hover:border-emerald-400'
                        }`}
                        style={active ? { background: tag.color, borderColor: tag.color } : {}}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {importing && (
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">Importing… {progress}%</p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: DONE ── */}
        {step === 'done' && result && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="size-7 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-[#0c1f17]">
                {result.imported.toLocaleString()} contact{result.imported !== 1 ? 's' : ''} imported
              </p>
              {preparation && (preparation.rejected.length > 0 || preparation.duplicatesInFile > 0 || result.failed > 0) && (
                <p className="text-center text-sm text-slate-500">
                  {[
                    preparation.duplicatesInFile > 0 && `${preparation.duplicatesInFile} duplicate${preparation.duplicatesInFile !== 1 ? 's' : ''} in file`,
                    preparation.rejected.length > 0 && `${preparation.rejected.length} skipped`,
                    result.failed > 0 && `${result.failed} failed`,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            {preparation && preparation.rejected.length > 0 && (
              <button
                onClick={downloadRejected}
                className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
              >
                <Download className="size-3.5" /> Download skipped rows
              </button>
            )}
          </div>
        )}

        <DialogFooter className="bg-white">
          {step === 'map' && (
            <Button
              variant="outline"
              onClick={reset}
              disabled={importing}
              className="border-[#e7ece9] text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
          )}
          {step !== 'map' && (
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-[#e7ece9] text-slate-600 hover:bg-slate-50"
            >
              {step === 'done' ? 'Close' : 'Cancel'}
            </Button>
          )}
          {step === 'map' && (
            <Button
              onClick={handleImport}
              disabled={importing || !preparation || preparation.valid.length === 0}
              className="bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Import {preparation && preparation.valid.length > 0 ? `${preparation.valid.length.toLocaleString()} contacts` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Match columns' },
    { key: 'done', label: 'Done' },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-2 border-y border-[#e7ece9] py-3">
      {steps.map((s, i) => {
        const state = i < activeIndex ? 'complete' : i === activeIndex ? 'active' : 'upcoming';
        return (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                state === 'complete' ? 'bg-emerald-100 text-emerald-700'
                  : state === 'active' ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {state === 'complete' ? '✓' : i + 1}
            </span>
            <span className={`text-xs font-semibold ${state === 'upcoming' ? 'text-slate-400' : 'text-[#0c1f17]'}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-[#e7ece9]" />}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'slate' | 'red' }) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    slate: 'border-[#e7ece9] bg-white text-slate-600',
    red: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-lg font-bold leading-tight">{value.toLocaleString()}</p>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
    </div>
  );
}
