// src/lib/billing/plans.ts
// Single source of truth for subscription plans + credit packs.
// The commercial model is two-part: a monthly platform subscription for
// seats/limits/features, PLUS a prepaid conversation-credit wallet that
// covers Meta's per-message cost.

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;       // INR per month
  priceYearly: number;        // INR per year (discounted)
  tagline: string;
  popular?: boolean;
  limits: {
    contacts: number;          // -1 = unlimited
    broadcastsPerMonth: number;
    teamMembers: number;
    automations: number;
  };
  features: string[];
  freeServiceConversations: number; // Meta gives 1000/mo free; you can cap lower per plan
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Forever',
    priceMonthly: 0,
    priceYearly: 0,
    tagline: 'Try the platform with your test number',
    limits: { contacts: 100, broadcastsPerMonth: 2, teamMembers: 1, automations: 2 },
    features: [
      'WhatsApp inbox',
      '100 contacts',
      '2 broadcasts / month',
      'Basic templates',
      'Pay-as-you-go credits',
    ],
    freeServiceConversations: 1000,
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 1,
    priceYearly: 2,
    tagline: 'For small businesses getting started',
    popular: true,
    limits: { contacts: 5000, broadcastsPerMonth: 50, teamMembers: 3, automations: 20 },
    features: [
      'Everything in Free',
      '5,000 contacts',
      '50 broadcasts / month',
      '3 team members',
      'All template library',
      'Automations & bot flows',
      'Priority support',
    ],
    freeServiceConversations: 1000,
  },
  {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 1,
    priceYearly: 2,
    tagline: 'For growing businesses that need scale',
    limits: { contacts: -1, broadcastsPerMonth: -1, teamMembers: 10, automations: -1 },
    features: [
      'Everything in Starter',
      'Unlimited contacts',
      'Unlimited broadcasts',
      '10 team members',
      'Unlimited automations',
      'Advanced analytics',
      'Dedicated support',
    ],
    freeServiceConversations: 1000,
  },
];

// ── Wallet top-ups ────────────────────────────────────────────────
// Bonus tiers live here so the quick-top-up buttons, the custom-amount
// modal and any server-side validation all agree on what a given rupee
// amount earns. Changing a tier is a one-line change in one file.

export const MIN_TOPUP_INR = 10;

interface BonusTier {
  /** Applies once the top-up reaches this amount. */
  from: number;
  /** Flat bonus in INR, or a fraction of the top-up. */
  flat?: number;
  rate?: number;
}

const BONUS_TIERS: BonusTier[] = [
  { from: 5000, rate: 0.1 },
  { from: 2500, flat: 200 },
  { from: 1000, flat: 50 },
];

/** Bonus credits earned on a top-up of `amount` INR. */
export function bonusForAmount(amount: number): number {
  const value = Number(amount) || 0;
  for (const tier of BONUS_TIERS) {
    if (value >= tier.from) {
      return tier.flat ?? Math.round(value * (tier.rate ?? 0));
    }
  }
  return 0;
}

export interface CreditPack {
  id: string;
  amount: number;   // INR added to wallet
  bonus: number;    // free bonus credits
  label: string;
}

function pack(amount: number): CreditPack {
  const bonus = bonusForAmount(amount);
  return {
    id: `pack_${amount}`,
    amount,
    bonus,
    label: bonus > 0 ? `₹${amount.toLocaleString('en-IN')} + ₹${bonus} free` : `₹${amount.toLocaleString('en-IN')}`,
  };
}

export const CREDIT_PACKS: CreditPack[] = [5, 1, 25, 50].map(pack);

// Meta's approximate per-conversation cost in India (INR).
// These are indicative — update from Meta's official rate card.
// Used to estimate/deduct credits when a conversation opens.
export const CONVERSATION_RATES_INR: Record<string, number> = {
  marketing: 0.78,
  utility: 0.115,
  authentication: 0.115,
  service: 0.35,
};

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) || PLANS[0];
}

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
