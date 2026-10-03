// src/lib/agent/engine-capabilities.ts
//
// The capability layer that turns one engine into many agents on WhatsApp.
// It matches engine.ts conventions exactly: tools are LLMTool (name +
// parameters), tool handlers return a plain string result, and media is
// returned as a side-channel item so flow-engine can send it as a separate
// WhatsApp media message.
//
// engine.ts calls, per turn:
//   loadAgent(agentId)            -> capability flags + persona source
//   buildAgentSystemAddon(agent)  -> media catalog + lead-capture rules
//   buildAgentTools(agent)        -> extra LLMTools gated by flags
//   handleCapabilityTool(...)     -> executes submit_lead / send_media
//
// Nothing here is agent-specific — behaviour is data (the agents row).
//
// Depends on:
//   ./tools/lead-form-tools  (saveLead)
//   ./tools/media-tools      (getAgentMedia, describeMediaForPrompt, resolveMedia, MediaItem)

import { createClient } from '@supabase/supabase-js'
import type { LLMTool } from '@/lib/agent/llm-provider'
import { saveLead, buildLeadFormFields, type SaveLeadArgs } from '@/lib/agent/tools/lead-form-tools'
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

// ── The agent record (mirrors the agents table from migration 022) ──
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

// Load an agent by id. Returns null if not found / inactive so the engine
// falls back to its original always-on tool set (backward compatible).
export async function loadAgent(agentId: string): Promise<Agent | null> {
  try {
    const { data, error } = await db()
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('is_active', true)
      .maybeSingle()
    if (error || !data) return null
    return data as Agent
  } catch (err) {
    console.error('[engine/caps] loadAgent error:', err)
    return null
  }
}

// ── Capability tools (LLMTool format — same shape as engine.ts TOOLS) ──

// On the web widget there IS a form UI, so the AI calls show_lead_form and the
// widget renders the fields. On WhatsApp there is no form, so lead capture is
// conversational via submit_lead. Both tools are exposed when lead capture is
// on; the AI picks the right one guided by the system-prompt addon.
const SHOW_LEAD_FORM_TOOL: LLMTool = {
  name: 'show_lead_form',
  description:
    'Display a short contact form in the chat widget to collect the customer\'s details. ' +
    'Use this on the web chat widget when the customer shows interest or asks to be contacted. ' +
    'Do NOT also ask for the same fields in text. (If you are on a channel without a form UI, ' +
    'such as WhatsApp, collect the details conversationally and use submit_lead instead.)',
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description:
          'One short sentence shown above the form, e.g. "Share your details and our team will call you back."',
      },
    },
    required: [],
  },
}

// On WhatsApp there is no rendered form, so lead capture is conversational:
// the AI collects the fields in chat (phone we usually already have) and then
// calls submit_lead to persist them.
const SUBMIT_LEAD_TOOL: LLMTool = {
  name: 'submit_lead',
  description:
    'Save the customer as a lead once you have collected their details in the chat. ' +
    'Collect at least a name and one contact (phone or email) before calling. ' +
    'The phone number is often already known from WhatsApp — still pass it if the customer gives a different one.',
  parameters: {
    type: 'object',
    properties: {
      first_name: { type: 'string', description: 'Customer first name' },
      last_name: { type: 'string', description: 'Customer last name (optional)' },
      phone: { type: 'string', description: 'Contact phone number' },
      email: { type: 'string', description: 'Email address' },
      company_name: { type: 'string', description: 'Company name (B2B only)' },
    },
    required: ['first_name'],
  },
}

const SEND_MEDIA_TOOL: LLMTool = {
  name: 'send_media',
  description:
    'Send an image, PDF, brochure, or video to the customer. Pass the media id (preferred) ' +
    'or an exact title from the available-media list in your context. Only send media that is ' +
    'genuinely relevant to what the customer asked.',
  parameters: {
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

// Extra tools an agent is allowed to use, gated by its flags.
export function buildAgentTools(agent: Agent): LLMTool[] {
  const tools: LLMTool[] = []
  if (agent.lead_form_enabled) {
    tools.push(SHOW_LEAD_FORM_TOOL) // web widget: rendered form
    tools.push(SUBMIT_LEAD_TOOL) // WhatsApp: conversational capture
  }
  if (agent.media_enabled) tools.push(SEND_MEDIA_TOOL)
  return tools
}

// Extra system-prompt text appended after the persona/override:
//   - the media catalog (so the AI knows what it can send)
//   - lead-capture instructions (gate vs progressive)
export async function buildAgentSystemAddon(agent: Agent): Promise<string> {
  let addon = ''

  if (agent.media_enabled) {
    const media = await getAgentMedia(agent.id)
    addon += describeMediaForPrompt(media)
  }

  if (agent.lead_form_enabled) {
    const wanted = agent.lead_form_fields?.length
      ? agent.lead_form_fields.join(', ')
      : 'first_name, phone'
    if (agent.lead_form_mode === 'gate') {
      addon +=
        `\n\n[Lead capture — GATE mode]: Early in the conversation, warmly ask for the customer's ` +
        `details (${wanted}) before going deep. Once you have them, call submit_lead. ` +
        `Ask naturally, one or two fields at a time — never dump a form.`
    } else {
      addon +=
        `\n\n[Lead capture — PROGRESSIVE mode]: Help the customer first. Once they show real ` +
        `interest or ask to be contacted, collect their details (${wanted}) conversationally and ` +
        `call submit_lead. Ask one or two fields at a time — never dump a form.`
    }
  }

  return addon
}

// ── Tool dispatch ──
// Returns a string result (fed back to the model) plus, for send_media, the
// resolved media item the engine hands to flow-engine to deliver on WhatsApp.
// The fields the web widget should render for a lead form.
export interface LeadFormSpec {
  reason: string
  fields: ReturnType<typeof buildLeadFormFields>
}

export interface CapabilityToolOutput {
  result: string
  media?: MediaItem
  leadForm?: LeadFormSpec
}

export async function handleCapabilityTool(
  agent: Agent,
  conversationId: string,
  customerPhone: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
): Promise<CapabilityToolOutput | null> {
  switch (toolName) {
    case 'show_lead_form': {
      if (!agent.lead_form_enabled) {
        return { result: 'Lead capture is not enabled for this agent.' }
      }
      return {
        result:
          'The contact form is now shown to the customer. Wait for them to submit it before continuing.',
        leadForm: {
          reason: str(toolArgs.reason) || 'Share your details and our team will reach out.',
          fields: buildLeadFormFields(agent.lead_form_fields),
        },
      }
    }

    case 'submit_lead': {
      if (!agent.lead_form_enabled) {
        return { result: 'Lead capture is not enabled for this agent.' }
      }
      const leadArgs: SaveLeadArgs = {
        tenantId: agent.tenant_id,
        agentId: agent.id,
        conversationId,
        firstName: str(toolArgs.first_name),
        lastName: str(toolArgs.last_name),
        // fall back to the WhatsApp number if the AI didn't collect a new one
        phone: str(toolArgs.phone) || customerPhone,
        email: str(toolArgs.email),
        companyName: str(toolArgs.company_name),
      }
      const result = await saveLead(leadArgs)
      return { result }
    }

    case 'send_media': {
      if (!agent.media_enabled) {
        return { result: 'Media is not enabled for this agent.' }
      }
      const item = await resolveMedia(agent.id, str(toolArgs.id_or_title) ?? '')
      if (!item) {
        return {
          result:
            "No matching media found. Tell the customer you'll share it shortly and continue.",
        }
      }
      return {
        result: `Sent "${item.title}" to the customer. Add one short sentence introducing it.`,
        media: item,
      }
    }

    default:
      return null // not a capability tool — let the engine handle it
  }
}

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  const s = String(v).trim()
  return s.length ? s : undefined
}
