// src/lib/agent/reply-language.ts
//
// Language handling for the agent, as pure functions (no I/O, no model).
//
// Why this exists: the model was never told to mirror the customer's
// language, and every canned line the engine and its callers send on
// their own ("Let me get a team member...", "Sorry, I'm having trouble...")
// was hardcoded English. A customer writing Hinglish got an English
// apology at the worst possible moment.
//
// Three languages are supported because those are what the product's
// customers actually write: English, Hindi in Devanagari, and Hinglish
// (Hindi in Roman letters). Detection is a cheap heuristic, not a
// classifier: it only has to pick the right canned line and give the
// model a hint. The model itself does the real mirroring.

export type ReplyLanguage = 'en' | 'hinglish' | 'hi'

export interface LanguageGuess {
  lang: ReplyLanguage
  /**
   * False for short or ambiguous text ("ok", "thanks", "3pm"), where the
   * guess carries no information and the previous turns should decide.
   */
  confident: boolean
}

// Hindi words written in Roman letters that are not also common English
// words. Deliberately excludes "to", "me", "par", "do", "rate", "sir".
const HINGLISH_WORDS = new Set([
  'hai', 'hain', 'hoon', 'hu', 'tha', 'thi', 'hoga', 'hogi', 'kya', 'kyu', 'kyun', 'kyon',
  'kaise', 'kaisa', 'kab', 'kahan', 'kaha', 'kitna', 'kitne', 'kitni', 'kaun', 'kaunsa',
  'mujhe', 'mera', 'meri', 'mere', 'hamara', 'hamari', 'aap', 'aapka', 'aapki', 'aapke',
  'tum', 'tumhara', 'nahi', 'nahin', 'nhi', 'haan', 'han', 'ji', 'chahiye', 'chahie',
  'karna', 'karni', 'karo', 'karen', 'kijiye', 'kijiyega', 'batao', 'bataiye', 'bataye',
  'bata', 'dikhao', 'dikhaiye', 'bhejo', 'bhejiye', 'paise', 'lagega', 'lagta', 'lagti',
  'abhi', 'aaj', 'kal', 'wala', 'wali', 'wale', 'mein', 'ko', 'ka', 'ki', 'ke', 'se',
  'bhi', 'lekin', 'aur', 'ya', 'accha', 'acha', 'theek', 'thik', 'dard', 'khoon', 'bukhar',
  'saans', 'sans', 'ilaaj', 'dawai', 'dawa', 'sujan', 'sooj', 'chakkar', 'bahut', 'bohot',
  'bahot', 'zyada', 'jyada', 'thoda', 'sirf', 'bas', 'matlab', 'samajh', 'samjha', 'dena',
  'lena', 'dijiye', 'lijiye', 'milega', 'milegi', 'rahi', 'raha', 'rahe', 'dekh',
  'dekhna', 'pata', 'jaldi', 'kripya', 'dhanyavad', 'shukriya', 'namaste', 'bhaiya',
])

const DEVANAGARI = /[ऀ-ॿ]/g

/** Guess the language of one message. */
export function detectLanguage(text: string): LanguageGuess {
  const raw = (text || '').trim()
  if (!raw) return { lang: 'en', confident: false }

  const devanagari = raw.match(DEVANAGARI)
  if (devanagari && devanagari.length >= 2) return { lang: 'hi', confident: true }

  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  let hits = 0
  for (const tok of tokens) if (HINGLISH_WORDS.has(tok)) hits++

  if (hits >= 2 || (hits >= 1 && tokens.length <= 3)) {
    return { lang: 'hinglish', confident: true }
  }
  // English is only a confident call on enough words with no Hindi signal.
  return { lang: 'en', confident: hits === 0 && tokens.length >= 4 }
}

/**
 * The language to reply in: the current message when it is conclusive,
 * otherwise whatever the customer was writing recently (most recent
 * first), otherwise English.
 */
export function resolveLanguage(current: string, priorUserTexts: string[] = []): ReplyLanguage {
  const now = detectLanguage(current)
  if (now.confident) return now.lang
  for (let i = priorUserTexts.length - 1; i >= Math.max(0, priorUserTexts.length - 3); i--) {
    const g = detectLanguage(priorUserTexts[i])
    if (g.confident) return g.lang
  }
  return now.lang
}

/** One block for the system prompt so a small model cannot miss it. */
export function languageInstruction(lang: ReplyLanguage): string {
  const detected =
    lang === 'hi'
      ? 'Hindi in Devanagari script'
      : lang === 'hinglish'
        ? 'Hinglish (Hindi written in Roman letters)'
        : 'English'
  return (
    `\n[Language — follow silently]\n` +
    `Reply in the same language and script as the customer's latest message. ` +
    `English gets English. Hindi in Devanagari gets Hindi in Devanagari. Hindi written in Roman letters (Hinglish) gets Hinglish in Roman letters. ` +
    `If the customer switches language, switch with them. Keep names, prices and medical or product terms exactly as given. ` +
    `The customer's latest message looks like: ${detected}.`
  )
}

// ── Canned lines ─────────────────────────────────────────────────────
//
// Every line the platform sends WITHOUT the model must come from here so
// it follows the customer's language. Wording is gender-neutral on
// purpose (Hindi verbs inflect for the speaker; a bot should not guess).

export type TextKey =
  | 'handoff'
  | 'not_sure_handoff'
  | 'no_info'
  | 'ai_error'
  | 'ai_error_handoff'
  | 'empty_input'
  | 'human_active'
  | 'thanks_team_follow_up'
  | 'unavailable'
  | 'cannot_share'
  | 'slot_offer'
  | 'emergency'
  | 'emergency_with_contact'

type Table = Record<TextKey, Record<ReplyLanguage, string>>

const TEXTS: Table = {
  handoff: {
    en: 'Let me get a team member to help you with this. Someone will be with you shortly.',
    hinglish: 'Hamari team ka ek member isme aapki madad karega, woh jald hi aapse baat karenge.',
    hi: 'हमारी टीम का एक सदस्य इसमें आपकी मदद करेगा, वे जल्द ही आपसे संपर्क करेंगे।',
  },
  not_sure_handoff: {
    en: "I'm not sure about that, so let me get a team member to help you.",
    hinglish: 'Iski pakki jaankari mere paas nahi hai, isliye hamari team ka member aapki madad karega.',
    hi: 'इसकी पक्की जानकारी मेरे पास नहीं है, इसलिए हमारी टीम का सदस्य आपकी मदद करेगा।',
  },
  no_info: {
    en: "I don't have that information right now. Would you like me to connect you with our team?",
    hinglish: 'Iski jaankari mere paas abhi nahi hai. Kya aap chahenge ki hamari team aapse is par baat kare?',
    hi: 'इसकी जानकारी अभी मेरे पास नहीं है। क्या आप चाहेंगे कि हमारी टीम इस पर आपसे बात करे?',
  },
  ai_error: {
    en: "Sorry, I'm having a technical problem right now. Please send your message again in a minute, or our team can help you directly.",
    hinglish: 'Sorry, abhi technical problem aa rahi hai. Kripya ek minute baad apna message dobara bhejiye, ya hamari team seedha aapki madad kar sakti hai.',
    hi: 'क्षमा करें, अभी तकनीकी समस्या आ रही है। कृपया एक मिनट बाद अपना संदेश दोबारा भेजें, या हमारी टीम सीधे आपकी मदद कर सकती है।',
  },
  ai_error_handoff: {
    en: "Sorry, I'm having trouble on my end. A member of our team will get back to you shortly.",
    hinglish: 'Sorry, abhi system mein problem aa rahi hai. Hamari team ka ek member jald hi aapse sampark karega.',
    hi: 'क्षमा करें, अभी सिस्टम में समस्या आ रही है। हमारी टीम का एक सदस्य जल्द ही आपसे संपर्क करेगा।',
  },
  empty_input: {
    en: 'I can only read text messages right now. Could you please type your question?',
    hinglish: 'Abhi sirf text messages padhe ja sakte hain. Kripya apna sawaal type karke bhejiye.',
    hi: 'अभी केवल टेक्स्ट संदेश पढ़े जा सकते हैं। कृपया अपना प्रश्न लिखकर भेजें।',
  },
  human_active: {
    en: 'Our team has your message and will reply here shortly.',
    hinglish: 'Hamari team ko aapka message mil gaya hai, woh yahin jald reply karenge.',
    hi: 'हमारी टीम को आपका संदेश मिल गया है, वे यहीं जल्द उत्तर देंगे।',
  },
  thanks_team_follow_up: {
    en: 'Thanks for reaching out! Someone from our team will get back to you shortly.',
    hinglish: 'Sampark karne ke liye shukriya! Hamari team ka koi member jald hi aapse baat karega.',
    hi: 'संपर्क करने के लिए धन्यवाद! हमारी टीम का कोई सदस्य जल्द ही आपसे बात करेगा।',
  },
  unavailable: {
    en: 'This assistant is not available right now. Please contact the business directly.',
    hinglish: 'Yeh assistant abhi available nahi hai. Kripya business se seedha sampark kijiye.',
    hi: 'यह सहायक अभी उपलब्ध नहीं है। कृपया सीधे व्यवसाय से संपर्क करें।',
  },
  cannot_share: {
    en: "Sorry, I can't share that. I'm happy to help with questions about our services though.",
    hinglish: 'Sorry, yeh share nahi kiya ja sakta. Hamari services ke baare mein koi bhi sawaal pooch sakte hain.',
    hi: 'क्षमा करें, यह साझा नहीं किया जा सकता। हमारी सेवाओं के बारे में आप कोई भी प्रश्न पूछ सकते हैं।',
  },
  // {label} is filled by the caller, e.g. "Tuesday 12/8 at 10 AM".
  slot_offer: {
    en: 'Our next available slot is {label}. Would you like me to hold that for you, or would another time suit you better?',
    hinglish: 'Hamara agla available slot {label} hai. Kya aap chahenge ki yeh aapke liye rakha jaye, ya koi aur time theek rahega?',
    hi: 'हमारा अगला उपलब्ध समय {label} है। क्या आप चाहेंगे कि यह आपके लिए रखा जाए, या कोई और समय ठीक रहेगा?',
  },
  emergency: {
    en: "This sounds urgent. Please call your local emergency services (112 in India) or go to the nearest hospital right now. I'm alerting our team so they can reach out to you.",
    hinglish: 'Yeh urgent lag raha hai. Kripya abhi turant apni local emergency service (India mein 112) ko call kijiye ya najdeeki hospital jaiye. Hamari team ko abhi alert kiya ja raha hai.',
    hi: 'यह जरूरी लग रहा है। कृपया अभी तुरंत अपनी स्थानीय आपातकालीन सेवा (भारत में 112) को कॉल करें या नज़दीकी अस्पताल जाएँ। हमारी टीम को अभी सूचित किया जा रहा है।',
  },
  // {contact} is the business's own number or address line.
  emergency_with_contact: {
    en: "This sounds urgent. Please contact us right now on {contact}, or call your local emergency services (112 in India). I'm alerting our team so they can reach out to you.",
    hinglish: 'Yeh urgent lag raha hai. Kripya abhi turant hamein {contact} par sampark kijiye, ya apni local emergency service (India mein 112) ko call kijiye. Hamari team ko abhi alert kiya ja raha hai.',
    hi: 'यह जरूरी लग रहा है। कृपया अभी तुरंत हमसे {contact} पर संपर्क करें, या अपनी स्थानीय आपातकालीन सेवा (भारत में 112) को कॉल करें। हमारी टीम को अभी सूचित किया जा रहा है।',
  },
}

/** A canned line in the customer's language. {placeholders} come from `vars`. */
export function t(key: TextKey, lang: ReplyLanguage = 'en', vars: Record<string, string> = {}): string {
  const line = TEXTS[key]?.[lang] ?? TEXTS[key]?.en ?? ''
  return line.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? '')
}

/** The calm "contact the business / emergency services now" message. */
export function emergencyReply(lang: ReplyLanguage, contact: string | null | undefined): string {
  const c = (contact ?? '').trim()
  return c ? t('emergency_with_contact', lang, { contact: c }) : t('emergency', lang)
}
