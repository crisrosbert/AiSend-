// src/lib/agent/engine-capabilities.ts
//
// The capability layer for the multi-agent engine. Reads an agent's row
// (capability flags) and turns lead-form + media into AI tools that are
// only present when the agent has them enabled.
//
// engine.ts imports: loadAgent, buildAgentTools, buildAgentSystemAddon,
//                    handleCapabilityTool, type Agent
//
// This keeps engine.ts clean — all the per-capability logic lives here.

import { createClient } from '@supabase/supabase-js'
import type { LLMTool } from '@/lib/agent/llm-provider'
import { saveLead, buildLeadFormFields } from '@/lib/agent/tools/lead-form-tools'
import {
  getAgentMedia,
  describeMediaForPrompt,
  resolveMedia,
  type MediaItem,
} from '@/lib/agent/tools/media-tools'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

// ── The Agent shape (matches the agents table) ──
export interface Agent {
  id: string
  tenant_id: string
  journey_id: string | null
  name: string
  agent_type: string
  industry: string | null
  persona: string | null
  quick_replies_enabled: boolean
  lead_form_enabled: boolean
  lead_form_mode: 'gate' | 'progressive'
  lead_form_fields: string[]
  booking_enabled: boolean
  media_enabled: boolean
  payment_enabled: boolean
  is_active: boolean
}

// Load an agent row by id. Returns null if not found (engine falls back
// to legacy all-tools behaviour).
export async function loadAgent(agentId: string): Promise<Agent | null> {
  try {
    const { data } = await db()
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .maybeSingle()
    if (!data) return null

    // lead_form_fields may come back as JSONB (already array) or string
    let fields = data.lead_form_fields
    if (typeof fields === 'string') {
      try { fields = JSON.parse(fields) } catch { fields = ['first_name', 'last_name', 'phone', 'email'] }
    }

    return {
      ...data,
      lead_form_fields: Array.isArray(fields) ? fields : ['first_name', 'last_name', 'phone', 'email'],
    } as Agent
  } catch (err) {
    console.error('[engine-capabilities] loadAgent error:', err)
    return null
  }
}

// ── Capability tools (only added when the agent has the flag on) ──
const SUBMIT_LEAD_TOOL: LLMTool = {
  name: 'submit_lead',
  description:
    'Show the customer a lead-capture form to collect their contact details. Use this when the customer shows real interest (asks about pricing, wants a demo, wants to be contacted) and you want to capture them as a lead. The form appears in the chat for them to fill.',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Why you are showing the form now (internal note)' },
    },
    required: [],
  },
}

const SEND_MEDIA_TOOL: LLMTool = {
  name: 'send_media',
  description:
    'Send the customer an image, PDF, brochure, or video from the available media list. Use the media id or title. Use this when the customer wants to see something visual — a brochure, floor plan, product photo, price list PDF, or video.',
  parameters: {
    type: 'object',
    properties: {
      media: { type: 'string', description: 'The id or title of the media item to send' },
    },
    required: ['media'],
  },
}

// Build the capability tools for this agent, gated by flags.
export function buildAgentTools(agent: Agent): LLMTool[] {
  const tools: LLMTool[] = []
  if (agent.lead_form_enabled) tools.push(SUBMIT_LEAD_TOOL)
  if (agent.media_enabled) tools.push(SEND_MEDIA_TOOL)
  return tools
}

// Build the system-prompt addon: media catalog + lead-form guidance.
export async function buildAgentSystemAddon(agent: Agent): Promise<string> {
  let addon = ''

  // Lead form rules
  if (agent.lead_form_enabled) {
    if (agent.lead_form_mode === 'gate') {
      addon += `\n[Lead capture — GATE mode]: Before helping in detail, call submit_lead to show the contact form. Politely explain you'll capture their details so the team can assist them properly.`
    } else {
      addon += `\n[Lead capture — PROGRESSIVE mode]: Chat naturally first. Once the customer shows genuine interest (asks about pricing, a demo, or wants to be contacted), call submit_lead to show the contact form. Don't ask for the form too early — earn it.`
    }
  }

  // Media catalog
  if (agent.media_enabled) {
    const media = await getAgentMedia(agent.id)
    if (media.length > 0) {
      addon += describeMediaForPrompt(media)
      addon += `\n[When the customer wants to see any of the above, call send_media with its id.]`
    }
  }

  return addon
}

// ── Capability tool execution ──
export interface CapabilityToolResult {
  result: string
  media?: MediaItem
  showLeadForm?: { fields: Array<{ key: string; label: string; type: string; required: boolean }> }
}

// Handle submit_lead / send_media. Returns null if the tool isn't a
// capability tool (so the engine falls through to its own switch).
export async function handleCapabilityTool(
  agent: Agent,
  conversationId: string,
  _customerPhone: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
): Promise<CapabilityToolResult | null> {
  // submit_lead → tell the widget to render the form
  if (toolName === 'submit_lead') {
    const fields = buildLeadFormFields(agent.lead_form_fields)
    return {
      result:
        'The contact form is now shown to the customer. Ask them to fill it in so the team can reach out. Once submitted, thank them warmly.',
      showLeadForm: { fields },
    }
  }

  // send_media → resolve the item and return it for delivery
  if (toolName === 'send_media') {
    const idOrTitle = String(toolArgs.media || '')
    const item = await resolveMedia(agent.id, idOrTitle)
    if (!item) {
      return { result: `Could not find that media item. Tell the customer you'll share it shortly.` }
    }
    return {
      result: `Sending "${item.title}" to the customer now. Briefly introduce it in your reply.`,
      media: item,
    }
  }

  return null
}

// Save a lead form submission (called by the widget route when the
// customer submits the form).
export async function submitLeadForm(
  agent: Agent,
  conversationId: string,
  values: Record<string, string>,
): Promise<string> {
  return saveLead({
    tenantId: agent.tenant_id,
    agentId: agent.id,
    conversationId,
    firstName: values.first_name,
    lastName: values.last_name,
    phone: values.phone,
    email: values.email,
    companyName: values.company_name,
  })
}
