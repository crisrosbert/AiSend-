'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Send, Loader2, Users, Save, Clock, Zap, Calendar } from 'lucide-react';
import { useBusiness } from '@/hooks/use-business';
import { AgentPicker, type AgentSelection } from '@/components/broadcasts/agent-picker';

interface AudienceConfig {
  type: string;
  tagIds?: string[];
  csvContacts?: { phone: string; name?: string }[];
}

interface Step4Props {
  name: string;
  onNameChange: (name: string) => void;
  template: MessageTemplate;
  audience: AudienceConfig;
  agentSelection: AgentSelection;
  onAgentSelectionChange: (next: AgentSelection) => void;
  onSend: (scheduledAt?: Date) => void;
  onSaveDraft?: () => void;
  onBack: () => void;
  isProcessing: boolean;
  progress: number;
}

export function Step4ScheduleSend({
  name,
  onNameChange,
  template,
  audience,
  agentSelection,
  onAgentSelectionChange,
  onSend,
  onSaveDraft,
  onBack,
  isProcessing,
  progress,
}: Step4Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const { businessId } = useBusiness();
  const [estimatedReach, setEstimatedReach] = useState<number>(0);
  const [loadingReach, setLoadingReach] = useState(true);

  // Scheduling state
  const [sendMode, setSendMode] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  // Compute min datetime (now + 5 min, in local ISO format)
  const minDatetime = (() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    // Format as "YYYY-MM-DDTHH:MM" for input min
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  // Get default date/time (tomorrow at 9am)
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    setScheduledDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`);
    setScheduledTime('09:00');
  }, []);

  // Validate scheduled time
  useEffect(() => {
    if (sendMode !== 'later' || !scheduledDate || !scheduledTime) {
      setScheduleError('');
      return;
    }
    const chosen = new Date(`${scheduledDate}T${scheduledTime}`);
    const minTime = new Date(Date.now() + 5 * 60 * 1000);
    if (chosen < minTime) {
      setScheduleError('Scheduled time must be at least 5 minutes in the future.');
    } else {
      setScheduleError('');
    }
  }, [sendMode, scheduledDate, scheduledTime]);

  const getScheduledDate = (): Date | undefined => {
    if (sendMode !== 'later' || !scheduledDate || !scheduledTime) return undefined;
    return new Date(`${scheduledDate}T${scheduledTime}`);
  };

  const isScheduleValid = sendMode === 'now' || (!scheduleError && scheduledDate && scheduledTime);

  useEffect(() => {
    async function calculateReach() {
      setLoadingReach(true);
      try {
        const supabase = createClient();

        if (audience.type === 'all') {
          if (!businessId) { setEstimatedReach(0); return; }
          const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .not('phone', 'ilike', 'web%');
          setEstimatedReach(count ?? 0);
        } else if (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) {
          const supabase = createClient();
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.tagIds);
          const uniqueIds = new Set((contactTags ?? []).map((ct) => ct.contact_id));
          setEstimatedReach(uniqueIds.size);
        } else if (audience.type === 'csv' && audience.csvContacts) {
          setEstimatedReach(audience.csvContacts.length);
        } else {
          setEstimatedReach(0);
        }
      } finally {
        setLoadingReach(false);
      }
    }
    calculateReach();
  }, [audience, businessId]);

  const audienceLabel =
    audience.type === 'all'
      ? 'All Contacts'
      : audience.type === 'tags'
        ? `Tags (${audience.tagIds?.length ?? 0} selected)`
        : audience.type === 'csv'
          ? 'CSV Upload'
          : 'Custom';

  // Format scheduled time for display
  const scheduledDisplayTime = (() => {
    const d = getScheduledDate();
    if (!d) return null;
    return d.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  })();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Review & Send</h2>
        <p className="mt-1 text-sm text-slate-400">
          Name your broadcast, review the details, and send.
        </p>
      </div>

      {/* Broadcast Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-white">Broadcast Name</label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Summer Sale Announcement"
          className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Summary Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <p className="text-sm font-medium text-white">Summary</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Template</p>
            <p className="text-white">{template.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Audience</p>
            <p className="text-white">{audienceLabel}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Estimated Reach</p>
            <div className="flex items-center gap-1.5">
              {loadingReach ? (
                <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
              ) : (
                <>
                  <Users className="h-3.5 w-3.5 text-violet-400" />
                  <p className="font-medium text-white">{estimatedReach.toLocaleString()}</p>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400">Language</p>
            <p className="text-white">{template.language ?? 'en_US'}</p>
          </div>
        </div>
      </div>

      {/* Schedule Section */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-white">When to Send</p>

        {/* Toggle buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSendMode('now')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
              sendMode === 'now'
                ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
            }`}
          >
            <Zap className="h-4 w-4" />
            Send Now
          </button>
          <button
            type="button"
            onClick={() => setSendMode('later')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
              sendMode === 'later'
                ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
            }`}
          >
            <Clock className="h-4 w-4" />
            Schedule for Later
          </button>
        </div>

        {/* Date/time picker (shown when 'later' mode) */}
        {sendMode === 'later' && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Calendar className="h-4 w-4 text-violet-400" />
              Pick a date and time to send your broadcast
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Date</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  min={minDatetime.split('T')[0]}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="border-slate-600 bg-slate-700 text-white [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Time</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="border-slate-600 bg-slate-700 text-white [color-scheme:dark]"
                />
              </div>
            </div>

            {scheduleError && (
              <p className="text-xs text-red-400">{scheduleError}</p>
            )}

            {!scheduleError && scheduledDisplayTime && (
              <div className="flex items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Broadcast will be sent on <span className="ml-1 font-medium">{scheduledDisplayTime}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Which AI agent handles replies to this campaign */}
      <AgentPicker value={agentSelection} onChange={onAgentSelectionChange} />

      {/* Processing overlay */}
      {isProcessing && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              <p className="text-sm font-medium text-white">
                {sendMode === 'later' ? 'Scheduling broadcast...' : 'Sending broadcast...'}
              </p>
            </div>
            <span className="text-xs font-medium text-violet-400">{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800">
            <div
              className="h-1.5 rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="border-slate-700 text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={!name.trim() || isProcessing}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save as Draft
            </Button>
          )}

          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
            <DialogTrigger
              render={
                <Button
                  disabled={!name.trim() || isProcessing || !isScheduleValid}
                  className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                />
              }
            >
              {sendMode === 'later' ? (
                <>
                  <Clock className="h-4 w-4" />
                  Schedule Broadcast
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Broadcast
                </>
              )}
            </DialogTrigger>
            <DialogContent className="border-slate-700 bg-slate-900 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {sendMode === 'later' ? 'Confirm Scheduled Broadcast' : 'Confirm Broadcast'}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {sendMode === 'later' ? (
                    <>
                      Your broadcast will be sent to{' '}
                      <span className="font-medium text-white">{estimatedReach.toLocaleString()}</span>{' '}
                      contacts using the{' '}
                      <span className="font-medium text-white">{template.name}</span> template
                      {scheduledDisplayTime && (
                        <> on <span className="font-medium text-white">{scheduledDisplayTime}</span></>
                      )}
                      . You can cancel it from the Broadcasts page before it sends.
                    </>
                  ) : (
                    <>
                      You are about to send this broadcast to{' '}
                      <span className="font-medium text-white">{estimatedReach.toLocaleString()}</span>{' '}
                      contacts using the{' '}
                      <span className="font-medium text-white">{template.name}</span> template.
                      This action cannot be undone.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowConfirm(false);
                    onSend(getScheduledDate());
                  }}
                  className="bg-violet-600 text-white hover:bg-violet-700"
                >
                  {sendMode === 'later' ? (
                    <>
                      <Clock className="h-4 w-4" />
                      Confirm Schedule
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Confirm & Send
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
