// src/lib/flows-lab/templates.ts
//
// Starter templates for the Flows Lab. Each one is a complete
// FlowDefinition minus id/timestamps/user — the "New" flow page
// stamps those in before saving.
//
// Kept short on purpose: two or three screens is the pattern most
// users copy first, and it fits in one glance in the builder.
// Anyone who wants a longer flow builds on top of this.

import type { FlowDefinition } from "./types";

type TemplateSeed = Omit<FlowDefinition, "id" | "userId" | "createdAt" | "updatedAt" | "version" | "status">;

export const FLOW_TEMPLATES: Record<string, TemplateSeed> = {
  //
  // ── LEAD GENERATION ──────────────────────────────────────────────
  //
  lead_generation: {
    name: "Lead Capture",
    description: "Two-step contact form for capturing sales leads from marketing campaigns.",
    category: "lead_generation",
    startScreenId: "s_lead_1",
    screens: [
      {
        id: "s_lead_1",
        title: "Tell us about you",
        components: [
          { id: "c1", type: "TextHeading", text: "Let's connect" },
          { id: "c2", type: "TextBody", text: "Share a few details and our team will reach out within one working day." },
          { id: "c3", type: "TextInput", label: "Your name", name: "full_name", inputType: "text", required: true, placeholder: "Priya Sharma" },
          { id: "c4", type: "TextInput", label: "Email", name: "email", inputType: "email", required: true, placeholder: "you@company.com" },
          { id: "c5", type: "TextInput", label: "Company", name: "company", inputType: "text", required: false },
          { id: "c6", type: "Footer", buttonLabel: "Continue", nextScreen: "s_lead_2", onClickAction: "navigate" },
        ],
      },
      {
        id: "s_lead_2",
        title: "What are you looking for?",
        components: [
          { id: "c7", type: "TextHeading", text: "How can we help?" },
          {
            id: "c8", type: "RadioButtonsGroup", label: "Primary interest", name: "interest", required: true,
            options: [
              { id: "sales",   title: "Sales enquiry" },
              { id: "support", title: "Support" },
              { id: "partner", title: "Partnership" },
              { id: "other",   title: "Something else" },
            ],
          },
          { id: "c9", type: "TextArea", label: "Notes (optional)", name: "notes", maxChars: 300, required: false },
          { id: "c10", type: "Footer", buttonLabel: "Submit", nextScreen: "SUCCESS", onClickAction: "complete" },
        ],
      },
    ],
  },

  //
  // ── APPOINTMENT BOOKING ─────────────────────────────────────────
  //
  appointment_booking: {
    name: "Appointment Booking",
    description: "Three-step booking flow — service, date, contact details.",
    category: "appointment_booking",
    startScreenId: "s_book_1",
    screens: [
      {
        id: "s_book_1",
        title: "Book an appointment",
        components: [
          { id: "c1", type: "TextHeading", text: "Which service?" },
          {
            id: "c2", type: "RadioButtonsGroup", label: "Choose one", name: "service", required: true,
            options: [
              { id: "consult",  title: "Consultation",  description: "30 min" },
              { id: "checkup",  title: "Check-up",      description: "45 min" },
              { id: "followup", title: "Follow-up",     description: "20 min" },
            ],
          },
          { id: "c3", type: "Footer", buttonLabel: "Next", nextScreen: "s_book_2", onClickAction: "navigate" },
        ],
      },
      {
        id: "s_book_2",
        title: "Pick a date",
        components: [
          { id: "c4", type: "TextHeading", text: "When suits you?" },
          { id: "c5", type: "DatePicker", label: "Preferred date", name: "date", required: true },
          {
            id: "c6", type: "Dropdown", label: "Time of day", name: "time_slot", required: true,
            options: [
              { id: "morning",   title: "Morning (9 AM – 12 PM)" },
              { id: "afternoon", title: "Afternoon (12 PM – 4 PM)" },
              { id: "evening",   title: "Evening (4 PM – 7 PM)" },
            ],
          },
          { id: "c7", type: "Footer", buttonLabel: "Next", nextScreen: "s_book_3", onClickAction: "navigate" },
        ],
      },
      {
        id: "s_book_3",
        title: "Your details",
        components: [
          { id: "c8", type: "TextInput", label: "Full name", name: "full_name", required: true },
          { id: "c9", type: "TextInput", label: "Phone", name: "phone", inputType: "phone", required: true },
          { id: "c10", type: "TextArea", label: "Anything we should know?", name: "notes", maxChars: 200, required: false },
          { id: "c11", type: "Footer", buttonLabel: "Confirm booking", nextScreen: "SUCCESS", onClickAction: "complete" },
        ],
      },
    ],
  },

  //
  // ── CUSTOMER FEEDBACK ───────────────────────────────────────────
  //
  customer_feedback: {
    name: "Customer Feedback (NPS)",
    description: "One-screen NPS-style survey with optional free-text follow-up.",
    category: "customer_feedback",
    startScreenId: "s_fb_1",
    screens: [
      {
        id: "s_fb_1",
        title: "How did we do?",
        components: [
          { id: "c1", type: "TextHeading", text: "Quick feedback" },
          { id: "c2", type: "TextBody", text: "How likely are you to recommend us to a friend?" },
          {
            id: "c3", type: "RadioButtonsGroup", label: "Rate 1–10", name: "nps", required: true,
            options: Array.from({ length: 10 }, (_, i) => ({
              id: `${i + 1}`,
              title: `${i + 1}${i === 9 ? " — Extremely likely" : i === 0 ? " — Not at all" : ""}`,
            })),
          },
          { id: "c4", type: "TextArea", label: "What could we do better?", name: "comments", maxChars: 500, required: false },
          { id: "c5", type: "Footer", buttonLabel: "Send feedback", nextScreen: "SUCCESS", onClickAction: "complete" },
        ],
      },
    ],
  },

  //
  // ── ORDER TRACKING ──────────────────────────────────────────────
  //
  order_tracking: {
    name: "Order Tracking",
    description: "Customer enters an order ID and picks what they need.",
    category: "order_tracking",
    startScreenId: "s_ord_1",
    screens: [
      {
        id: "s_ord_1",
        title: "Track your order",
        components: [
          { id: "c1", type: "TextHeading", text: "Find your order" },
          { id: "c2", type: "TextInput", label: "Order ID", name: "order_id", required: true, placeholder: "e.g. ORD-19238" },
          {
            id: "c3", type: "RadioButtonsGroup", label: "What do you need?", name: "action", required: true,
            options: [
              { id: "status",    title: "Check status" },
              { id: "reschedule", title: "Reschedule delivery" },
              { id: "cancel",    title: "Cancel order" },
              { id: "issue",     title: "Report an issue" },
            ],
          },
          { id: "c4", type: "Footer", buttonLabel: "Continue", nextScreen: "SUCCESS", onClickAction: "complete" },
        ],
      },
    ],
  },

  //
  // ── SUPPORT TICKET ──────────────────────────────────────────────
  //
  support_ticket: {
    name: "Support Ticket",
    description: "Categorise an issue and collect details before handing off to a human.",
    category: "support_ticket",
    startScreenId: "s_sup_1",
    screens: [
      {
        id: "s_sup_1",
        title: "What's the issue?",
        components: [
          { id: "c1", type: "TextHeading", text: "Help us route your ticket" },
          {
            id: "c2", type: "RadioButtonsGroup", label: "Category", name: "category", required: true,
            options: [
              { id: "billing",  title: "Billing" },
              { id: "technical", title: "Technical" },
              { id: "account",  title: "Account access" },
              { id: "other",    title: "Something else" },
            ],
          },
          {
            id: "c3", type: "Dropdown", label: "How urgent is it?", name: "urgency", required: true,
            options: [
              { id: "low",    title: "Low — I can wait" },
              { id: "medium", title: "Medium — Today would be nice" },
              { id: "high",   title: "High — Blocking my work" },
              { id: "critical", title: "Critical — Everything's down" },
            ],
          },
          { id: "c4", type: "Footer", buttonLabel: "Next", nextScreen: "s_sup_2", onClickAction: "navigate" },
        ],
      },
      {
        id: "s_sup_2",
        title: "Tell us more",
        components: [
          { id: "c5", type: "TextArea", label: "Describe the issue", name: "description", required: true, maxChars: 1000 },
          { id: "c6", type: "TextInput", label: "Your email (for updates)", name: "email", inputType: "email", required: true },
          { id: "c7", type: "OptIn", label: "It's okay to close my ticket if I don't reply in 3 days", name: "auto_close_ok" },
          { id: "c8", type: "Footer", buttonLabel: "Submit ticket", nextScreen: "SUCCESS", onClickAction: "complete" },
        ],
      },
    ],
  },
};

export const TEMPLATE_ORDER = [
  "lead_generation",
  "appointment_booking",
  "customer_feedback",
  "order_tracking",
  "support_ticket",
] as const;
