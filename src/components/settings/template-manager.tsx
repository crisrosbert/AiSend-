'use client';
import { TemplateLibrary } from './template-library';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, RefreshCw, Link2, Upload, Phone, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { MessageTemplate } from '@/types';

const CATEGORIES = ['Marketing', 'Utility', 'Authentication'] as const;
const HEADER_TYPES = ['text', 'image', 'video', 'document'] as const;

const categoryColors: Record<string, string> = {
  Marketing: 'bg-purple-50 text-purple-700 border-purple-200',
  Utility: 'bg-blue-50 text-blue-700 border-blue-200',
  Authentication: 'bg-amber-50 text-amber-700 border-amber-200',
};

const statusColors: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
};

interface TemplateButtonForm {
  type: 'url' | 'phone';
  text: string;
  value: string;
}

interface TemplateFormData {
  name: string;
  category: MessageTemplate['category'];
  language: string;
  body_text: string;
  header_type: string;
  header_content: string;
  footer_text: string;
  buttons: TemplateButtonForm[];
}

const emptyForm: TemplateFormData = {
  name: '', category: 'Marketing', language: 'en_US',
  body_text: '', header_type: '', header_content: '', footer_text: '',
  buttons: [],
};

const URL_BUTTON_LIMIT = 2;
const PHONE_BUTTON_LIMIT = 1;

const COMMON_LANGUAGE_CODES = [
  'en_US', 'en_GB', 'en', 'hi', 'es', 'es_ES', 'es_MX', 'fr', 'fr_FR',
  'de', 'it', 'pt_BR', 'pt_PT', 'nl', 'pl', 'ru', 'tr', 'lt',
];

export function TemplateManager() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState<TemplateFormData>(emptyForm);
  const [mediaMode, setMediaMode] = useState<'link' | 'upload'>('link');
  const [mediaUploading, setMediaUploading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetchTemplates(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function fetchTemplates(userId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  async function handleMediaUpload(file: File) {
    if (!user) return;
    const isImage = form.header_type === 'image';
    if (isImage && !file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    if (!isImage && !file.type.startsWith('video/')) {
      toast.error('Choose a video file.');
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 16 MB.`);
      return;
    }
    setMediaUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || (isImage ? 'jpg' : 'mp4');
      const path = `${user.id}/template-header-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
      if (upErr) { toast.error(`Upload failed: ${upErr.message}`); return; }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setForm((f) => ({ ...f, header_content: publicUrl }));
      toast.success('Uploaded — this is the sample Meta will review');
    } finally {
      setMediaUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Template name is required'); return; }
    if (!form.body_text.trim()) { toast.error('Body text is required'); return; }
    if ((form.header_type === 'image' || form.header_type === 'video') && !form.header_content.trim()) {
      toast.error(`Add ${form.header_type === 'image' ? 'an image' : 'a video'} for the header, or set Header Type to None.`);
      return;
    }
    for (const btn of form.buttons) {
      const value = btn.value.trim();
      if (!btn.text.trim() || !value) continue;
      if (btn.type === 'phone' && !value.startsWith('+')) {
        toast.error(`"${btn.text}" button needs the country code too, e.g. +919876543210 — not just ${value}.`);
        return;
      }
      if (btn.type === 'url' && !/^https?:\/\/.+/i.test(value)) {
        toast.error(`"${btn.text}" button needs a full https:// link.`);
        return;
      }
    }
    try {
      setSaving(true);
      if (!user) { toast.error('Not authenticated'); return; }

      // Submit to Meta for approval via the create route. This both
      // POSTs to Meta AND mirrors the row locally with
      // status Pending. The old behavior (Supabase-only insert) created
      // templates Meta never saw, which then failed on send with #132001.
      const res = await fetch('/api/whatsapp/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          language: form.language.trim() || 'en_US',
          body_text: form.body_text.trim(),
          header_type: form.header_type || undefined,
          header_text: form.header_type === 'text' ? form.header_content?.trim() || undefined : undefined,
          header_media_url:
            form.header_type === 'image' || form.header_type === 'video'
              ? form.header_content?.trim() || undefined
              : undefined,
          footer_text: form.footer_text.trim() || undefined,
          buttons: form.buttons
            .filter((b) => b.text.trim() && b.value.trim())
            .map((b) => ({ type: b.type, text: b.text.trim(), value: b.value.trim() })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Submit failed (HTTP ${res.status})`);
      }

      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success('Template submitted to Meta for approval');
      }
      setDialogOpen(false);
      setForm(emptyForm);
      setMediaMode('link');
      await fetchTemplates(user.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to submit template');
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncFromMeta() {
    if (!user) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Sync failed (HTTP ${res.status})`);
      toast.success(
        `Synced ${data.total} template${data.total === 1 ? '' : 's'} from Meta` +
          (data.inserted || data.updated ? ` (${data.inserted} new, ${data.updated} updated)` : ''),
      );
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const preview = data.errors.slice(0, 3).map(
          (e: { name: string; language: string; message: string }) => `${e.name} (${e.language})`,
        );
        const suffix = data.errors.length > 3 ? `, +${data.errors.length - 3} more` : '';
        toast.error(`Failed to sync: ${preview.join(', ')}${suffix}`);
      }
      if (data.truncated) {
        toast.warning('Hit Meta pagination cap — more templates may exist.');
      }
      await fetchTemplates(user.id);
    } catch (err) {
      console.error('Template sync error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to sync templates');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('message_templates').delete().eq('id', id);
      if (error) throw error;
      toast.success('Template deleted');
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete template');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* PRE-BUILT TEMPLATE LIBRARY */}
      <TemplateLibrary onUsed={() => { if (user) fetchTemplates(user.id); }} />

      {/* DIVIDER */}
      <div className="border-t border-[#e7ece9]" />

      {/* YOUR TEMPLATES */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
            Your Message Templates
          </h2>
          <p className="text-sm text-slate-500">
            Meta requires every template to be approved in WhatsApp Manager before it can be
            sent — use &quot;Sync from Meta&quot; to pull your approved list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncFromMeta}
            disabled={syncing}
            className="border-[#e7ece9] bg-white text-slate-600 hover:bg-slate-50"
            title="Pull approved templates from your Meta WhatsApp Business Account"
          >
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from Meta'}
          </Button>
          <Button
            onClick={() => { setForm(emptyForm); setMediaMode('link'); setDialogOpen(true); }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Plus className="size-4" />
            New Template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card className="bg-white border-[#e7ece9]">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-slate-500 text-sm">No templates yet.</p>
            <p className="text-slate-400 text-xs mt-1">Use a template from the library above or create your own.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((template) => (
            <Card key={template.id} className="bg-white border-[#e7ece9]">
              <CardContent className="flex items-start justify-between pt-4">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-[#0c1f17]">{template.name}</h3>
                    <Badge className={`text-xs border ${categoryColors[template.category] || ''}`}>
                      {template.category}
                    </Badge>
                    <Badge className={`text-xs border ${statusColors[template.status || 'Draft'] || ''}`}>
                      {template.status || 'Draft'}
                    </Badge>
                    {template.language && (
                      <span className="text-xs text-slate-400 uppercase">{template.language}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2 whitespace-pre-line">{template.body_text}</p>
                  {template.footer_text && (
                    <p className="text-xs text-slate-400 italic">{template.footer_text}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(template.id)}
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0 ml-2"
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden bg-white border-[#e7ece9] p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-[#e7ece9] px-4 pt-4 pb-3">
            <DialogTitle className="text-[#0c1f17]">New Message Template</DialogTitle>
            <DialogDescription className="text-slate-500">
              Create a new WhatsApp message template.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
            <div className="space-y-2">
              <Label className="text-slate-700">Template Name</Label>
              <Input
                placeholder="e.g. order_confirmation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-white border-[#e7ece9] text-[#0c1f17] placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm({ ...form, category: val as MessageTemplate['category'] })}
                >
                  <SelectTrigger className="w-full bg-white border-[#e7ece9] text-[#0c1f17]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#e7ece9]">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-[#0c1f17] focus:bg-slate-100">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">Language</Label>
                <Input
                  list="template-language-codes"
                  placeholder="en_US"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="bg-white border-[#e7ece9] text-[#0c1f17] placeholder:text-slate-400"
                />
                <datalist id="template-language-codes">
                  {COMMON_LANGUAGE_CODES.map((code) => (<option key={code} value={code} />))}
                </datalist>
                <p className="text-[11px] text-slate-400">
                  Must match the exact code the template is approved under on Meta — e.g.{' '}
                  <code>en_US</code> and <code>hi</code> are distinct.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Header Type</Label>
              <Select
                value={form.header_type}
          onValueChange={(val) => setForm({ ...form, header_type: val && val !== 'none' ? val : '' })}
              >
                <SelectTrigger className="w-full bg-white border-[#e7ece9] text-[#0c1f17]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#e7ece9]">
                  <SelectItem value="none" className="text-[#0c1f17] focus:bg-slate-100">None</SelectItem>
                  {HEADER_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="text-[#0c1f17] focus:bg-slate-100">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.header_type === 'text' && (
              <div className="space-y-2">
                <Label className="text-slate-700">Header Text</Label>
                <Input
                  placeholder="Header text (shown bold at top)"
                  value={form.header_content}
                  onChange={(e) => setForm({ ...form, header_content: e.target.value })}
                  className="bg-white border-[#e7ece9] text-[#0c1f17] placeholder:text-slate-400"
                />
              </div>
            )}

            {(form.header_type === 'image' || form.header_type === 'video') && (
              <div className="space-y-2">
                <Label className="text-slate-700">
                  Header {form.header_type === 'image' ? 'Image' : 'Video'}
                </Label>
                <div className="inline-flex rounded-lg border border-[#e7ece9] bg-[#f8faf9] p-0.5">
                  <button
                    type="button"
                    onClick={() => setMediaMode('link')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      mediaMode === 'link' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-[#0c1f17]'
                    }`}
                  >
                    <Link2 className="h-3.5 w-3.5" /> Paste a link
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaMode('upload')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      mediaMode === 'upload' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-[#0c1f17]'
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload a file
                  </button>
                </div>

                {mediaMode === 'link' ? (
                  <Input
                    placeholder={form.header_type === 'image' ? 'https://…/photo.jpg' : 'https://…/clip.mp4'}
                    value={form.header_content}
                    onChange={(e) => setForm({ ...form, header_content: e.target.value })}
                    className="border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400"
                  />
                ) : (
                  <Input
                    type="file"
                    accept={form.header_type === 'image' ? 'image/*' : 'video/*'}
                    disabled={mediaUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void handleMediaUpload(file);
                    }}
                    className="border-[#e7ece9] bg-white text-[#0c1f17]"
                  />
                )}
                {mediaUploading && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> Uploading…
                  </p>
                )}
                {form.header_content && (
                  <p className="text-[11px] text-emerald-600 truncate">✓ {form.header_content}</p>
                )}
                <p className="text-[11px] text-slate-400">
                  This is only the sample Meta reviews the template with — you pick the real{' '}
                  {form.header_type} per contact when you actually send.
                </p>
              </div>
            )}

            {form.header_type === 'document' && (
              <p className="text-[11px] text-amber-600">
                Document headers aren&apos;t supported here yet — create this one from Meta Business Manager instead.
              </p>
            )}

            <div className="space-y-2">
              <Label className="text-slate-700">Body Text</Label>
              <Textarea
                placeholder="Enter your template message body. Use {{1}}, {{2}} for variables."
                value={form.body_text}
                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                rows={4}
                className="bg-white border-[#e7ece9] text-[#0c1f17] placeholder:text-slate-400 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Footer Text</Label>
              <Input
                placeholder="Optional footer text"
                value={form.footer_text}
                onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
                className="bg-white border-[#e7ece9] text-[#0c1f17] placeholder:text-slate-400"
              />
            </div>

            {/* Call-to-action buttons — "Visit Website" / "Call Now",
                the row shown under a template on real WhatsApp business
                messages. Meta allows at most 2 URL + 1 phone button. */}
            <div className="space-y-2">
              <Label className="text-slate-700">Buttons</Label>
              <div className="space-y-2">
                {form.buttons.map((btn, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-[#e7ece9] bg-[#f8faf9] p-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-emerald-600 border border-[#e7ece9]">
                      {btn.type === 'url' ? <ExternalLink className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                    </span>
                    <Input
                      placeholder={btn.type === 'url' ? 'Visit Website' : 'Call Now'}
                      value={btn.text}
                      maxLength={25}
                      onChange={(e) => {
                        const next = [...form.buttons];
                        next[i] = { ...next[i], text: e.target.value };
                        setForm({ ...form, buttons: next });
                      }}
                      className="w-32 shrink-0 border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400"
                    />
                    <Input
                      placeholder={btn.type === 'url' ? 'https://performancemktg.net' : '+919876543210'}
                      value={btn.value}
                      onChange={(e) => {
                        const next = [...form.buttons];
                        next[i] = { ...next[i], value: e.target.value };
                        setForm({ ...form, buttons: next });
                      }}
                      className="border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setForm({ ...form, buttons: form.buttons.filter((_, j) => j !== i) })}
                      className="shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={form.buttons.filter((b) => b.type === 'url').length >= URL_BUTTON_LIMIT}
                  onClick={() => setForm({ ...form, buttons: [...form.buttons, { type: 'url', text: 'Visit Website', value: '' }] })}
                  className="border-[#e7ece9] text-slate-600 hover:bg-[#f8faf9]"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Visit Website
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={form.buttons.filter((b) => b.type === 'phone').length >= PHONE_BUTTON_LIMIT}
                  onClick={() => setForm({ ...form, buttons: [...form.buttons, { type: 'phone', text: 'Call Now', value: '' }] })}
                  className="border-[#e7ece9] text-slate-600 hover:bg-[#f8faf9]"
                >
                  <Phone className="h-3.5 w-3.5" /> Call Now
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                Up to {URL_BUTTON_LIMIT} website buttons and {PHONE_BUTTON_LIMIT} call button — Meta&apos;s limit per template.
                Phone numbers need the country code, e.g. <code>+91…</code>, not just the 10 digits.
              </p>
            </div>

            {/* Live WhatsApp-style preview */}
            <div className="space-y-2">
              <Label className="text-slate-700">Preview</Label>
              <div className="rounded-xl bg-[#e5ddd5] p-4">
                <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 shadow-sm">
                  {form.header_type === 'text' && form.header_content.trim() && (
                    <p className="mb-1 text-sm font-bold text-[#0c1f17] whitespace-pre-line">
                      {form.header_content}
                    </p>
                  )}
                  {form.header_type === 'image' && form.header_content.trim() && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.header_content}
                      alt=""
                      className="mb-1.5 max-h-40 w-full rounded-md object-cover"
                    />
                  )}
                  {form.header_type === 'video' && form.header_content.trim() && (
                    <video
                      src={form.header_content}
                      controls
                      className="mb-1.5 max-h-40 w-full rounded-md bg-black"
                    />
                  )}
                  <p className="text-sm text-[#0c1f17] whitespace-pre-line">
                    {form.body_text.trim() || 'Your message body will appear here…'}
                  </p>
                  {form.footer_text.trim() && (
                    <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">
                      {form.footer_text}
                    </p>
                  )}
                  <span className="mt-1 block text-right text-[10px] text-slate-400">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {form.buttons.filter((b) => b.text.trim()).length > 0 && (
                  <div className="ml-auto max-w-[85%] overflow-hidden rounded-lg bg-white shadow-sm">
                    {form.buttons.filter((b) => b.text.trim()).map((btn, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center gap-1.5 border-t border-[#e7ece9] px-3 py-2 text-sm font-medium text-[#128C7E]"
                      >
                        {btn.type === 'url' ? <ExternalLink className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                        {btn.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Variables like <code>{'{{1}}'}</code> are filled per-contact when you send.
              </p>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t border-[#e7ece9] bg-white px-4 py-3 shadow-[0_-6px_12px_-6px_rgba(12,31,23,0.12)]">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-[#e7ece9] text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {saving ? (<><Loader2 className="size-4 animate-spin" />Submitting…</>) : 'Submit to Meta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
