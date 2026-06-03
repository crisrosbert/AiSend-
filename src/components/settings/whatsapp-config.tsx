'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye, EyeOff, Copy, CheckCircle2, XCircle, Loader2,
  ExternalLink, Zap, AlertTriangle, RotateCcw, ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

export function WhatsAppConfig() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchConfig = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) console.error('Failed to load config:', error);

      if (data) {
        setConfig(data);
        setPhoneNumberId(data.phone_number_id || '');
        setWabaId(data.waba_id || '');
        setAccessToken(MASKED_TOKEN);
        setVerifyToken('');
        setTokenEdited(false);

        // Health check
        try {
          const res = await fetch('/api/whatsapp/config', { method: 'GET' });
          const payload = await res.json();
          if (payload.connected) {
            setConnectionStatus('connected');
            setResetReason(null);
            setStatusMessage('');
          } else {
            setConnectionStatus('disconnected');
            setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
            setStatusMessage(payload.message || '');
          }
        } catch {
          setConnectionStatus('disconnected');
        }
      } else {
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setTokenEdited(false);
        setConnectionStatus('disconnected');
        setResetReason(null);
        setStatusMessage('');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetchConfig(user.id);
  }, [authLoading, user, fetchConfig]);

  async function handleSave() {
    if (!phoneNumberId.trim()) { toast.error('Phone Number ID is required'); return; }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error('Access Token is required for initial setup');
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        toast.error('Please re-enter your Access Token to save changes');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to save'); setSaving(false); return; }

      toast.success(data.phone_info?.verified_name
        ? `Connected to ${data.phone_info.verified_name}`
        : 'Configuration saved successfully');
      if (user) await fetchConfig(user.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();
      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        toast.success(payload.phone_info?.verified_name
          ? `Connected to ${payload.phone_info.verified_name}`
          : 'API connection successful');
      } else {
        setConnectionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch {
      setConnectionStatus('disconnected');
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!confirm('This will delete the current WhatsApp config. Continue?')) return;
    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to reset'); return; }
      toast.success('Configuration cleared. Re-enter your credentials.');
      setConfig(null);
      setPhoneNumberId(''); setWabaId(''); setAccessToken(''); setVerifyToken('');
      setTokenEdited(false); setConnectionStatus('disconnected');
      setResetReason(null); setStatusMessage('');
    } catch { toast.error('Failed to reset'); }
    finally { setResetting(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* LEFT — config form */}
      <div className="space-y-5">

        {/* Corrupted token banner */}
        {resetReason === 'token_corrupted' && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">Stored token can&apos;t be decrypted</p>
              <p className="mt-1 text-xs text-amber-700">{statusMessage}</p>
              <Button onClick={handleReset} disabled={resetting} size="sm"
                className="mt-3 bg-amber-500 hover:bg-amber-600 text-white">
                {resetting ? <><Loader2 className="size-4 animate-spin" /> Resetting…</> : <><RotateCcw className="size-4" /> Reset Config</>}
              </Button>
            </div>
          </div>
        )}

        {/* Connection status */}
        <div className={`flex items-center gap-3 rounded-xl border p-4 ${
          connectionStatus === 'connected'
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-[#e7ece9] bg-white'
        }`}>
          {connectionStatus === 'connected'
            ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            : <XCircle className="size-5 shrink-0 text-slate-400" />}
          <div>
            <p className={`text-sm font-bold ${connectionStatus === 'connected' ? 'text-emerald-800' : 'text-slate-700'}`}>
              {connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
            </p>
            <p className={`text-xs ${connectionStatus === 'connected' ? 'text-emerald-600' : 'text-slate-400'}`}>
              {connectionStatus === 'connected'
                ? 'WhatsApp Business API is live and ready.'
                : statusMessage || 'Enter your Meta API credentials below to connect.'}
            </p>
          </div>
        </div>

        {/* API Credentials card */}
        <div className="rounded-xl border border-[#e7ece9] bg-white shadow-sm">
          <div className="border-b border-[#e7ece9] px-6 py-4">
            <h2 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
              API Credentials
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Enter your Meta WhatsApp Business API credentials.
              {config && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <ShieldCheck className="size-3" /> Saved
                </span>
              )}
            </p>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Phone Number ID</Label>
              <Input
                placeholder="e.g. 100234567890123"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
              />
              {phoneNumberId && !tokenEdited && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Loaded from saved config
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">WhatsApp Business Account ID (WABA ID)</Label>
              <Input
                placeholder="e.g. 100234567890456"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
              />
              {wabaId && !tokenEdited && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Loaded from saved config
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Permanent Access Token</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your access token"
                  value={accessToken}
                  onChange={(e) => { setAccessToken(e.target.value); setTokenEdited(true); }}
                  onFocus={() => {
                    if (accessToken === MASKED_TOKEN) { setAccessToken(''); setTokenEdited(true); }
                  }}
                  className="border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400 pr-10 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                />
                <button type="button" onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {config && !tokenEdited && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <ShieldCheck className="size-3" /> Token saved securely — re-enter only if changing it
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Webhook Verify Token</Label>
              <Input
                placeholder="Your custom verify token (e.g. clickstream2026)"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="border-[#e7ece9] bg-white text-[#0c1f17] placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
              />
              <p className="text-[11px] text-slate-400">Must match what you set in Meta webhook settings.</p>
            </div>
          </div>
        </div>

        {/* Webhook URL card */}
        <div className="rounded-xl border border-[#e7ece9] bg-white shadow-sm">
          <div className="border-b border-[#e7ece9] px-6 py-4">
            <h2 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
              Webhook URL
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Paste this in Meta App Dashboard → Webhooks.</p>
          </div>
          <div className="px-6 py-5">
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl}
                className="border-[#e7ece9] bg-[#f8faf9] font-mono text-xs text-slate-600" />
              <Button variant="outline" size="icon"
                onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Webhook URL copied!'); }}
                className="shrink-0 border-[#e7ece9] text-slate-500 hover:bg-slate-50">
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSave} disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white">
            {saving ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : 'Save Configuration'}
          </Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={testing || !config}
            className="border-[#e7ece9] text-slate-600 hover:bg-slate-50">
            {testing ? <><Loader2 className="size-4 animate-spin" /> Testing…</> : <><Zap className="size-4" /> Test Connection</>}
          </Button>
          {config && (
            <Button variant="outline" onClick={handleReset} disabled={resetting}
              className="border-red-200 text-red-500 hover:bg-red-50">
              {resetting ? <><Loader2 className="size-4 animate-spin" /> Resetting…</> : <><RotateCcw className="size-4" /> Reset Config</>}
            </Button>
          )}
        </div>
      </div>

      {/* RIGHT — setup instructions */}
      <div className="rounded-xl border border-[#e7ece9] bg-white shadow-sm">
        <div className="border-b border-[#e7ece9] px-5 py-4">
          <h2 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
            Setup Instructions
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Connect your WhatsApp Business number step by step.</p>
        </div>
        <div className="px-5 py-4">
          <Accordion>
            {[
              { n: 1, title: 'Create a Meta App', steps: ['Go to developers.facebook.com', 'Click "My Apps" → "Create App"', 'Select "Business" as app type', 'Fill in details and create'] },
              { n: 2, title: 'Add WhatsApp Product', steps: ['In app dashboard click "Add Product"', 'Find "WhatsApp" and click "Set Up"', 'Follow wizard to link your business'] },
              { n: 3, title: 'Add your real number', steps: ['Go to WhatsApp → API Setup', 'Click "Add phone number"', 'Enter your business mobile number', 'Verify via OTP (number must NOT be on WhatsApp app)', 'Copy the new Phone Number ID'] },
              { n: 4, title: 'Get permanent token', steps: ['Go to Business Settings → System Users', 'Create a System User', 'Generate token with whatsapp_business_messaging permission', 'Copy it — this never expires'] },
              { n: 5, title: 'Configure webhook', steps: ['Go to WhatsApp → Configuration', 'Click "Edit" on Webhook section', 'Paste the Webhook URL from left', 'Enter the same Verify Token', 'Subscribe to "messages" field'] },
            ].map((s) => (
              <AccordionItem key={s.n} className="border-[#e7ece9]">
                <AccordionTrigger className="text-slate-700 hover:text-emerald-700 hover:no-underline text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                      {s.n}
                    </span>
                    {s.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-slate-500 ml-7">
                    {s.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-4 border-t border-[#e7ece9] pt-4">
            <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800">
              <ExternalLink className="size-3.5" /> Meta WhatsApp Cloud API Docs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
