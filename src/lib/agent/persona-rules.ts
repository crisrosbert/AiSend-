// src/lib/agent/persona-rules.ts
//
// The ONE wording of "what a health-business assistant may and may not say".
//
// Why it exists: the clinic persona said "You must NEVER give medical advice
// ... for any medical question say the doctor will answer". The assistant
// took that literally and refused ordinary questions its own FAQ answers
// ("What does gynecomastia surgery involve?" -> "I can't provide specific
// details about the procedure"). A patient who gets no answer to a general
// question leaves.
//
// The line that matters is PERSONAL versus GENERAL:
//   general  = what a procedure is, who it is usually for, the usual steps,
//              the FAQs the clinic itself published. Allowed, from the
//              knowledge base only.
//   personal = diagnosis, "is it safe for me", medicines, prices that are not
//              in the knowledge base, promised results. Never.
//
// Used by: templates.ts (Clinic Front Desk), quick-setup/prompt.ts (clinic
// preset), api/agent/train-from-url/route.ts (drafted persona).
// safety.ts holds the matching engine-level rule, which cannot be removed by
// a persona.

/** First line of the block. Also how we tell it is already there. */
export const HEALTH_RULES_MARKER = 'Medical information rules:'

/** Persona lines that told the model to refuse every medical question. */
const OVER_STRICT_LINE =
  /(?:never|do not|don'?t)\s+(?:give|provide|offer|share)\s+(?:any\s+)?medical\s+(?:advice|information|details)|for any medical question|any medical question|can'?t provide (?:specific )?details/i

export function healthPersonaRules(phone?: string | null): string {
  const call = phone && phone.trim() ? `call the clinic on ${phone.trim()} or 112` : 'contact the clinic directly or call 112'
  return [
    HEALTH_RULES_MARKER,
    '- You MAY explain, in general terms, what a procedure or treatment is, who it is usually for, the usual steps and recovery stages, and answer the clinic\'s own FAQs. Always call search_knowledge_base first and use only what it returns. Use cautious words such as "usually" and "the doctor will confirm".',
    '- You must NEVER give personal medical advice: do not diagnose, do not say what a symptom, scar, photo or report means, do not say whether a procedure is safe or suitable for this person, do not suggest, start, stop or change any medicine, and do not guess prices. Say the doctor will assess them at a consultation and offer to book one.',
    '- Never promise or guarantee results.',
    '- If the knowledge base has nothing on a question, say "I don\'t have that information" and offer to connect them with the team. Do not refuse a general question just because it is about medicine.',
    `- Emergencies (heavy bleeding, chest pain, trouble breathing, fainting, severe pain, a bad reaction after a procedure): tell them calmly to ${call} right now, then hand over to the team. Do not book and do not advise.`,
  ].join('\n')
}

/**
 * Tidy a model-drafted persona for a health business: drop any line that
 * tells the assistant to refuse every medical question, and add the standard
 * block once. Anything else in the draft is left alone. An empty draft stays
 * empty (a failed draft must never replace the owner's wording).
 */
export function finishHealthPersona(persona: string, opts: { phone?: string | null } = {}): string {
  const text = (persona ?? '').trim()
  if (!text) return ''
  const kept = text
    .split('\n')
    .filter((line) => !OVER_STRICT_LINE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (kept.includes(HEALTH_RULES_MARKER)) return kept
  return `${kept}\n\n${healthPersonaRules(opts.phone)}`
}
