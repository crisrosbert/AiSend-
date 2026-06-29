// src/lib/agent/llm-provider.ts
//
// Pluggable LLM provider. Switch between Gemini and OpenAI with one
// env var: LLM_PROVIDER = 'gemini' | 'openai'  (defaults to gemini).
//
// The engine calls callLLM() and gets back a common shape, regardless
// of which provider is active. To add Groq/Claude later, add an adapter
// here — the engine never changes.

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

// ── Public entry point ──

export async function callLLM(
  systemPrompt: string,
  turns: LLMTurn[],
  tools: LLMTool[],
): Promise<LLMResponse> {
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase()

  if (provider === 'openai') {
    return callOpenAI(systemPrompt, turns, tools)
  }
  return callGemini(systemPrompt, turns, tools)
}

// ════════════════════════════════════════════════════════════
// GEMINI ADAPTER
// ════════════════════════════════════════════════════════════

async function callGemini(
  systemPrompt: string,
  turns: LLMTurn[],
  tools: LLMTool[],
): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'

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
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
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
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

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
