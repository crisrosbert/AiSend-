'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import {
  Check, Wallet, Zap, Crown, Loader2, TrendingUp, Plus, ArrowUpRight,
} from 'lucide-react';
import { PLANS, CREDIT_PACKS, getPlan } from '@/lib/billing/plans';

interface OrgBilling {
  id: string;
  plan_id: string;
  plan_status: string;
  credit_balance: number;
  plan_renews_at: string | null;
}

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export default function BillingPage() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [org, setOrg] = useState<OrgBilling | null>(null);
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const loadBilling = async () => {
    if (!profile?.org_id) { setLoading(false); return; }
    try {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, plan_id, plan_status, credit_balance, plan_renews_at')
        .eq('id', profile.org_id)
        .maybeSingle();
      if (orgData) setOrg(orgData as OrgBilling);

      const { data: txData } = await supabase
        .from('wallet_transactions')
        .select('id, type, amount, balance_after, description, created_at')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (txData) setTxns(txData as WalletTx[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBilling(); /* eslint-disable-next-line */ }, [profile?.org_id]);

  const choosePlan = async (planId: string) => {
    setBusy(planId);
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, cycle: billingCycle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      if (data.checkout_url) {
        window.location.href = data.checkout_url; // Razorpay redirect when configured
        return;
      }
      toast.success('Plan updated');
      await loadBilling();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change plan');
    } finally {
      setBusy(null);
    }
  };

  const rechargeCredits = async (packId: string) => {
    setBusy(packId);
    try {
      const res = await fetch('/api/billing/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_id: packId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      toast.success('Credits added to wallet');
      await loadBilling();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recharge failed');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const currentPlan = getPlan(org?.plan_id);
  const balance = org?.credit_balance ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
          Billing & Credits
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your subscription and WhatsApp conversation credits.
        </p>
      </div>

      {/* Current status cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#e7ece9] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Crown className="h-4 w-4 text-emerald-500" /> Current Plan
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
            {currentPlan.name}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {org?.plan_renews_at ? `Renews ${new Date(org.plan_renews_at).toLocaleDateString('en-IN')}` : 'No active billing cycle'}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <Wallet className="h-4 w-4" /> Conversation Credits
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700" style={{ fontFamily: 'var(--font-display)' }}>
            ₹ {balance.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-emerald-600">Used to send WhatsApp messages</p>
        </div>
      </div>

      {/* Recharge packs */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
          Recharge Wallet
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => rechargeCredits(pack.id)}
              disabled={busy === pack.id}
              className="flex flex-col items-center gap-1 rounded-xl border border-[#e7ece9] bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md disabled:opacity-60"
            >
              {busy === pack.id ? (
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              ) : (
                <>
                  <span className="text-lg font-bold text-[#0c1f17]">₹{pack.amount}</span>
                  {pack.bonus > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-600">+₹{pack.bonus} bonus</span>
                  )}
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                    <Plus className="h-3 w-3" /> Add
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
            Subscription Plans
          </h2>
          <div className="flex items-center gap-1 rounded-lg border border-[#e7ece9] bg-white p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${billingCycle === 'monthly' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${billingCycle === 'yearly' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}
            >
              Yearly <span className="text-[10px]">save 16%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan.id === plan.id;
            const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  plan.popular ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-[#e7ece9]'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[11px] font-bold text-white">
                    POPULAR
                  </span>
                )}
                <h3 className="text-lg font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
                  {plan.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{plan.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
                    ₹{price}
                  </span>
                  <span className="text-xs text-slate-400">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                </div>

                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => choosePlan(plan.id)}
                  disabled={isCurrent || busy === plan.id}
                  className={`mt-6 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                >
                  {busy === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : price === 0 ? (
                    'Downgrade to Free'
                  ) : (
                    <>Upgrade <ArrowUpRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction history */}
      {txns.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-bold text-[#0c1f17]" style={{ fontFamily: 'var(--font-display)' }}>
            Recent Transactions
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#e7ece9] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e7ece9] bg-[#f8faf9]">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-400">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-400">Description</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-400">Amount</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-400">Balance</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7ece9]">
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5 capitalize text-slate-600">{t.type}</td>
                    <td className="px-4 py-2.5 text-slate-500">{t.description || '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.amount >= 0 ? '+' : ''}₹{t.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">₹{t.balance_after.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">
                      {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
