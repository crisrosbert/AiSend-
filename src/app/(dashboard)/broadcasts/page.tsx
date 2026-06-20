'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { MessageTemplate } from '@/types';
import { Step1ChooseTemplate } from '@/components/broadcasts/step1-choose-template';
import { Step2SelectAudience } from '@/components/broadcasts/step2-select-audience';
import { Step3Personalize } from '@/components/broadcasts/step3-personalize';
import { Step4ScheduleSend } from '@/components/broadcasts/step4-schedule-send';
import { useBroadcastSending } from '@/hooks/use-broadcast-sending';
import { Check, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  { label: 'Template', key: 'template' },
  { label: 'Audience', key: 'audience' },
  { label: 'Personalize', key: 'personalize' },
  { label: 'Send', key: 'send' },
] as const;

type AudienceState = {
  type: 'all' | 'tags' | 'custom_field' | 'csv';
  tagIds?: string[];
  customField?: {
    fieldId: string;
    operator: 'is' | 'is_not' | 'contains';
    value: string;
  };
  csvContacts?: { phone: string; name?: string }[];
  excludeTagIds?: string[];
};

type VariableState = Record<string, { type: 'static' | 'field' | 'custom_field'; value: string }>;

/** Debounce delay for auto-save (ms). */
const AUTO_SAVE_DELAY = 1500;

export default function NewBroadcastPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createAndSendBroadcast, isProcessing, progress } = useBroadcastSending();

  const [currentStep, setCurrentStep] = useState(0);
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [audience, setAudience] = useState<AudienceState>({ type: 'all' });
  const [variables, setVariables] = useState<VariableState>({});
  const [name, setName] = useState('');

  // Draft tracking
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Load existing draft on mount (resume flow) ─────────────────────
  useEffect(() => {
    const resumeId = searchParams.get('draft');
    if (!resumeId) return;

    setIsLoadingDraft(true);
    const supabase = createClient();

    supabase
      .from('broadcasts')
      .select('*')
      .eq('id', resumeId)
      .eq('status', 'draft')
      .single()
      .then(({ data, error }) => {
        if (!isMounted.current) return;
        setIsLoadingDraft(false);

        if (error || !data) {
          toast.error('Draft not found or already sent.');
          return;
        }

        // Rehydrate wizard state from stored fields
        setDraftId(data.id);
        setName(data.name ?? '');

        const af = data.audience_filter as Record<string, unknown> ?? {};
        const storedTemplate = af._template as MessageTemplate | null;
        const storedStep = typeof af._current_step === 'number' ? af._current_step : 0;

        if (storedTemplate) setTemplate(storedTemplate);

        setAudience({
          type: (af.type as AudienceState['type']) ?? 'all',
          tagIds: af.tagIds as string[] | undefined,
          customField: af.customField as AudienceState['customField'],
          csvContacts: af.csvContacts as AudienceState['csvContacts'],
          excludeTagIds: af.excludeTagIds as string[] | undefined,
        });

        setVariables((data.template_variables as VariableState) ?? {});
        setCurrentStep(storedStep);

        toast.success('Draft resumed', {
          description: `"${data.name}" — pick up where you left off.`,
        });
      });
  }, [searchParams]);

  // ── Save draft (create or update) ─────────────────────────────────
  const saveDraft = useCallback(
    async (opts?: { showToast?: boolean; nameOverride?: string }) => {
      const draftName = opts?.nameOverride ?? name;
      // Need at least a name to save meaningfully
      if (!draftName.trim()) return null;

      if (isSavingDraft) return draftId;
      setIsSavingDraft(true);

      try {
        const res = await fetch('/api/broadcasts/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: draftId ?? undefined,
            name: draftName,
            template,
            audience,
            variables,
            current_step: currentStep,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Save failed');

        if (isMounted.current) {
          setDraftId(data.id);
          setLastSaved(new Date());
          if (opts?.showToast) {
            toast.success('Draft saved', {
              description: 'You can resume this broadcast anytime.',
            });
          }
        }
        return data.id as string;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save draft';
        if (isMounted.current && opts?.showToast) toast.error(msg);
        return null;
      } finally {
        if (isMounted.current) setIsSavingDraft(false);
      }
    },
    [draftId, name, template, audience, variables, currentStep, isSavingDraft],
  );

  // ── Auto-save whenever wizard state changes ────────────────────────
  useEffect(() => {
    if (!name.trim()) return; // nothing worth saving yet
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft();
    }, AUTO_SAVE_DELAY);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, template, audience, variables, currentStep]);

  // ── Step navigation: save before advancing ─────────────────────────
  async function goToStep(next: number) {
    if (name.trim()) await saveDraft();
    setCurrentStep(next);
  }

  // ── Send ───────────────────────────────────────────────────────────
  async function handleSend() {
    if (!template) return;
    try {
      const broadcastId = await createAndSendBroadcast({
        name,
        template,
        audience: {
          type: audience.type,
          tagIds: audience.tagIds,
          customField: audience.customField,
          csvContacts: audience.csvContacts,
          excludeTagIds: audience.excludeTagIds,
        },
        variables,
      });

      // Delete the draft row now that it's been sent
      if (draftId) {
        await fetch(`/api/broadcasts/draft?id=${draftId}`, { method: 'DELETE' });
      }

      router.push(`/broadcasts/${broadcastId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Broadcast failed';
      console.error('Broadcast failed:', err);
      toast.error(message);
    }
  }

  // ── Manual save & exit ─────────────────────────────────────────────
  async function handleSaveAndExit() {
    if (!name.trim()) {
      toast.error('Give the broadcast a name before saving.');
      return;
    }
    const id = await saveDraft({ showToast: true });
    if (id) router.push('/broadcasts');
  }

  if (isLoadingDraft) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        <span className="ml-3 text-sm text-slate-400">Loading draft…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {draftId ? 'Resume Broadcast' : 'New Broadcast'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {draftId
              ? 'Your draft has been restored — continue from where you left off.'
              : 'Create and send a broadcast message to your contacts.'}
          </p>
        </div>

        {/* Save draft button — visible at all steps once user has a name */}
        <div className="flex shrink-0 items-center gap-3">
          {lastSaved && (
            <span className="hidden text-xs text-slate-500 sm:block">
              Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAndExit}
            disabled={isSavingDraft || !name.trim()}
            className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            {isSavingDraft ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save draft
          </Button>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Allow clicking back to completed steps
                    if (isCompleted) goToStep(index);
                  }}
                  disabled={!isCompleted}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all ${
                    isCompleted
                      ? 'cursor-pointer bg-violet-500 text-white hover:bg-violet-600'
                      : isActive
                        ? 'border-2 border-violet-500 bg-violet-500/10 text-violet-400'
                        : 'border border-slate-700 bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </button>
                <span
                  className={`hidden text-sm font-medium sm:block ${
                    isActive ? 'text-white' : isCompleted ? 'text-violet-400' : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-3 h-px flex-1 ${
                    index < currentStep ? 'bg-violet-500' : 'bg-slate-800'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="relative min-h-[400px]">
        <div
          className="transition-all duration-300 ease-in-out"
          style={{
            opacity: isProcessing ? 0.6 : 1,
            pointerEvents: isProcessing ? 'none' : 'auto',
          }}
        >
          {currentStep === 0 && (
            <Step1ChooseTemplate
              selectedTemplate={template}
              onSelect={setTemplate}
              onNext={() => goToStep(1)}
              onBack={() => router.push('/broadcasts')}
            />
          )}
          {currentStep === 1 && (
            <Step2SelectAudience
              audience={audience}
              onUpdate={setAudience}
              onNext={() => goToStep(2)}
              onBack={() => goToStep(0)}
            />
          )}
          {currentStep === 2 && template && (
            <Step3Personalize
              template={template}
              variables={variables}
              onUpdate={setVariables}
              onNext={() => goToStep(3)}
              onBack={() => goToStep(1)}
            />
          )}
          {currentStep === 3 && template && (
            <Step4ScheduleSend
              name={name}
              onNameChange={(n) => setName(n)}
              template={template}
              audience={audience}
              onSend={handleSend}
              onSaveDraft={handleSaveAndExit}
              onBack={() => goToStep(2)}
              isProcessing={isProcessing}
              progress={progress}
            />
          )}
        </div>
      </div>
    </div>
  );
}
