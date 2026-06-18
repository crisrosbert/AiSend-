// src/types/journey.ts
// Canonical types for AiSend Flow Studio.
// Designed deliberately distinct from existing /src/lib/automations/* types —
// Journeys are the new node-based system; Automations are the older
// keyword→step engine. They coexist; the migration plan is separate.

export type JourneyStatus = "draft" | "active" | "paused";

export interface Journey {
  id: string;
  user_id: string;
  name: string;
  status: JourneyStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  trigger: Trigger;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  persona_id?: string | null;
  brain_source_ids?: string[];
}

export type TriggerType = "keyword" | "regex" | "template_start" | "ad_click";

export interface Trigger {
  type: TriggerType;
  keywords?: string[];
  regex?: { pattern: string; caseSensitive: boolean };
  templateId?: string;
  adIds?: string[]; // capped per plan tier; default cap = 20
}

// All node types supported on the canvas.
// "Send" group → message nodes / "Do" group → action nodes
export type NodeType =
  // ── Send (message nodes) ──
  | "TEXT_BUTTONS"
  | "MEDIA_BUTTONS"
  | "LIST"
  | "CATALOGUE"
  | "SINGLE_PRODUCT"
  | "MULTI_PRODUCT"
  | "TEMPLATE"
  // ── Do (action nodes) ──
  | "HANDOFF_TO_HUMAN"
  | "CONVERSION_EVENT"
  | "CONDITION"
  | "WEBHOOK_CALL"
  | "TAG_CONTACT"
  // ── System (root) ──
  | "TRIGGER";

export interface JourneyNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface JourneyEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// ── Brain (grounding sources) ──
export type BrainSourceType = "file" | "url" | "faq";
export type BrainSourceStatus = "processing" | "ready" | "failed";

export interface BrainSource {
  id: string;
  type: BrainSourceType;
  title: string;
  content?: string;
  source_url?: string;
  status: BrainSourceStatus;
  created_at: string;
}

// ── Actions (tool calling) ──
export interface ActionBinding {
  id: string;
  name: string;
  trigger_keywords: string[];
  method: "GET" | "POST";
  endpoint: string;
  headers: Record<string, string>;
  body_template?: string;
  response_mapping: Record<string, string>;
}

// ── Persona ──
export interface Persona {
  id: string;
  business_context: string;
  tone: string;
  goals: string[];
  guardrails: string[];
  escalation_rules: string[];
  raw_prompt?: string; // compiled/editable system prompt
}

// ── Plan usage (gating) ──
export interface PlanUsage {
  journey_slots_used: number;
  journey_slots_limit: number;
  ai_message_credits_used: number;
  ai_message_credits_limit: number;
  billing_cycle_end: string;
}

// ── UI helpers (not persisted) ──
export interface NodeTypeMeta {
  type: NodeType;
  label: string;
  group: "Send" | "Do" | "System";
  icon: string; // lucide icon name as string
  accent: string; // hex
}

export const NODE_CATALOG: NodeTypeMeta[] = [
  // Send group
  { type: "TEXT_BUTTONS",   label: "Text + Buttons",   group: "Send", icon: "MessageSquare", accent: "#10b981" },
  { type: "MEDIA_BUTTONS",  label: "Media + Buttons",  group: "Send", icon: "Image",         accent: "#0ea5e9" },
  { type: "LIST",           label: "List",             group: "Send", icon: "List",          accent: "#8b5cf6" },
  { type: "CATALOGUE",      label: "Catalogue",        group: "Send", icon: "BookOpen",      accent: "#f59e0b" },
  { type: "SINGLE_PRODUCT", label: "Single Product",   group: "Send", icon: "Package",       accent: "#ec4899" },
  { type: "MULTI_PRODUCT",  label: "Multi Product",    group: "Send", icon: "Boxes",         accent: "#f43f5e" },
  { type: "TEMPLATE",       label: "Template",         group: "Send", icon: "FileText",      accent: "#06b6d4" },
  // Do group
  { type: "HANDOFF_TO_HUMAN", label: "Handoff to Human", group: "Do", icon: "UserCheck",   accent: "#10b981" },
  { type: "CONVERSION_EVENT", label: "Conversion Event", group: "Do", icon: "TrendingUp",  accent: "#3b82f6" },
  { type: "CONDITION",        label: "Condition",        group: "Do", icon: "GitBranch",   accent: "#f59e0b" },
  { type: "WEBHOOK_CALL",     label: "Webhook Call",     group: "Do", icon: "Webhook",     accent: "#8b5cf6" },
  { type: "TAG_CONTACT",      label: "Tag Contact",      group: "Do", icon: "Tag",         accent: "#ec4899" },
];

/**
 * Generate a short human-readable summary of a Trigger,
 * used in the Journeys list "Trigger" column.
 * Example outputs:
 *   "Keyword: pricing, demo"
 *   "Regex: /book.+now/i"
 *   "Template: welcome_msg"
 *   "Ads: 3 selected"
 */
export function triggerSummary(t: Trigger): string {
  switch (t.type) {
    case "keyword":
      return t.keywords?.length
        ? `Keyword: ${t.keywords.slice(0, 3).join(", ")}${t.keywords.length > 3 ? "…" : ""}`
        : "Keyword (none set)";
    case "regex":
      return t.regex?.pattern
        ? `Regex: /${t.regex.pattern.slice(0, 24)}${t.regex.pattern.length > 24 ? "…" : ""}/${t.regex.caseSensitive ? "" : "i"}`
        : "Regex (none set)";
    case "template_start":
      return t.templateId ? `Template: ${t.templateId}` : "Template start (none)";
    case "ad_click":
      return t.adIds?.length ? `Ads: ${t.adIds.length} selected` : "Ad click (none)";
  }
}
