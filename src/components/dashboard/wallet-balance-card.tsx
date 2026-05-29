'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, Plus, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export function WalletBalanceCard() {
  const { profile } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>('free');
  const [loading, setLoading] = useState(true);
useEffect(() => {
    if (!profile?.org_id) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from('organizations')
          .select('credit_balance, plan_id')
          .eq('id', profile.org_id)
          .maybeSingle();
        if (data) {
          setBalance(Number(data.credit_balance) || 0);
          setPlan(data.plan_id || 'free');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.org_id]);
  return (
    <div className="rounded-2xl border border-[#e7ece9] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Wallet className="h-3.5 w-3.5" /> Conversation Credits
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
              ₹{(balance ?? 0).toFixed(2)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Used to send WhatsApp messages · Plan: <span className="font-semibold capitalize text-slate-700">{plan}</span>
          </p>

          <Link
            href="/billing"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600"
          >
            <Plus className="h-3.5 w-3.5" /> Buy More
          </Link>
        </>
      )}
    </div>
  );
}
