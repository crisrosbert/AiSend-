'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Settings, MessageSquare, Tag, User, Zap } from 'lucide-react';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { BusinessProfile } from '@/components/settings/business-profile';
import { ConnectWhatsApp } from '@/components/settings/connect-whatsapp';
import { TemplateManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';
import CannedRepliesPage from './canned-replies/page';

const TAB_VALUES = ['profile', 'whatsapp', 'templates', 'tags', 'canned-replies'] as const;
type TabValue = (typeof TAB_VALUES)[number];

const TABS: { value: TabValue; label: string; icon: typeof User }[] = [
  { value: 'profile',        label: 'Profile',        icon: User },
  { value: 'whatsapp',       label: 'WhatsApp',       icon: Settings },
  { value: 'templates',      label: 'Templates',      icon: MessageSquare },
  { value: 'tags',           label: 'Tags',           icon: Tag },
  { value: 'canned-replies', label: 'Quick Replies',  icon: Zap },
];

function isTabValue(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

function SettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get('tab');
  const tab: TabValue = isTabValue(queryTab) ? queryTab : 'profile';

  const onChange = (next: TabValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your profile, WhatsApp integration, message templates, tags, and quick replies.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-[#e7ece9] bg-white p-1.5 shadow-sm">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => onChange(t.value)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                active
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* All tabs stay mounted — only hidden/shown via CSS to preserve state */}
      <div className={tab === 'profile' ? 'block' : 'hidden'}>
        <div className="space-y-6">
          <ProfileForm />
          <PasswordForm />
          <SessionsCard />
        </div>
      </div>

      <div className={tab === 'whatsapp' ? 'block' : 'hidden'}>
        <div className="space-y-6">
          <ConnectWhatsApp />
          <WhatsAppConfig />
          <BusinessProfile />
        </div>
      </div>

      <div className={tab === 'templates' ? 'block' : 'hidden'}>
        <TemplateManager />
      </div>

      <div className={tab === 'tags' ? 'block' : 'hidden'}>
        <TagManager />
      </div>

      <div className={tab === 'canned-replies' ? 'block' : 'hidden'}>
        <CannedRepliesPage />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-slate-400">Loading…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
