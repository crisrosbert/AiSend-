'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Contact, CustomField, MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronLeft,
  Copy,
  Loader2,
  Sparkles,
  Tag,
  Type,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

type VariableType = 'static' | 'field' | 'custom_field';

interface VariableMapping {
  type: VariableType;
  value: string;
}

interface Step3Props {
  template: MessageTemplate;
  variables: Record<string, VariableMapping>;
  onUpdate: (variables: Record<string, VariableMapping>) => void;
  onNext: () => void;
  onBack: () => void;
}

const contactFields = [
  { value: 'name', label: 'Contact Name' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'company', label: 'Company' },
];

const TYPE_OPTIONS: { value: VariableType; label: string; icon: typeof Type }[] = [
  { value: 'static', label: 'Static', icon: Type },
  { value: 'field', label: 'Contact Field', icon: User },
  { value: 'custom_field', label: 'Custom Field', icon: Tag },
];

const SAMPLE_CONTACT: Contact = {
  id: 'sample',
  user_id: '',
  name: 'John Doe',
  phone: '+1234567890',
  email: 'john@example.com',
  company: 'Acme Corp',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function Step3Personalize({
  template,
  variables,
  onUpdate,
  onNext,
  onBack,
}: Step3Props) {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [firstContact, setFirstContact] = useState<Contact | null>(null);
  const [firstContactCustomValues, setFirstContactCustomValues] = useState<
    Map<string, string>
  >(new Map());
  const [loadingPreview, setLoadingPreview] = useState(true);

  // Load user's custom fields + a representative contact for the
  // live preview. Fall back to sample data if no contacts exist yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [fieldsRes, contactRes] = await Promise.all([
        supabase.from('custom_fields').select('*').order('field_name'),
        supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      setCustomFields(fieldsRes.data ?? []);
      setLoadingFields(false);

      const contact = contactRes.data ?? null;
      setFirstContact(contact);

      if (contact) {
        const { data: customVals } = await supabase
          .from('contact_custom_values')
          .select('custom_field_id, value')
          .eq('contact_id', contact.id);
        if (!cancelled) {
          const map = new Map<string, string>();
          for (const row of customVals ?? []) {
            map.set(row.custom_field_id, row.value ?? '');
          }
          setFirstContactCustomValues(map);
        }
      }
      setLoadingPreview(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const placeholders = useMemo(() => {
    const matches = template.body_text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches)].sort();
  }, [template.body_text]);

  /**
   * A placeholder is "unmapped" if the user hasn't picked either a
   * static value or a field/custom-field source. Blocks Next until
   * every placeholder has something — otherwise the broadcast would
   * ship with empty strings and confuse recipients.
   */
  const unmappedKeys = useMemo(() => {
    const missing: string[] = [];
    for (const placeholder of placeholders) {
      const key = placeholder.replace(/^\{\{|\}\}$/g, '');
      const mapping = variables[key];
      if (!mapping || !mapping.value?.trim()) {
        missing.push(placeholder);
      }
    }
    return missing;
  }, [placeholders, variables]);

  function updateVariable(key: string, patch: Partial<VariableMapping>) {
    const current = variables[key] ?? { type: 'static' as VariableType, value: '' };
    onUpdate({
      ...variables,
      [key]: { ...current, ...patch },
    });
  }

  const previewContact = firstContact ?? SAMPLE_CONTACT;
  const previewCustomValues = useMemo(
    () => (firstContact ? firstContactCustomValues : new Map<string, string>()),
    [firstContact, firstContactCustomValues],
  );

  /**
   * Preview text broken into segments so each substituted placeholder
   * can be highlighted inline — showing at a glance which words in the
   * bubble are dynamic and where each one comes from, rather than a
   * flat wall of text that reads identically to the final message.
   */
  const previewSegments = useMemo(() => {
    const parts = template.body_text.split(/(\{\{\d+\}\})/g);
    return parts
      .filter((part) => part.length > 0)
      .map((part) => {
        const match = part.match(/^\{\{(\d+)\}\}$/);
        if (!match) return { text: part, dynamic: false, source: '' };

        const key = match[1];
        const mapping = variables[key];
        let text = part;
        let source = 'Not mapped yet';

        if (mapping?.value) {
          if (mapping.type === 'static') {
            text = mapping.value;
            source = 'Static value';
          } else if (mapping.type === 'field') {
            const fieldMap: Record<string, string | undefined> = {
              name: previewContact.name,
              phone: previewContact.phone,
              email: previewContact.email,
              company: previewContact.company,
            };
            text = fieldMap[mapping.value] ?? part;
            source = contactFields.find((f) => f.value === mapping.value)?.label ?? 'Contact field';
          } else if (mapping.type === 'custom_field') {
            text = previewCustomValues.get(mapping.value) || part;
            source = customFields.find((f) => f.id === mapping.value)?.field_name ?? 'Custom field';
          }
        }
        return { text, dynamic: true, source };
      });
  }, [template.body_text, variables, previewContact, previewCustomValues, customFields]);

  const previewText = useMemo(
    () => previewSegments.map((s) => s.text).join(''),
    [previewSegments],
  );

  const previewLabel = firstContact
    ? firstContact.name || firstContact.phone
    : 'sample data';

  function copyPreview() {
    navigator.clipboard.writeText(previewText).then(
      () => toast.success('Preview text copied'),
      () => toast.error('Could not copy'),
    );
  }

  const now = new Date();
  const timeLabel = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#0c1f17]">Personalize Message</h2>
        <p className="mt-1 text-sm text-slate-500">
          Map each template variable to a contact field, custom field, or a
          fixed value — then check the live preview on the right.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Variable mapping ── */}
        <div className="space-y-4">
          {placeholders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e7ece9] bg-white p-8 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-emerald-400" />
              <p className="mt-3 text-sm font-medium text-[#0c1f17]">
                Nothing to personalize
              </p>
              <p className="mt-1 text-sm text-slate-500">
                This template has no variables — every recipient gets the
                exact same message.
              </p>
            </div>
          ) : (
            placeholders.map((placeholder) => {
              const key = placeholder.replace(/^\{\{|\}\}$/g, '');
              const mapping = variables[key] ?? { type: 'static' as VariableType, value: '' };
              const filled = !!mapping.value?.trim();

              return (
                <div
                  key={placeholder}
                  className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                    filled ? 'border-[#e7ece9]' : 'border-amber-200'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-mono font-semibold text-emerald-700">
                      {placeholder}
                    </span>
                    {filled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <Check className="h-3 w-3" /> Mapped
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-600">Needs a value</span>
                    )}
                  </div>

                  {/* Segmented type picker — a tap-to-switch pill row reads
                      faster than a dropdown for a 3-option choice, and
                      keeps all options visible at once. */}
                  <div className="mb-3 inline-flex rounded-lg border border-[#e7ece9] bg-[#f8faf9] p-0.5">
                    {TYPE_OPTIONS.map((opt) => {
                      const active = mapping.type === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateVariable(key, { type: opt.value, value: '' })}
                          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'text-slate-500 hover:text-[#0c1f17]'
                          }`}
                        >
                          <opt.icon className="h-3.5 w-3.5" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {mapping.type === 'static' ? (
                    <Input
                      value={mapping.value}
                      onChange={(e) => updateVariable(key, { value: e.target.value })}
                      placeholder="Enter the value every recipient sees…"
                      className="border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400"
                    />
                  ) : mapping.type === 'field' ? (
                    <div className="flex flex-wrap gap-2">
                      {contactFields.map((field) => (
                        <button
                          key={field.value}
                          type="button"
                          onClick={() => updateVariable(key, { value: field.value })}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            mapping.value === field.value
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-[#e7ece9] bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50'
                          }`}
                        >
                          {field.label}
                        </button>
                      ))}
                    </div>
                  ) : loadingFields ? (
                    <p className="text-xs text-slate-400">Loading custom fields…</p>
                  ) : customFields.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      You have no custom fields yet — add one in Contacts.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {customFields.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateVariable(key, { value: f.id })}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            mapping.value === f.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-[#e7ece9] bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50'
                          }`}
                        >
                          {f.field_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {unmappedKeys.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Map every placeholder before continuing — still missing{' '}
              <span className="font-mono font-semibold">{unmappedKeys.join(', ')}</span>.
              Otherwise those placeholders ship to Meta as empty strings.
            </div>
          )}
        </div>

        {/* ── Live preview — a phone-style mockup so this reads as what
            the recipient will actually see, not an abstract text block ── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Live Preview
            </p>
            <button
              type="button"
              onClick={copyPreview}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-[#e7ece9] bg-white shadow-sm">
            {/* WhatsApp-style header bar */}
            <div
              className="flex items-center gap-2 px-3 py-2.5"
              style={{ background: 'var(--brand-teal-dark, #075E54)' }}
            >
              <ChevronLeft className="h-4 w-4 text-white/70" />
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
                {(template.name || 'B').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">
                  {template.name || 'Your Business'}
                </p>
                <p className="text-[10px] text-white/60">
                  {loadingPreview ? 'Loading preview…' : `Previewing as ${previewLabel}`}
                </p>
              </div>
              {loadingPreview && (
                <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-white/70" />
              )}
            </div>

            {/* Chat area */}
            <div
              className="p-3"
              style={{
                backgroundColor: 'var(--brand-50, #E9FBEF)',
                backgroundImage:
                  'radial-gradient(rgba(37,211,102,0.16) 1px, transparent 1.5px), ' +
                  'radial-gradient(rgba(37,211,102,0.10) 1px, transparent 1.5px)',
                backgroundSize: '28px 28px, 28px 28px',
                backgroundPosition: '0 0, 14px 14px',
                minHeight: 180,
              }}
            >
              <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-sm bg-[var(--brand-100,#C8F5D6)] px-3 py-2 shadow-sm">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#0c1f17]">
                  {previewSegments.map((seg, i) =>
                    seg.dynamic ? (
                      <mark
                        key={i}
                        title={seg.source}
                        className="rounded bg-emerald-500/20 px-0.5 font-medium text-emerald-900"
                      >
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    ),
                  )}
                </p>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <span className="text-[10px] text-[#0c1f17]/45">{timeLabel}</span>
                  <CheckCheck className="h-3 w-3" style={{ color: '#53bdeb' }} />
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Highlighted words are filled in per recipient — hover one to see
            where it comes from.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#e7ece9] pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-[#e7ece9] text-slate-600 hover:bg-[#f8faf9]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={unmappedKeys.length > 0}
          className="bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
