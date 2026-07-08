// src/lib/agent/tools/lead-form-tools.ts
//
// Lets the AI show a lead-capture form and save submissions to the leads
// table. The form is AI-triggered (show_lead_form tool) so it appears at
// the right moment — either up front (gate mode) or after interest
// (progressive mode), controlled per-agent.
//
// Used by: src/lib/agent/engine.ts

import { createClient } from '@supabase/supabase-js'

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

export interface SaveLeadArgs {
  tenantId: string
  agentId: string
  conversationId: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  companyName?: string
  extra?: Record<string, unknown>
}

export async function saveLead(args: SaveLeadArgs): Promise<string> {
  try {
    const { error } = await db().from('leads').insert({
      tenant_id: args.tenantId,
      agent_id: args.agentId,
      conversation_id: args.conversationId,
      first_name: args.firstName || null,
      last_name: args.lastName || null,
      phone: args.phone || null,
      email: args.email || null,
      company_name: args.companyName || null,
      extra: args.extra || {},
      status: 'new',
    })

    if (error) {
      console.error('[lead-form] save error:', error)
      return 'LEAD_SAVE_FAILED: Could not save the details. Ask the customer to try again or share their details in chat.'
    }

    return 'Lead saved successfully. Thank the customer warmly by name and tell them the team will reach out shortly.'
  } catch (err) {
    console.error('[lead-form] error:', err)
    return 'LEAD_SAVE_FAILED: A technical error occurred.'
  }
}

export function buildLeadFormFields(
  fields: string[],
): Array<{ key: string; label: string; type: string; required: boolean }> {
  const FIELD_DEFS: Record<string, { label: string; type: string }> = {
    first_name:   { label: 'First Name',      type: 'text' },
    last_name:    { label: 'Last Name',        type: 'text' },
    phone:        { label: 'Mobile Number',    type: 'tel' },
    email:        { label: 'Business Email',   type: 'email' },
    company_name: { label: 'Company Name',     type: 'text' },
  }

  return fields.map((f) => ({
    key:      f,
    label:    FIELD_DEFS[f]?.label || f,
    type:     FIELD_DEFS[f]?.type || 'text',
    required: true,
  }))
}
