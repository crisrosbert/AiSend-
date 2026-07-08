// src/lib/agent/engine-capabilities.ts
//
// The capability layer that turns one engine into many agents. This module:
//   1. Loads an agent row (identity + capability flags) by widget/agent id
//   2. Builds the tool set the AI is allowed to use, gated by those flags
//   3. Injects the media catalog into the system prompt
//   4. Handles the three new tools: show_lead_form, submit_lead, send_media
//
// The engine (src/lib/agent/engine.ts) calls loadAgent() once per turn, then
// buildAgentTools() to get the tool schema, and dispatches tool calls to
// handleCapabilityTool(). Nothing here is agent-specific — behaviour is data.
//
// Depends on:
//   - ./tools/lead-form-tools  (saveLead, buildLeadFormFields)
//   - ./tools/media-tools       (getAgentMedia, describeMediaForPrompt, resolveMedia)

import { createClient } from '@supabase/supabase-js'
import {
  saveLead,
  buildLeadFormFields,
  type SaveLeadArgs,
} from './tools/lead-form-tools'
import {
  getAgentMedia,
  describeMediaForPrompt,
  resolveMedia,
  type MediaItem,
} from './tools/media-tools'

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

// ── The agent record (mirrors the agents table) ──
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

// Load an agent by its own id, or fall back to the widget_config link.
export async function loadAgent(opts: {
  agentId?: string
  widgetConfigId?: string
}): Promise<Agent | null> {
  try {
    let agentId = opts.agentId
    if (!agentId && opts.widgetConfigId) {
      const { data: wc } = await db()
        .from('widget_configs')
        .select('agent_id')
        .eq('id', opts.widgetConfigId)
        .maybeSingle()
      agentId = wc?.agent_id
    }
    if (!agentId) return null

    const { data, error } = await db()
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('is_active', true)
      .maybeSingle()
    if (error || !data) return null
    return data as Agent
  } catch (err) {
    console.error('[engine] loadAgent error:', err)
    return null
  }
}

// ── Tool schemas (Anthropic tool-use format) ──
// Only the tools an agent is allowed to use are returned, so the model can
// never call a capability the tenant disabled.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolSchema = Record<string, any>

const LEAD_FORM_TOOL = (fields: string[]): ToolSchema => ({
  name: 'show_lead_form',
  description:
    'Display a short form to capture the customer\'s contact details. ' +
    'Call this when the customer shows buying intent or asks to be contacted. ' +
    'The form renders in the chat widget; do not ask for the fields in text as well.',
  input_schema: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description:
          'One short sentence shown above the form, e.g. "Share your details and our team will call you back."',
      },
    },
    required: ['reason'],
  },
})

const SUBMIT_LEAD_TOOL: ToolSchema = {
  name: 'submit_lead',
  description:
    'Save the contact details the customer typed into the lead form. ' +
    'Only call this after the customer has actually submitted the form.',
  input_schema: {
    type: 'object',
    properties: {
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      company_name: { type: 'string' },
    },
    required: [],
  },
}

const SEND_MEDIA_TOOL: ToolSchema = {
  name: 'send_media',
  description:
    'Send an image, PDF, brochure, or video to the customer in chat. ' +
    'Pass the media id (preferred) or an exact title from the available media list. ' +
    'Only send media that is genuinely relevant to what the customer asked.',
  input_schema: {
    type: 'object',
    properties: {
      id_or_title: {
        type: 'string',
        description: 'The media id from the available-media list, or its exact title.',
      },
    },
    required: ['id_or_title'],
  },
}

// Build the allowed tool set for an agent based on its capability flags.
export function buildAgentTools(agent: Agent): ToolSchema[] {
  const tools: ToolSchema[] = []
  if (agent.lead_form_enabled) {
    tools.push(LEAD_FORM_TOOL(agent.lead_form_fields))
    tools.push(SUBMIT_LEAD_TOOL)
  }
  if (agent.media_enabled) {
    tools.push(SEND_MEDIA_TOOL)
  }
  // booking_enabled / payment_enabled tools plug in the same way here.
  return tools
}

// Build the extra system-prompt text an agent needs at runtime:
//   - the persona
//   - the media catalog (so the AI knows what it can send)
//   - a gate-mode instruction if the lead form must come first
export async function buildAgentSystemAddon(agent: Agent): Promise<string> {
  let addon = agent.persona ? agent.persona.trim() : ''

  if (agent.media_enabled) {
    const media = await getAgentMedia(agent.id)
    addon += describeMediaForPrompt(media)
  }

  if (agent.lead_form_enabled && agent.lead_form_mode === 'gate') {
    addon +=
      '\n\n[Lead capture — GATE mode]: Before answering detailed questions, ' +
      'greet the customer and call show_lead_form to collect their details. ' +
      'Keep it friendly and explain the team will follow up.'
  } else if (agent.lead_form_enabled) {
    addon +=
      '\n\n[Lead capture — PROGRESSIVE mode]: Help the customer first. ' +
      'Once they show real interest or ask to be contacted, call show_lead_form.'
  }

  return addon
}

// ── Tool dispatch ──
// The engine passes any tool call whose name matches a capability tool here.
// Returns either a text result to feed back to the model, or a widget marker
// the front-end acts on (rendered form / media bubble).

export interface CapabilityToolResult {
  // Text the model sees as the tool result.
  toolResult: string
  // Optional side-channel the widget renders (form to show, media to display).
  widget?:
    | { type: 'lead_form'; reason: string; fields: ReturnType<typeof buildLeadFormFields> }
    | { type: 'media'; item: MediaItem }
}

export async function handleCapabilityTool(
  agent: Agent,
  conversationId: string,
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
): Promise<CapabilityToolResult | null> {
  switch (toolName) {
    case 'show_lead_form': {
      if (!agent.lead_form_enabled) {
        return { toolResult: 'Lead form is not enabled for this agent.' }
      }
      return {
        toolResult:
          'The lead form is now shown to the customer. Wait for them to submit it before doing anything else.',
        widget: {
          type: 'lead_form',
          reason: String(input.reason || 'Share your details and our team will reach out.'),
          fields: buildLeadFormFields(agent.lead_form_fields),
        },
      }
    }

    case 'submit_lead': {
      if (!agent.lead_form_enabled) {
        return { toolResult: 'Lead form is not enabled for this agent.' }
      }
      const args: SaveLeadArgs = {
        tenantId: agent.tenant_id,
        agentId: agent.id,
        conversationId,
        firstName: input.first_name,
        lastName: input.last_name,
        phone: input.phone,
        email: input.email,
        companyName: input.company_name,
      }
      const result = await saveLead(args)
      return { toolResult: result }
    }

    case 'send_media': {
      if (!agent.media_enabled) {
        return { toolResult: 'Media is not enabled for this agent.' }
      }
      const item = await resolveMedia(agent.id, String(input.id_or_title || ''))
      if (!item) {
        return {
          toolResult:
            'No matching media found. Tell the customer you\'ll share it shortly and continue.',
        }
      }
      return {
        toolResult: `Sent "${item.title}" to the customer. Add a brief sentence introducing it.`,
        widget: { type: 'media', item },
      }
    }

    default:
      return null // not a capability tool — let the engine handle it
  }
}
