// src/lib/tools/template-presets.ts
//
// Ready-made starting points for the template generator. Each one is written
// to pass the checker with nothing left to fix, so the person starts from
// something Meta is likely to accept and changes it to fit their business.
// The sample values (names, order numbers, dates) are examples only.

import type { TemplateInput } from './template-checker'

export interface TemplatePreset {
  id: string
  title: string
  template: TemplateInput
}

const EMPTY_AUTH = { securityNote: true, expiryMinutes: 10, buttonText: 'Copy code' }

function make(over: Partial<TemplateInput> & Pick<TemplateInput, 'name' | 'category' | 'body'>): TemplateInput {
  return {
    language: 'en',
    headerText: '',
    headerSample: '',
    bodySamples: [],
    footer: '',
    buttons: [],
    auth: { ...EMPTY_AUTH },
    ...over,
  }
}

export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  {
    id: 'order-update',
    title: 'Order shipped',
    template: make({
      name: 'order_shipped',
      category: 'utility',
      headerText: 'Your order is on its way',
      body: 'Hi {{1}}, your order {{2}} has been shipped and should reach you by {{3}}. You can follow its journey with the button below.',
      bodySamples: ['Priya', '#A1043', 'Friday, 14 November'],
      footer: 'Reply to this message if you need help',
      buttons: [{ type: 'url', text: 'Track order', value: 'https://example.com/track/{{1}}', sample: 'A1043' }],
    }),
  },
  {
    id: 'appointment-reminder',
    title: 'Appointment reminder',
    template: make({
      name: 'appointment_reminder',
      category: 'utility',
      body: 'Hi {{1}}, this is a reminder about your appointment with {{2}} on {{3}} at {{4}}. Please confirm that you can attend, or choose a new time.',
      bodySamples: ['Rahul', 'Dr. Mehta', 'Monday, 10 November', '5:30 PM'],
      buttons: [
        { type: 'quick_reply', text: 'Confirm', value: '' },
        { type: 'quick_reply', text: 'Reschedule', value: '' },
      ],
    }),
  },
  {
    id: 'payment-receipt',
    title: 'Payment received',
    template: make({
      name: 'payment_received',
      category: 'utility',
      headerText: 'Payment received',
      body: 'Hi {{1}}, we have received your payment of {{2}} for invoice {{3}}. Thank you. You can open your receipt with the button below.',
      bodySamples: ['Anita', 'Rs. 2,499', 'INV-2025-0187'],
      buttons: [{ type: 'url', text: 'View receipt', value: 'https://example.com/receipts/{{1}}', sample: 'INV-2025-0187' }],
    }),
  },
  {
    id: 'festive-offer',
    title: 'Festive sale',
    template: make({
      name: 'festive_sale_v1',
      category: 'marketing',
      headerText: 'Our festive sale is live',
      body: 'Hi {{1}}, our festive sale runs until {{2}}. Enjoy {{3}} off on your favourite styles, in store and online. Tap the button below to start browsing.',
      bodySamples: ['Neha', '16 November', '20%'],
      footer: 'Offer valid on selected items',
      buttons: [
        { type: 'url', text: 'Browse the sale', value: 'https://example.com/sale', sample: '' },
        { type: 'quick_reply', text: 'Stop promotions', value: '' },
      ],
    }),
  },
  {
    id: 'abandoned-cart',
    title: 'Cart reminder',
    template: make({
      name: 'cart_reminder_v1',
      category: 'marketing',
      body: 'Hi {{1}}, you left your {{2}} in your cart. We have saved it for you for the next 24 hours, so you can finish your order whenever you are ready.',
      bodySamples: ['Karan', 'running shoes'],
      buttons: [
        { type: 'url', text: 'Complete my order', value: 'https://example.com/cart/{{1}}', sample: 'k29xa' },
        { type: 'quick_reply', text: 'Stop reminders', value: '' },
      ],
    }),
  },
  {
    id: 'login-code',
    title: 'One-time passcode',
    template: make({
      name: 'login_code',
      category: 'authentication',
      body: '',
      auth: { securityNote: true, expiryMinutes: 10, buttonText: 'Copy code' },
    }),
  },
]

/** A fresh copy, so editing it in the tool never changes the preset itself. */
export function presetById(id: string): TemplateInput | null {
  const found = TEMPLATE_PRESETS.find((p) => p.id === id)
  return found ? structuredClone(found.template) : null
}
