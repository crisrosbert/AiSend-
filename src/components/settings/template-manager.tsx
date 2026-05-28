'use client';
import { TemplateLibrary } from './template-library';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, RefreshCw } from 'lucide-react';
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

interface TemplateFormData {
  name: string;
  category: MessageTemplate['category'];
  language: string;
  body_text: string;
  header_type: string;
  footer_text: string;
}

const emptyForm: TemplateFormData = {
  name: '', category: 'Marketing', language: 'en_US',
  body_text: '', header_type: '', footer_text: '',
};

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

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Template name is required'); return; }
    if (!form.body_text.trim()) { toast.error('Body text is required'); return; }
    try {
      setSaving(true);
      if (!user) { toast.error('Not authenticated'); return; }
      const payload = {
        user_id: user.id,
        name: form.name.trim(),
        category: form.category,
        language: form.language.trim() || 'en_US',
        body_text: form.body_text.trim(),
        header_type: form.header_type || null,
        footer_text: form.footer_text.trim() || null,
        status: 'Draft' as const,
      };
      const { error } = await supabase.from('message_templates').insert(payload);
      if (error) throw error;
      toast.success('Template created successfully');
      setDialogOpen(false);
      setForm(emptyForm);
      if (user) await fetchTemplates(user.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to create template');
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
            onClick={() => { setForm(emptyForm); setDialogOpen(true); }}
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
        <DialogContent className="bg-white border-[#e7ece9] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#0c1f17]">New Message Template</DialogTitle>
            <DialogDescription className="text-slate-500">
              Create a new WhatsApp message template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
                onValueChange={(val) => setForm({ ...form, header_type: val === 'none' ? '' : val })}
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
          </div>

          <DialogFooter className="bg-white">
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
              {saving ? (<><Loader2 className="size-4 animate-spin" />Creating...</>) : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
