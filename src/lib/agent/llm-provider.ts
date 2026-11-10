// src/lib/agent/llm-provider.ts
//
// Pluggable LLM provider. Switch between OpenAI and Gemini with one
// env var: LLM_PROVIDER = 'openai' | 'gemini'  (defaults to openai).
//
// The engine calls callLLM() and gets back a common shape, regardless
// of which provider is active. To add Groq/Claude later, add an adapter
// here — the engine never changes.
//
// This file is the ONE source of truth for provider, model and key
// checks. The engine must ask it (activeProvider / activeModel /
// hasProviderKey / providerConfigIssue) and never read LLM_PROVIDER itself.

// ── Common types (provider-agnostic) ──

export interface LLMTool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
}

export interface LLMMessage {
  role: 'user' | 'model'
  text: string
}

export interface LLMToolCall {
  name: string
  args: Record<string, unknown>
}

// A "turn" in the running conversation that may include tool calls/results
export interface LLMTurn {
  role: 'user' | 'model' | 'tool'
  text?: string
  toolCall?: LLMToolCall
  toolResult?: { name: string; result: string }
}

export interface LLMResponse {
  text: string
  toolCall: LLMToolCall | null
  tokens: number
}

/**
 * Hard ceiling on one model call. The fetch used to have no timeout, so a
 * hung provider held the webhook function open until the platform killed
 * it, and the customer never got a reply.
 */
export const LLM_TIMEOUT_MS = 20_000

// ── Public entry point ──

/**
 * Which provider serves this deployment.
 *
 * OpenAI is the default. The default used to be Gemini, which meant a
 * deployment that simply forgot to set LLM_PROVIDER silently ran on a
 * provider nobody had chosen — and, since the key check is done per
 * provider, could report "no API key" while a perfectly good
 * OPENAI_API_KEY sat in the environment.
 *
 * One exported reader rather than three inlined `process.env` reads,
 * because they had already drifted: the engine defaulted one way and
 * logged a hardcoded Gemini model name regardless of what actually ran.
 *
 * A value that is not "openai" or "gemini" still resolves to the default
 * here (a typo must not crash the module), but providerConfigIssue()
 * reports it so the engine can log it loudly.
 */
export function activeProvider(): 'openai' | 'gemini' {
  return (process.env.LLM_PROVIDER || 'openai').toLowerCase() === 'gemini'
    ? 'gemini'
    : 'openai'
}

/** The model that will actually serve a call, for logging and display. */
export function activeModel(): string {
  return activeProvider() === 'gemini'
    ? process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
    : process.env.OPENAI_MODEL || 'gpt-4o-mini'
}

/** Is the key for the active provider present? */
export function hasProviderKey(): boolean {
  return activeProvider() === 'gemini'
    ? !!process.env.GEMINI_API_KEY
    : !!process.env.OPENAI_API_KEY
}

/**
 * A human-readable problem with the provider configuration, or null.
 *
 * Two cases the old code handled by staying quiet:
 *   • LLM_PROVIDER set to something unrecognised ("gemni", "claude")
 *   • no API key for the provider that will actually be used
 *
 * The engine logs this at error level on every affected call so it
 * shows up in the deployment logs, instead of the customer-facing
 * symptom (silence or an apology on every message) being the only clue.
 * Never includes a key value.
 */
export function providerConfigIssue(): string | null {
  const raw = (process.env.LLM_PROVIDER ?? '').trim()
  const lowered = raw.toLowerCase()
  if (raw && lowered !== 'openai' && lowered !== 'gemini') {
    return `LLM_PROVIDER="${raw}" is not valid (use "openai" or "gemini"); using the default "${activeProvider()}"`
  }
  if (!hasProviderKey()) {
    const keyName = activeProvider() === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'
    return `${keyName} is not set but provider "${activeProvider()}" is active`
  }
  return null
}

export type LLMErrorKind = 'config' | 'transient'

/**
 * Is this failure something a retry could fix?
 *
 * 'config': missing key, 401/403 (bad key), 404 (bad model name). Retrying
 *           or apologising again changes nothing; a human has to fix it.
 * 'transient': timeouts, network errors, 429, 5xx, anything else.
 *
 * Works on the error text produced by the adapters below
 * ("<Provider> API <status>: ...", "<KEY> not set"), so it is independent
 * of which model a caller asked for through CallOptions.
 */
export function classifyLLMError(err: unknown): LLMErrorKind {
  const msg = err instanceof Error ? err.message : String(err)
  if (/API_KEY not set/i.test(msg)) return 'config'
  const m = msg.match(/API (\d{3})/)
  if (m) {
    const status = Number(m[1])
    if (status === 401 || status === 403 || status === 404) return 'config'
  }
  return 'transient'
}

export interface CallOptions {
  /** Use this model instead of the deployment default (same provider). */
  model?: string
}

export async function callLLM(
  systemPrompt: string,
  turns: LLMTurn[],
  tools: LLMTool[],
  options: CallOptions = {},
): Promise<LLMResponse> {
  if (activeProvider() === 'gemini') {
    return callGemini(systemPrompt, turns, tools, options.model)
  }
  return callOpenAI(systemPrompt, turns, tools, options.model)
}

// ════════════════════════════════════════════════════════════
// GEMINI ADAPTER
// ════════════════════════════════════════════════════════════

async function callGemini(
  systemPrompt: string,
  turns: LLMTurn[],
  tools: LLMTool[],
  modelOverride?: string,
): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const model = modelOverride || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'

  // Convert common turns → Gemini "contents" format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = []
  for (const t of turns) {
    if (t.role === 'tool' && t.toolResult) {
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: t.toolResult.name,
            response: { result: t.toolResult.result },
          },
        }],
      })
    } else if (t.toolCall) {
      contents.push({
        role: 'model',
        parts: [{ functionCall: { name: t.toolCall.name, args: t.toolCall.args } }],
      })
    } else {
      contents.push({
        role: t.role === 'model' ? 'model' : 'user',
        parts: [{ text: t.text || '' }],
      })
    }
  }

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: [{ function_declarations: tools }],
    generation_config: { temperature: 0.3, max_output_tokens: 600 },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    },
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const tokens = data?.usageMetadata?.totalTokenCount ?? 0

  for (const part of parts) {
    if (part.functionCall?.name) {
      return {
        text: '',
        toolCall: { name: part.functionCall.name, args: part.functionCall.args ?? {} },
        tokens,
      }
    }
  }

  const text = parts.map((p: { text?: string }) => p.text ?? '').join('')
  return { text, toolCall: null, tokens }
}

// ════════════════════════════════════════════════════════════
// OPENAI ADAPTER
// ════════════════════════════════════════════════════════════

async function callOpenAI(
  systemPrompt: string,
  turns: LLMTurn[],
  tools: LLMTool[],
  modelOverride?: string,
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const model = modelOverride || process.env.OPENAI_MODEL || 'gpt-4o-mini'

  // Convert common turns → OpenAI messages format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: 'system', content: systemPrompt }]

  for (const t of turns) {
    if (t.role === 'tool' && t.toolResult) {
      messages.push({
        role: 'tool',
        tool_call_id: t.toolResult.name,
        content: t.toolResult.result,
      })
    } else if (t.toolCall) {
      messages.push({
        role: 'assistant',
        tool_calls: [{
          id: t.toolCall.name,
          type: 'function',
          function: { name: t.toolCall.name, arguments: JSON.stringify(t.toolCall.args) },
        }],
      })
    } else {
      messages.push({
        role: t.role === 'model' ? 'assistant' : 'user',
        content: t.text || '',
      })
    }
  }

  // Convert common tools → OpenAI tools format
  const openaiTools = tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))

  const body = {
    model,
    messages,
    tools: openaiTools,
    temperature: 0.3,
    max_tokens: 600,
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const choice = data?.choices?.[0]?.message
  const tokens = data?.usage?.total_tokens ?? 0

  // Tool call?
  const tc = choice?.tool_calls?.[0]
  if (tc?.function?.name) {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(tc.function.arguments || '{}')
    } catch {
      args = {}
    }
    return { text: '', toolCall: { name: tc.function.name, args }, tokens }
  }

  return { text: choice?.content ?? '', toolCall: null, tokens }
}
