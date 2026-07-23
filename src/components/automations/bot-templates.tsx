'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, ArrowRight, Check } from 'lucide-react';

/**
 * Bot Templates — pre-built, runnable automation flows.
 * Clicking "Use this Template" POSTs to /api/automations which creates
 * a real automation + steps in the database. The existing engine runs it.
 *
 * Step types used (all supported by the engine):
 *   - send_message  { text }
 *   - wait          { amount, unit }
 * Trigger: keyword_match { keywords[], match_type }
 */

interface BotTemplate {
  id: string;
  title: string;
  badge: string;
  badgeClass: string;
  subtitle: string;
  stat: string;
  desc: string;
  tags: string[];
  features: { icon: string; label: string }[];
  // The actual flow that gets created:
  trigger_keywords: string[];
  steps: { step_type: string; step_config: Record<string, unknown> }[];
}

const BADGE_STYLES: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-700',
  teal: 'bg-emerald-100 text-emerald-700',
  gray: 'bg-slate-100 text-slate-600',
  orange: 'bg-orange-100 text-orange-700',
  green: 'bg-green-100 text-green-700',
};

const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: 'order-tracking',
    title: 'Order Tracking Bot',
    badge: 'Assistant', badgeClass: 'teal',
    subtitle: 'Increases customer satisfaction',
    stat: '55%',
    desc: 'Auto-reply when a customer asks about their order status.',
    tags: ['E-commerce', 'Order', 'Tracking'],
    features: [{ icon: '📍', label: 'Live Tracking' }, { icon: '✔️', label: 'Reliable' }, { icon: '⚡', label: 'Quick Reply' }],
    trigger_keywords: ['track', 'order', 'status', 'where is my order'],
    steps: [
      { step_type: 'send_message', step_config: { text: 'Hi! 📦 I can help you track your order. Please share your Order ID and I will fetch the latest status for you.' } },
      { step_type: 'wait', step_config: { amount: 1, unit: 'minutes' } },
      { step_type: 'send_message', step_config: { text: 'Thank you! Our team is checking your order and will update you shortly. For urgent help, reply AGENT to talk to a human.' } },
    ],
  },
  {
    id: 'tech-support',
    title: 'Tech Support Assistant',
    badge: 'Support', badgeClass: 'gray',
    subtitle: 'Faster issue resolution',
    stat: '45%',
    desc: 'Greets customers with a support query and offers quick options.',
    tags: ['IT Support', 'Help Desk'],
    features: [{ icon: '🎧', label: 'Live Support' }, { icon: '🐛', label: 'Report Issue' }, { icon: '⚡', label: 'Quick Fix' }],
    trigger_keywords: ['help', 'support', 'issue', 'problem', 'not working'],
    steps: [
      { step_type: 'send_message', step_config: { text: 'Hi! 🎧 Sorry to hear you are facing an issue. Please describe the problem in a few words and our support team will assist you.' } },
      { step_type: 'wait', step_config: { amount: 2, unit: 'minutes' } },
      { step_type: 'send_message', step_config: { text: 'Our team has received your request and will get back to you soon. Reply AGENT anytime to speak with a person.' } },
    ],
  },
  {
    id: 'real-estate',
    title: 'Real Estate Helper',
    badge: 'High Impact', badgeClass: 'purple',
    subtitle: 'Improve buyer engagement',
    stat: '45%',
    desc: 'Helps property buyers with search and scheduling a callback.',
    tags: ['Property', 'Real Estate'],
    features: [{ icon: '🏠', label: 'Property Search' }, { icon: '📋', label: 'Shortlist' }, { icon: '📞', label: 'Callback' }],
    trigger_keywords: ['property', 'flat', 'house', 'buy', 'rent'],
    steps: [
      { step_type: 'send_message', step_config: { text: 'Hello! 🏡 Looking for a property? Tell me your preferred location and budget, and I will share matching options.' } },
      { step_type: 'wait', step_config: { amount: 1, unit: 'minutes' } },
      { step_type: 'send_message', step_config: { text: 'Great! Our property expert will reach out shortly with the best matches for you.' } },
    ],
  },
  {
    id: 'appointment-booking',
    title: 'Appointment Booking',
    badge: 'Essential', badgeClass: 'gray',
    subtitle: 'Reduce no-shows',
    stat: '40%',
    desc: 'Lets customers request an appointment via WhatsApp.',
    tags: ['Healthcare', 'Salon', 'Clinic'],
    features: [{ icon: '📅', label: 'Book Slot' }, { icon: '⏰', label: 'Reminders' }, { icon: '✅', label: 'Confirm' }],
    trigger_keywords: ['appointment', 'book', 'booking', 'slot', 'schedule'],
    steps: [
      { step_type: 'send_message', step_config: { text: 'Hi! 📅 I can help you book an appointment. Please share your preferred date and time.' } },
      { step_type: 'wait', step_config: { amount: 1, unit: 'minutes' } },
      { step_type: 'send_message', step_config: { text: 'Thank you! Your request is received. We will confirm your appointment shortly. ✅' } },
    ],
  },
  {
    id: 'lead-capture',
    title: 'Lead Capture Bot',
    badge: 'Sales', badgeClass: 'purple',
    subtitle: 'Capture leads automatically',
    stat: '50%',
    desc: 'Welcomes new enquiries and collects their interest.',
    tags: ['Sales', 'Leads', 'Marketing'],
    features: [{ icon: '🎯', label: 'Qualify' }, { icon: '📝', label: 'Collect Info' }, { icon: '🚀', label: 'Follow up' }],
    trigger_keywords: ['interested', 'price', 'enquiry', 'quote', 'info'],
    steps: [
      { step_type: 'send_message', step_config: { text: 'Hi! 👋 Thanks for your interest. May I know which product or service you are looking for?' } },
      { step_type: 'wait', step_config: { amount: 1, unit: 'minutes' } },
      { step_type: 'send_message', step_config: { text: 'Perfect! Our team will share all details and the best offer with you shortly. 🚀' } },
    ],
  },
  {
    id: 'welcome-greeting',
    title: 'Welcome Greeting',
    badge: 'Daily', badgeClass: 'green',
    subtitle: 'Instant first response',
    stat: '60%',
    desc: 'Auto-greets anyone who messages your business for the first time.',
    tags: ['General', 'Greeting'],
    features: [{ icon: '👋', label: 'Auto Greet' }, { icon: '⚡', label: 'Instant' }, { icon: '💬', label: 'Engage' }],
    trigger_keywords: ['hi', 'hello', 'hey', 'namaste', 'start'],
    steps: [
      { step_type: 'send_message', step_config: { text: 'Hello! 👋 Welcome to our business. How can we help you today? Reply with your question and we will assist you right away.' } },
    ],
  },
];

export function BotTemplates({ onCreated }: { onCreated?: () => void }) {
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set());

  const applyTemplate = async (tpl: BotTemplate) => {
    setCreatingId(tpl.id);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tpl.title,
          description: tpl.desc,
          trigger_type: 'keyword_match',
          trigger_config: { keywords: tpl.trigger_keywords, match_type: 'contains' },
          is_active: false, // user activates after reviewing
          steps: tpl.steps,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create flow');

      setCreatedIds((prev) => new Set(prev).add(tpl.id));
      toast.success(`"${tpl.title}" flow created`, {
        description: 'Find it above in your automations. Activate it when ready.',
      });
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create flow');
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="mt-10 space-y-5">
      {/* Section header */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900" style={{ fontFamily: 'var(--font-display)' }}>
              Bot Flow Templates
            </h3>
            <p className="mt-1 text-xs text-emerald-700">
              Pre-built automation flows. Click &quot;Use this Template&quot; to create a real, working
              flow in your account — then activate it from your automations above.
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BOT_TEMPLATES.map((tpl) => {
          const created = createdIds.has(tpl.id);
          return (
            <div
              key={tpl.id}
              className="flex flex-col rounded-2xl border border-[#e7ece9] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <h4 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
                  {tpl.title}
                </h4>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${BADGE_STYLES[tpl.badgeClass]}`}>
                  {tpl.badge}
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-500">{tpl.subtitle}</p>

              <div className="mb-2 flex items-center gap-2">
                <span className="text-2xl font-extrabold text-emerald-600" style={{ fontFamily: 'var(--font-display)' }}>
                  {tpl.stat}
                </span>
                <span className="text-xs font-semibold text-emerald-600">↗ {tpl.subtitle}</span>
              </div>

              <p className="mb-3 text-xs text-slate-500">{tpl.desc}</p>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {tpl.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-[#e7ece9] bg-[#f0f4f8] px-2.5 py-0.5 text-[11px] text-slate-500">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="my-3 border-t border-[#e7ece9]" />

              <div className="mb-4 flex gap-4">
                {tpl.features.map((f) => (
                  <div key={f.label} className="flex flex-col items-center gap-1.5 text-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-base">
                      {f.icon}
                    </div>
                    <span className="text-[11px] text-slate-500">{f.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto">
                <p className="mb-2 text-[10px] text-slate-400">
                  Triggers on: {tpl.trigger_keywords.slice(0, 3).join(', ')}…
                </p>
                <button
                  onClick={() => applyTemplate(tpl)}
                  disabled={creatingId === tpl.id || created}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                    created
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                >
                  {creatingId === tpl.id ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  ) : created ? (
                    <><Check className="h-4 w-4" /> Flow Created</>
                  ) : (
                    <>Use this Template <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
