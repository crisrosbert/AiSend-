'use client';

// src/components/broadcasts/agent-picker.tsx
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// A broadcast reply opens a 24h WhatsApp service window. Until now,
// whichever reply came in got classified by the general agent router
// (keyword/LLM guessing) — with no way for the merchant to say "replies
// to THIS campaign should go to THIS agent". That guessing is exactly
// what was misrouting plain messages.
//
// This picker lets the merchant choose explicitly, per campaign:
//   - "No AI Agent"      — replies aren't auto-answered by AI at all
//   - "Ecommerce Agent"  — the product/order AI agent (if configured)
//   - one of their own active agents (sales, marketing, support, ...)
//
// Whichever one they pick is stored on the broadcast row itself
// (agent_type + agent_id, migration 033) and the webhook's agent router
// then calls THAT exact agent for replies — see checkBroadcastReply()
// in src/lib/agent-router/router.ts.
//
// Only agents the merchant has actually created/activated show up here
// ("subscribed" — is_active = true on the agents table), so there's no
// dead option in the list that does nothing when picked.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useScopedBusinessId } from '@/hooks/use-business';
import { Bot, Sparkles } from 'lucide-react';

export interface AgentSelection {
  /** null = "No AI Agent" was picked (or nothing picked yet). */
  agentType: string | null;
  /** Specific agents.id — null for "No AI Agent" and for "Ecommerce". */
  agentId: string | null;
}

interface AgentOption {
  id: string;
  name: string;
  agent_type: string;
}

interface AgentPickerProps {
  value: AgentSelection;
  onChange: (next: AgentSelection) => void;
}

export function AgentPicker({ value, onChange }: AgentPickerProps) {
  const businessId = useScopedBusinessId();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [hasEcommerceAgent, setHasEcommerceAgent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || cancelled) { setLoading(false); return; }

      let agentQuery = supabase
        .from('agents')
        .select('id, name, agent_type')
        .eq('tenant_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (businessId) agentQuery = agentQuery.eq('business_id', businessId);

      const [{ data: agentRows }, { data: ecommerceConfig }] = await Promise.all([
        agentQuery,
        supabase
          .from('ai_agent_configs')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setAgents(agentRows ?? []);
      setHasEcommerceAgent(!!ecommerceConfig);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [businessId]);

  // Encode the current selection as a single <select> value.
  const selectValue = !value.agentType
    ? 'none'
    : value.agentType === 'ecommerce'
      ? 'ecommerce'
      : `agent:${value.agentId ?? ''}`;

  function handleChange(raw: string) {
    if (raw === 'none') {
      onChange({ agentType: null, agentId: null });
    } else if (raw === 'ecommerce') {
      onChange({ agentType: 'ecommerce', agentId: null });
    } else if (raw.startsWith('agent:')) {
      const id = raw.slice('agent:'.length);
      const picked = agents.find((a) => a.id === id);
      if (picked) onChange({ agentType: picked.agent_type, agentId: picked.id });
    }
  }

  const nothingToPick = !loading && agents.length === 0 && !hasEcommerceAgent;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-violet-400" />
        <label className="text-sm font-medium text-white">Who replies to this campaign?</label>
      </div>
      <p className="text-xs text-slate-400">
        Pick which AI agent handles replies from people who message back after this broadcast.
        Only your active, subscribed agents show up here.
      </p>

      {nothingToPick ? (
        <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-500">
          You don&apos;t have any active AI agents yet — replies won&apos;t be auto-answered.{' '}
          <a href="/agents" className="text-violet-400 hover:underline">Create one</a> to enable this.
        </p>
      ) : (
        <select
          value={selectValue}
          disabled={loading}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          aria-label="Agent that replies to this broadcast"
        >
          <option value="none">No AI Agent — I&apos;ll reply manually</option>
          {hasEcommerceAgent && (
            <option value="ecommerce">Ecommerce Agent — products, cart, orders</option>
          )}
          {agents.map((a) => (
            <option key={a.id} value={`agent:${a.id}`}>
              {a.name} ({a.agent_type})
            </option>
          ))}
        </select>
      )}

      {value.agentType && (
        <p className="flex items-center gap-1.5 text-xs text-violet-400">
          <Sparkles className="h-3 w-3" />
          Replies to this campaign will be answered by{' '}
          {value.agentType === 'ecommerce'
            ? 'the Ecommerce Agent'
            : agents.find((a) => a.id === value.agentId)?.name ?? 'this agent'}.
        </p>
      )}
    </div>
  );
}
