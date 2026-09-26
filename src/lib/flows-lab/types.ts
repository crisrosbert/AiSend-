// src/lib/flows-lab/types.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// Flows Lab is the experimental successor to /journeys. It's a rebuild
// of interactive WhatsApp Flows, this time using the multi-step
// screen model that WhatsApp's Cloud API actually accepts today —
// screens with layouts of typed components (text, radio, input,
// date-picker, footer button), each screen submitting a form that
// routes to the next.
//
// The old /journeys system stays untouched while this bakes. If Lab
// wins on user testing, /journeys gets deleted; if it doesn't, Lab
// gets deleted and nothing else changes.
//
// ── SHAPE ──────────────────────────────────────────────────────────
// A Flow is a directed graph of Screens. Each Screen has a Layout
// with typed Components. Components either just render text/media,
// or bind to a form field the user fills in. The last component on
// each Screen is a Footer that submits and names the next screen
// (or SUCCESS to close the flow).
//
// This mirrors Meta's flow.json spec loosely — enough to compile a
// Lab flow to a real WhatsApp Flow JSON in a later step. We keep it
// stricter than Meta's spec on purpose: fewer component types, one
// footer per screen, screen IDs auto-generated.

export type ComponentType =
  | "TextHeading"
  | "TextSubheading"
  | "TextBody"
  | "TextCaption"
  | "Image"
  | "TextInput"
  | "TextArea"
  | "RadioButtonsGroup"
  | "CheckboxGroup"
  | "Dropdown"
  | "DatePicker"
  | "OptIn"
  | "EmbeddedLink"
  | "Footer";

export type InputType = "text" | "number" | "email" | "password" | "phone";

// A single option in a radio/checkbox/dropdown group.
export interface FlowOption {
  id: string;         // stable ID used as the response value
  title: string;      // shown to the user
  description?: string;
}

// One component on a screen. Not every field applies to every type,
// but keeping this flat lets the builder edit any component with one
// form and lets the renderer render any component with one switch.
export interface FlowComponent {
  id: string;
  type: ComponentType;

  // Text components
  text?: string;
  markdown?: boolean;

  // Media
  src?: string;         // image URL or base64 data-uri
  altText?: string;
  aspectRatio?: string; // "1:1" | "4:3" | "16:9"

  // Input components (TextInput, TextArea, DatePicker, etc.)
  label?: string;
  name?: string;        // form field name (goes into response payload)
  helperText?: string;
  required?: boolean;
  minChars?: number;
  maxChars?: number;
  inputType?: InputType;
  placeholder?: string;
  minDate?: string;     // ISO date for DatePicker
  maxDate?: string;

  // Options for RadioButtonsGroup / CheckboxGroup / Dropdown
  options?: FlowOption[];
  minSelectedItems?: number; // Checkbox only
  maxSelectedItems?: number;

  // OptIn
  onClickUrl?: string;

  // Footer (the submit button that moves to the next screen)
  buttonLabel?: string;
  nextScreen?: string;  // screen ID or the special "SUCCESS"
  onClickAction?: "navigate" | "complete" | "data_exchange";
}

export interface FlowScreen {
  id: string;
  title: string;             // shown in the WhatsApp header
  terminal?: boolean;        // true if this is a SUCCESS screen
  refreshOnBack?: boolean;
  components: FlowComponent[];
}

export interface FlowDefinition {
  id: string;                // uuid
  version: number;           // bumped on publish
  name: string;              // internal, shown in the list
  description?: string;      // internal
  category: FlowCategory;
  status: "draft" | "testing" | "published" | "archived";

  // The graph itself.
  screens: FlowScreen[];
  startScreenId: string;

  // Where responses go. In the current build this is just captured
  // to the flow_responses table; a webhook is a later step.
  webhookUrl?: string;

  // Ownership + audit
  userId: string;
  createdAt: string;         // ISO
  updatedAt: string;

  // Metrics captured while testing (rough — filled in as tests run)
  metrics?: {
    started: number;
    completed: number;
    lastTestedAt?: string;
  };
}

export type FlowCategory =
  | "lead_generation"
  | "appointment_booking"
  | "customer_feedback"
  | "order_tracking"
  | "support_ticket"
  | "product_catalog"
  | "custom";

export const FLOW_CATEGORIES: { slug: FlowCategory; label: string; emoji: string }[] = [
  { slug: "lead_generation",     label: "Lead Generation",     emoji: "🎯" },
  { slug: "appointment_booking", label: "Appointment Booking", emoji: "📅" },
  { slug: "customer_feedback",   label: "Customer Feedback",   emoji: "⭐" },
  { slug: "order_tracking",      label: "Order Tracking",      emoji: "📦" },
  { slug: "support_ticket",      label: "Support Ticket",      emoji: "🎫" },
  { slug: "product_catalog",     label: "Product Catalog",     emoji: "🛒" },
  { slug: "custom",              label: "Custom",              emoji: "✨" },
];

// One captured run of a flow — what the user answered on each screen.
// Not the full Meta payload; just enough to inspect during tests.
export interface FlowResponse {
  id: string;
  flowId: string;
  contactPhone?: string;
  contactName?: string;
  answers: Record<string, unknown>;   // keyed by component.name
  screensSeen: string[];              // ordered screen IDs
  startedAt: string;
  completedAt?: string;
  status: "in_progress" | "completed" | "abandoned";
}

// Newly-generated component/screen. Not exhaustive — the builder can
// add anything on top; this is just what the "+ Add" menu offers first.
export function newComponent(type: ComponentType): FlowComponent {
  const id = `c_${Math.random().toString(36).slice(2, 9)}`;
  switch (type) {
    case "TextHeading":
      return { id, type, text: "Heading" };
    case "TextSubheading":
      return { id, type, text: "Subheading" };
    case "TextBody":
      return { id, type, text: "Body text explaining this step." };
    case "TextCaption":
      return { id, type, text: "Caption" };
    case "Image":
      return { id, type, src: "", altText: "Image", aspectRatio: "16:9" };
    case "TextInput":
      return { id, type, label: "Your answer", name: `field_${id}`, inputType: "text", required: true };
    case "TextArea":
      return { id, type, label: "Details", name: `field_${id}`, required: false, maxChars: 500 };
    case "RadioButtonsGroup":
      return {
        id, type, label: "Pick one", name: `field_${id}`, required: true,
        options: [
          { id: "opt_1", title: "Option 1" },
          { id: "opt_2", title: "Option 2" },
        ],
      };
    case "CheckboxGroup":
      return {
        id, type, label: "Pick any", name: `field_${id}`,
        options: [
          { id: "opt_1", title: "Option 1" },
          { id: "opt_2", title: "Option 2" },
        ],
        minSelectedItems: 1,
        maxSelectedItems: 3,
      };
    case "Dropdown":
      return {
        id, type, label: "Choose", name: `field_${id}`,
        options: [
          { id: "opt_1", title: "Option 1" },
          { id: "opt_2", title: "Option 2" },
        ],
      };
    case "DatePicker":
      return { id, type, label: "Pick a date", name: `field_${id}`, required: true };
    case "OptIn":
      return { id, type, label: "I agree to the terms", name: `field_${id}`, required: false };
    case "EmbeddedLink":
      return { id, type, text: "Learn more", onClickUrl: "https://example.com" };
    case "Footer":
      return { id, type, buttonLabel: "Continue", nextScreen: "SUCCESS", onClickAction: "navigate" };
  }
}

export function newScreen(title = "New Screen"): FlowScreen {
  const id = `s_${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    title,
    components: [
      newComponent("TextHeading"),
      newComponent("TextBody"),
      newComponent("Footer"),
    ],
  };
}

// Validate a flow. Returns an array of human-readable problems so the
// builder can surface them in-place rather than yelling on publish.
export function validateFlow(flow: FlowDefinition): string[] {
  const problems: string[] = [];

  if (!flow.name.trim()) problems.push("Flow needs a name");
  if (flow.screens.length === 0) {
    problems.push("Flow has no screens");
    return problems;
  }

  const screenIds = new Set(flow.screens.map((s) => s.id));
  if (!screenIds.has(flow.startScreenId)) {
    problems.push("Start screen does not exist");
  }

  for (const screen of flow.screens) {
    if (!screen.title.trim()) problems.push(`Screen "${screen.id}" is missing a title`);
    const footers = screen.components.filter((c) => c.type === "Footer");
    if (footers.length === 0 && !screen.terminal) {
      problems.push(`Screen "${screen.title || screen.id}" has no Footer button`);
    }
    if (footers.length > 1) {
      problems.push(`Screen "${screen.title || screen.id}" has more than one Footer button`);
    }
    for (const footer of footers) {
      if (
        footer.nextScreen &&
        footer.nextScreen !== "SUCCESS" &&
        !screenIds.has(footer.nextScreen)
      ) {
        problems.push(`Screen "${screen.title || screen.id}" points at a screen that no longer exists`);
      }
    }
    // Input fields need names
    for (const comp of screen.components) {
      if (["TextInput", "TextArea", "RadioButtonsGroup", "CheckboxGroup", "Dropdown", "DatePicker", "OptIn"].includes(comp.type)) {
        if (!comp.name?.trim()) problems.push(`Input on "${screen.title || screen.id}" has no field name`);
        if (!comp.label?.trim()) problems.push(`Input on "${screen.title || screen.id}" has no label`);
      }
    }
  }

  return problems;
}
