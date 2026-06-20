'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Contact, MessageTemplate } from '@/types';

export type CustomFieldOperator = 'is' | 'is_not' | 'contains';

export interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

export interface AudienceConfig {
  type: 'all' | 'tags' | 'custom_field' | 'csv';
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  excludeTagIds?: string[];
}

export type VariableMapping =
  | { type: 'static'; value: string }
  | { type: 'field'; value: string }
  | { type: 'custom_field'; value: string };

interface BroadcastPayload {
  name: string;
  template: MessageTemplate;
  audience: AudienceConfig;
  variables: Record<string, VariableMapping>;
}

interface UseBroadcastSendingReturn {
  createAndSendBroadcast: (payload: BroadcastPayload) => Promise<string>;
  isProcessing: boolean;
  progress: number;
  skippedOptOut: number;  // NEW — how many were skipped due to opt-out
}

/**
 * Meta rate-limit pacing.
 * 10 messages per batch, 1 second between batches = ~600/min.
 * Safe for Tier 2+. For Tier 1 (new numbers) reduce to 1 + 1000ms.
 */
const SEND_BATCH_SIZE = 10;
const SEND_BATCH_DELAY_MS = 1000;
const INSERT_BATCH_SIZE = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BroadcastApiResult {
  phone: string;
  status: 'sent' | 'failed';
  whatsapp_message_id?: string;
  error?: string;
}

type CustomValueIndex = Map<string, Map<string, string>>;

export function resolveVariables(
  variables: Record<string, VariableMapping>,
  contact: Contact,
  customValues?: Map<string, string>,
): string[] {
  const keys = Object.keys(variables).sort((a, b) => {
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.localeCompare(b);
  });

  return keys.map((key) => {
    const v = variables[key];
    if (v.type === 'static') return v.value;
    if (v.type === 'field') {
      const fieldMap: Record<string, string | undefined> = {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        company: contact.company,
      };
      return fieldMap[v.value] ?? '';
    }
    return customValues?.get(v.value) ?? '';
  });
}

async function fetchCustomValueIndex(
  supabase: ReturnType<typeof createClient>,
  contactIds: string[],
): Promise<CustomValueIndex> {
  const index: CustomValueIndex = new Map();
  if (contactIds.length === 0) return index;

  const PAGE = 500;
  for (let i = 0; i < contactIds.length; i += PAGE) {
    const slice = contactIds.slice(i, i + PAGE);
    const { data } = await supabase
      .from('contact_custom_values')
      .select('contact_id, custom_field_id, value')
      .in('contact_id', slice);

    for (const row of data ?? []) {
      const bucket = index.get(row.contact_id) ?? new Map<string, string>();
      bucket.set(row.custom_field_id, row.value ?? '');
      index.set(row.contact_id, bucket);
    }
  }
  return index;
}

export function useBroadcastSending(): UseBroadcastSendingReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [skippedOptOut, setSkippedOptOut] = useState(0);

  async function resolveAudience(audience: AudienceConfig): Promise<Contact[]> {
    const supabase = createClient();
    let contacts: Contact[] = [];

    if (audience.type === 'all') {
      const { data, error } = await supabase.from('contacts').select('*');
      if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
      contacts = data ?? [];
    } else if (
      audience.type === 'tags' &&
      audience.tagIds &&
      audience.tagIds.length > 0
    ) {
      const { data: contactTags, error: tagError } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', audience.tagIds);

      if (tagError) throw new Error(`Failed to fetch contact tags: ${tagError.message}`);

      if (contactTags && contactTags.length > 0) {
        const uniqueContactIds = [...new Set(contactTags.map((ct) => ct.contact_id))];
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .in('id', uniqueContactIds);
        if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
        contacts = data ?? [];
      }
    } else if (audience.type === 'custom_field' && audience.customField) {
      contacts = await resolveCustomFieldAudience(supabase, audience.customField);
    } else if (audience.type === 'csv' && audience.csvContacts) {
      contacts = await upsertCsvContacts(supabase, audience.csvContacts);
    }

    // Apply exclude tags
    if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
      const { data: excludeRows } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', audience.excludeTagIds);
      const excludedIds = new Set((excludeRows ?? []).map((r) => r.contact_id));
      contacts = contacts.filter((c) => !excludedIds.has(c.id));
    }

    // ── OPT-OUT FILTER ─────────────────────────────────────────────
    // Remove any contact who has opted out. This is the compliance
    // guard — opted-out contacts are NEVER sent to, regardless of how
    // they ended up in the audience.
    const before = contacts.length;
    contacts = contacts.filter((c) => {
      // The Contact type has opted_out_at after migration 010.
      // Cast via unknown for backwards compat before migration runs.
      const optedOut = (c as unknown as Record<string, unknown>).opted_out_at;
      return !optedOut;
    });
    const skipped = before - contacts.length;
    if (skipped > 0) {
      console.info(`[broadcast] skipped ${skipped} opted-out contact(s)`);
    }
    // We return the skipped count via a closure so the hook can surface it
    return Object.assign(contacts, { _skippedOptOut: skipped });
  }

  async function resolveCustomFieldAudience(
    supabase: ReturnType<typeof createClient>,
    filter: CustomFieldFilter,
  ): Promise<Contact[]> {
    const { fieldId, operator, value } = filter;

    let query = supabase
      .from('contact_custom_values')
      .select('contact_id')
      .eq('custom_field_id', fieldId);

    if (operator === 'is') query = query.eq('value', value);
    else if (operator === 'is_not') query = query.neq('value', value);
    else if (operator === 'contains') query = query.ilike('value', `%${value}%`);

    const { data: matches, error: matchErr } = await query;
    if (matchErr) throw new Error(`Custom-field filter failed: ${matchErr.message}`);

    const contactIds = [...new Set((matches ?? []).map((m) => m.contact_id))];
    if (contactIds.length === 0) return [];

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .in('id', contactIds);
    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
    return data ?? [];
  }

  async function upsertCsvContacts(
    supabase: ReturnType<typeof createClient>,
    csvRows: { phone: string; name?: string }[],
  ): Promise<Contact[]> {
    if (csvRows.length === 0) return [];

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('You are not signed in.');

    const uniqueByPhone = new Map<string, { phone: string; name?: string }>();
    for (const row of csvRows) {
      if (row.phone) uniqueByPhone.set(row.phone, row);
    }
    const phones = [...uniqueByPhone.keys()];

    const { data: existing, error: lookupErr } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .in('phone', phones);
    if (lookupErr) throw new Error(`Failed to look up CSV contacts: ${lookupErr.message}`);

    const byPhone = new Map<string, Contact>();
    for (const c of (existing ?? []) as Contact[]) {
      if (c.phone) byPhone.set(c.phone, c);
    }

    const missing = phones
      .filter((p) => !byPhone.has(p))
      .map((phone) => ({
        user_id: user.id,
        phone,
        name: uniqueByPhone.get(phone)?.name ?? null,
      }));

    const INSERT_CHUNK = 200;
    for (let i = 0; i < missing.length; i += INSERT_CHUNK) {
      const chunk = missing.slice(i, i + INSERT_CHUNK);
      const { data: inserted, error: insertErr } = await supabase
        .from('contacts')
        .insert(chunk)
        .select();
      if (insertErr) throw new Error(`Failed to create CSV contacts: ${insertErr.message}`);
      for (const c of (inserted ?? []) as Contact[]) {
        if (c.phone) byPhone.set(c.phone, c);
      }
    }

    return phones.map((p) => byPhone.get(p)).filter((c): c is Contact => Boolean(c));
  }

  async function createAndSendBroadcast(payload: BroadcastPayload): Promise<string> {
    setIsProcessing(true);
    setProgress(0);
    setSkippedOptOut(0);

    const supabase = createClient();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('You are not signed in.');

      // ── 1. Resolve audience (opt-outs filtered here) ──────────────
      setProgress(5);
      const contacts = await resolveAudience(payload.audience);

      // Surface the skipped count
      const skipped = (contacts as unknown as Record<string, unknown>)._skippedOptOut as number ?? 0;
      setSkippedOptOut(skipped);

      if (contacts.length === 0) {
        throw new Error(
          skipped > 0
            ? `All ${skipped} contacts have opted out of messages. No broadcast sent.`
            : 'No contacts found for this audience.',
        );
      }

      // ── 2. Create broadcast row ───────────────────────────────────
      setProgress(10);
      const { data: broadcast, error: broadcastError } = await supabase
        .from('broadcasts')
        .insert({
          user_id: user.id,
          name: payload.name,
          template_name: payload.template.name,
          template_language: payload.template.language ?? 'en_US',
          template_variables: payload.variables,
          audience_filter: {
            type: payload.audience.type,
            tagIds: payload.audience.tagIds,
            customField: payload.audience.customField,
            excludeTagIds: payload.audience.excludeTagIds,
          },
          status: 'sending',
          total_recipients: contacts.length,
          sent_count: 0,
          delivered_count: 0,
          read_count: 0,
          replied_count: 0,
          failed_count: 0,
        })
        .select()
        .single();

      if (broadcastError || !broadcast) {
        throw new Error(`Failed to create broadcast: ${broadcastError?.message ?? 'unknown'}`);
      }

      // ── 3. Pre-fetch custom values ────────────────────────────────
      setProgress(15);
      const customValueIndex = await fetchCustomValueIndex(
        supabase,
        contacts.map((c) => c.id),
      );

      // ── 4. Insert recipient rows ──────────────────────────────────
      setProgress(20);
      for (let i = 0; i < contacts.length; i += INSERT_BATCH_SIZE) {
        const chunk = contacts.slice(i, i + INSERT_BATCH_SIZE);
        await supabase.from('broadcast_recipients').insert(
          chunk.map((c) => ({
            broadcast_id: broadcast.id,
            contact_id: c.id,
            status: 'pending',
          })),
        );
      }

      // ── 5. Send in paced batches ──────────────────────────────────
      const results: BroadcastApiResult[] = [];
      const sendProgress = (done: number) => {
        setProgress(20 + Math.round((done / contacts.length) * 75));
      };

      for (let i = 0; i < contacts.length; i += SEND_BATCH_SIZE) {
        const batch = contacts.slice(i, i + SEND_BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (contact): Promise<BroadcastApiResult> => {
            const params = resolveVariables(
              payload.variables,
              contact,
              customValueIndex.get(contact.id),
            );
            try {
              const res = await fetch('/api/whatsapp/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  broadcast_id: broadcast.id,
                  recipients: [{ phone: contact.phone, params }],
                  template_name: payload.template.name,
                  template_language: payload.template.language ?? 'en_US',
                }),
              });
              const data = await res.json();
              if (!res.ok) {
                return { phone: contact.phone, status: 'failed', error: data.error };
              }
              return {
                phone: contact.phone,
                status: 'sent',
                whatsapp_message_id: data.results?.[0]?.whatsapp_message_id,
              };
            } catch (err) {
              return {
                phone: contact.phone,
                status: 'failed',
                error: err instanceof Error ? err.message : 'unknown',
              };
            }
          }),
        );

        results.push(...batchResults);
        sendProgress(i + batch.length);

        // Pace: wait between batches (except the last one)
        if (i + SEND_BATCH_SIZE < contacts.length) {
          await sleep(SEND_BATCH_DELAY_MS);
        }
      }

      // ── 6. Mark broadcast sent ────────────────────────────────────
      setProgress(97);
      const sentCount = results.filter((r) => r.status === 'sent').length;
      const failedCount = results.filter((r) => r.status === 'failed').length;

      await supabase
        .from('broadcasts')
        .update({
          status: failedCount === contacts.length ? 'failed' : 'sent',
          sent_count: sentCount,
          failed_count: failedCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', broadcast.id);

      setProgress(100);
      return broadcast.id;
    } finally {
      setIsProcessing(false);
    }
  }

  return { createAndSendBroadcast, isProcessing, progress, skippedOptOut };
}
