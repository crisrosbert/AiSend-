// src/lib/billing/plans.ts
// Single source of truth for subscription plans + credit packs.
// Mirrors AiSensy: a monthly platform subscription PLUS a prepaid
// conversation-credit wallet that covers Meta's per-conversation cost.

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
    priceMonthly: 999,
    priceYearly: 9990,
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
    priceMonthly: 1999,
    priceYearly: 19990,
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

// Prepaid credit packs (the wallet recharge options, like AiSensy's "Buy More")
export interface CreditPack {
  id: string;
  amount: number;   // INR added to wallet
  bonus: number;    // free bonus credits
  label: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack_500', amount: 500, bonus: 0, label: '₹500' },
  { id: 'pack_1000', amount: 1000, bonus: 50, label: '₹1,000 + ₹50 bonus' },
  { id: 'pack_2500', amount: 2500, bonus: 200, label: '₹2,500 + ₹200 bonus' },
  { id: 'pack_5000', amount: 5000, bonus: 500, label: '₹5,000 + ₹500 bonus' },
];

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
