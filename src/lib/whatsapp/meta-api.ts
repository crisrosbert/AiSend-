/**
 * Meta WhatsApp Cloud API helpers.
 *
 * Every function takes a single options object (named parameters) instead
 * of positional arguments. This was a deliberate choice after the same
 * swapped-args bug was found four times in a row with the positional form
 * (e.g. `(accessToken, phoneNumberId)` vs `(phoneNumberId, accessToken)`).
 * With named params, a typo surfaces immediately as a TypeScript error
 * instead of a runtime rejection from Meta.
 */

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export interface MetaSendResult {
  messageId: string
}

export interface MetaPhoneInfo {
  id: string
  display_phone_number: string
  verified_name?: string
  quality_rating?: string
}

interface MetaErrorResponse {
  error?: { message?: string; code?: number; type?: string }
}

async function throwMetaError(response: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const data = (await response.json()) as MetaErrorResponse
    if (data.error?.message) message = data.error.message
  } catch {
    // response body wasn't JSON — keep the fallback
  }
  throw new Error(message)
}

// ============================================================
// Phone number / account
// ============================================================

export interface VerifyPhoneNumberArgs {
  phoneNumberId: string
  accessToken: string
}

/**
 * Verify a Meta phone number ID by fetching its public metadata
 * (display_phone_number, verified_name, quality_rating).
 */
export async function verifyPhoneNumber(
  args: VerifyPhoneNumberArgs
): Promise<MetaPhoneInfo> {
  const { phoneNumberId, accessToken } = args
  const url = `${META_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  return response.json()
}

// ============================================================
// Sending
// ============================================================

export interface SendTextMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
  /** Meta's message_id of the message being replied to. Adds a `context` field
   *  so WhatsApp renders the new message as a reply with a quote preview. */
  contextMessageId?: string
}

/**
 * Send a free-form WhatsApp text message.
 * Only works inside the 24-hour customer service window.
 */
export async function sendTextMessage(
  args: SendTextMessageArgs
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, text, contextMessageId } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }
  const response = await metaFetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
    'text message',
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

export interface SendTemplateMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  language?: string
  params?: string[]
  /** Meta's message_id of the message being replied to. */
  contextMessageId?: string
}

/**
 * Send a pre-approved WhatsApp message template. Required outside
 * the 24-hour window and for any first-touch messaging.
 */
// ============================================================
// Rate limiting
// ============================================================

/**
 * Send to Meta, retrying when Meta says to slow down.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────
 * Meta's Cloud API does not ban a number for sending quickly — the
 * documented default throughput is 80 messages per second. What it does
 * is answer 429 (or error code 4 / 80007, "too many calls") and expect
 * the caller to back off.
 *
 * Without that, a 429 arrived at the broadcast loop as an ordinary
 * failure: the recipient was marked failed, permanently, and never
 * retried. On a large campaign that turns a momentary slowdown into a
 * block of people who simply never received the message, with a report
 * saying they failed.
 *
 * Three attempts, doubling from one second, honouring Retry-After when
 * Meta sends it. Short enough to stay inside the route's time budget,
 * long enough to ride out the throttling Meta actually applies.
 *
 * Only 429s and 5xx are retried. A 400 means the request is wrong and
 * sending it again just wastes the customer's credit.
 */
const RETRY_ATTEMPTS = 3
const RETRY_BASE_MS = 1000

function isRetryable(status: number, payload: unknown): boolean {
  if (status === 429) return true
  if (status >= 500) return true
  // Meta also signals throttling inside a 400 body on some endpoints.
  const code = (payload as { error?: { code?: number } })?.error?.code
  return code === 4 || code === 80007 || code === 130429
}

async function metaFetchWithRetry(
  url: string,
  init: RequestInit,
  label: string,
): Promise<Response> {
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    const response = await fetch(url, init)
    if (response.ok) return response

    // Clone before reading: the caller still needs the body to build a
    // useful error if this turns out to be the final attempt.
    const payload = await response.clone().json().catch(() => ({}))

    if (!isRetryable(response.status, payload) || attempt === RETRY_ATTEMPTS - 1) {
      return response
    }

    // Meta's own number first. It knows when it will accept traffic
    // again better than any backoff curve we invent.
    const retryAfter = Number(response.headers.get('retry-after'))
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 10_000)
        : RETRY_BASE_MS * 2 ** attempt

    console.warn(
      `[meta] ${label} throttled (${response.status}), retrying in ${waitMs}ms ` +
        `(attempt ${attempt + 1}/${RETRY_ATTEMPTS})`,
    )
    await new Promise((r) => setTimeout(r, waitMs))
    lastResponse = response
  }

  return lastResponse!
}

export async function sendTemplateMessage(
  args: SendTemplateMessageArgs
): Promise<MetaSendResult> {
  const {
    phoneNumberId,
    accessToken,
    to,
    templateName,
    language = 'en_US',
    params,
    contextMessageId,
  } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`

  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: language },
  }

  if (params && params.length > 0) {
    template.components = [
      {
        type: 'body',
        parameters: params.map((p) => ({ type: 'text', text: String(p) })),
      },
    ]
  }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template,
  }
  if (contextMessageId) {
    body.context = { message_id: contextMessageId }
  }

  const response = await metaFetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
    `template ${templateName}`,
  )
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

// ============================================================
// Reactions
// ============================================================

export interface SendReactionMessageArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  /** Meta's message_id of the message being reacted to. */
  targetMessageId: string
  /** Single emoji, or empty string to remove an existing reaction. */
  emoji: string
}

/**
 * Send a reaction (or removal) to a previously-exchanged message.
 * Empty `emoji` removes the reaction per Meta's spec.
 */
export async function sendReactionMessage(
  args: SendReactionMessageArgs
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, targetMessageId, emoji } = args
  const url = `${META_API_BASE}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: { message_id: targetMessageId, emoji },
    }),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

// ============================================================
// Media
// ============================================================

export interface GetMediaUrlArgs {
  mediaId: string
  accessToken: string
}

/**
 * Resolve a media ID to Meta's (short-lived, authenticated) CDN URL
 * plus the MIME type. Step one of the media-proxy flow.
 */
export async function getMediaUrl(
  args: GetMediaUrlArgs
): Promise<{ url: string; mimeType: string }> {
  const { mediaId, accessToken } = args
  const response = await fetch(`${META_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await throwMetaError(response, `Media fetch failed: ${response.status}`)
  }
  const data = await response.json()
  if (!data.url) throw new Error('Media URL not found in Meta response')
  return { url: data.url, mimeType: data.mime_type || 'application/octet-stream' }
}

export interface DownloadMediaArgs {
  downloadUrl: string
  accessToken: string
}

/**
 * Fetch the binary bytes for a media URL obtained from getMediaUrl.
 * Step two of the media-proxy flow.
 */
export async function downloadMedia(
  args: DownloadMediaArgs
): Promise<{ buffer: Buffer; contentType: string }> {
  const { downloadUrl, accessToken } = args
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Media download failed: ${response.status}`)
  }
  const contentType =
    response.headers.get('content-type') || 'application/octet-stream'
  const buffer = Buffer.from(await response.arrayBuffer())
  return { buffer, contentType }
}

// ============================================================
// Message templates — create / submit for approval
// ============================================================

export interface CreateTemplateArgs {
  wabaId: string
  accessToken: string
  name: string
  /** Meta category: MARKETING | UTILITY | AUTHENTICATION */
  category: string
  /** Meta language code, e.g. en_US, hi */
  language: string
  bodyText: string
  /** Plain-text header. Mutually exclusive with headerMediaFormat. */
  headerText?: string
  /** IMAGE | VIDEO | DOCUMENT — set together with headerMediaHandle. */
  headerMediaFormat?: 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  /** A handle from uploadProfilePhoto(), used as Meta's review sample for the header. */
  headerMediaHandle?: string
  footerText?: string
}

export interface CreateTemplateResult {
  id: string
  status: string
  category: string
}

/**
 * Count {{1}}, {{2}} … placeholders in a string and return the highest
 * index used. Meta requires example values for every placeholder in a
 * template body at submit time, or it rejects with a 2388xxx error.
 */
function maxPlaceholder(text: string): number {
  let max = 0
  const re = /\{\{\s*(\d+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10)
    if (n > max) max = n
  }
  return max
}

/**
 * Submit a new message template to Meta for approval. Mirrors the manual
 * Graph API call (POST /{waba_id}/message_templates) so clients never
 * touch the Meta dashboard — an in-app "create template" experience.
 *
 * Returns Meta's template id + status (usually PENDING; library-derived
 * or trivially-safe templates may come back APPROVED immediately).
 */
export async function createTemplate(
  args: CreateTemplateArgs
): Promise<CreateTemplateResult> {
  const {
    wabaId,
    accessToken,
    name,
    category,
    language,
    bodyText,
    headerText,
    headerMediaFormat,
    headerMediaHandle,
    footerText,
  } = args

  const url = `${META_API_BASE}/${wabaId}/message_templates`

  const components: Record<string, unknown>[] = []

  if (headerMediaFormat && headerMediaHandle) {
    // Media headers take no header text — the handle is only a sample
    // for Meta's reviewers; the real image/video/doc is supplied per
    // send, via the `link` on that message's header component.
    components.push({
      type: 'HEADER',
      format: headerMediaFormat,
      example: { header_handle: [headerMediaHandle] },
    })
  } else if (headerText && headerText.trim()) {
    components.push({
      type: 'HEADER',
      format: 'TEXT',
      text: headerText.trim(),
    })
  }

  // Body is required. If it has {{n}} placeholders, Meta wants an
  // example array with one sample value per placeholder.
  const bodyComponent: Record<string, unknown> = {
    type: 'BODY',
    text: bodyText,
  }
  const placeholderCount = maxPlaceholder(bodyText)
  if (placeholderCount > 0) {
    bodyComponent.example = {
      body_text: [
        Array.from({ length: placeholderCount }, (_, i) => `Sample${i + 1}`),
      ],
    }
  }
  components.push(bodyComponent)

  if (footerText && footerText.trim()) {
    components.push({
      type: 'FOOTER',
      text: footerText.trim(),
    })
  }

  const payload = {
    name: name.trim().toLowerCase().replace(/\s+/g, '_'),
    category: category.toUpperCase(),
    language,
    components,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }

  const data = await response.json()
  return {
    id: data.id,
    status: data.status ?? 'PENDING',
    category: data.category ?? category.toUpperCase(),
  }
}

// ============================================================
// Business profile — read / update (logo, about, website, etc.)
// ============================================================

export interface BusinessProfile {
  about?: string
  address?: string
  description?: string
  email?: string
  vertical?: string            // Meta's business category
  websites?: string[]
  profile_picture_url?: string
}

export interface GetBusinessProfileArgs {
  phoneNumberId: string
  accessToken: string
}

/**
 * Read the WhatsApp Business Profile for a phone number (about, address,
 * description, email, category/vertical, websites, profile picture URL).
 */
export async function getBusinessProfile(
  args: GetBusinessProfileArgs,
): Promise<BusinessProfile> {
  const { phoneNumberId, accessToken } = args
  const fields =
    'about,address,description,email,vertical,websites,profile_picture_url'
  const url = `${META_API_BASE}/${phoneNumberId}/whatsapp_business_profile?fields=${fields}`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  // Meta returns { data: [ { ...profile } ] }
  const profile = Array.isArray(data?.data) ? data.data[0] ?? {} : {}
  return profile as BusinessProfile
}

export interface UpdateBusinessProfileArgs {
  phoneNumberId: string
  accessToken: string
  about?: string
  address?: string
  description?: string
  email?: string
  vertical?: string
  websites?: string[]
  /** A media handle returned by uploadProfilePhoto(), to set the avatar. */
  profilePictureHandle?: string
}

/**
 * Update text fields of the business profile (and optionally the photo,
 * via a pre-uploaded media handle). All fields optional — only provided
 * keys are sent.
 */
export async function updateBusinessProfile(
  args: UpdateBusinessProfileArgs,
): Promise<{ success: boolean }> {
  const { phoneNumberId, accessToken, profilePictureHandle, ...fields } = args

  const body: Record<string, unknown> = { messaging_product: 'whatsapp' }
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== '') body[k] = v
  }
  if (profilePictureHandle) {
    body.profile_picture_handle = profilePictureHandle
  }

  const url = `${META_API_BASE}/${phoneNumberId}/whatsapp_business_profile`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  return { success: true }
}

export interface UploadProfilePhotoArgs {
  appId: string
  accessToken: string
  fileBytes: ArrayBuffer
  mimeType: string
  fileName?: string
}

/**
 * Upload an image to Meta's resumable upload API and return a media
 * handle that updateBusinessProfile() can use as profile_picture_handle.
 *
 * Two-step: (1) create an upload session on the APP, (2) POST the bytes;
 * Meta returns { h: "<handle>" }.
 */
export async function uploadProfilePhoto(
  args: UploadProfilePhotoArgs,
): Promise<string> {
  const { appId, accessToken, fileBytes, mimeType, fileName = 'logo.jpg' } = args

  // 1) Create the upload session.
  const sessionUrl =
    `${META_API_BASE}/${appId}/uploads` +
    `?file_name=${encodeURIComponent(fileName)}` +
    `&file_length=${fileBytes.byteLength}` +
    `&file_type=${encodeURIComponent(mimeType)}`

  const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!sessionRes.ok) {
    await throwMetaError(sessionRes, `Upload session failed: ${sessionRes.status}`)
  }
  const session = await sessionRes.json()
  const sessionId: string = session.id // like "upload:XXXX"

  // 2) Upload the bytes to that session.
  const uploadRes = await fetch(`${META_API_BASE}/${sessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: '0',
      'Content-Type': mimeType,
    },
    body: fileBytes,
  })
  if (!uploadRes.ok) {
    await throwMetaError(uploadRes, `Photo upload failed: ${uploadRes.status}`)
  }
  const uploaded = await uploadRes.json()
  return uploaded.h as string // the media handle
}

// ============================================================
// Username — a public @handle for the number (2026 Meta feature)
// ============================================================

export interface GetUsernameArgs {
  phoneNumberId: string
  accessToken: string
}

/**
 * Read the WhatsApp username currently claimed for this phone number.
 * `username` is undefined when none has been set yet.
 */
export async function getWhatsAppUsername(
  args: GetUsernameArgs,
): Promise<{ username?: string }> {
  const { phoneNumberId, accessToken } = args
  const url = `${META_API_BASE}/${phoneNumberId}?fields=username`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  return response.json()
}

export interface SetUsernameArgs {
  phoneNumberId: string
  accessToken: string
  username: string
}

/**
 * Claim or change the @username for this phone number, so a customer
 * can message it without ever seeing the underlying phone number.
 *
 * This hits a Meta endpoint that only shipped in 2026 (POST
 * /{phone_number_id}/username) — Meta's own error message surfaces via
 * throwMetaError() rather than failing silently, so if the exact field
 * name Meta expects ever differs from what's sent here, that shows up
 * as a clear message on the first real attempt rather than a mystery.
 */
export async function setWhatsAppUsername(
  args: SetUsernameArgs,
): Promise<{ success: boolean }> {
  const { phoneNumberId, accessToken, username } = args
  const url = `${META_API_BASE}/${phoneNumberId}/username`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', username }),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  return { success: true }
}

// ════════════════════════════════════════════════════════════════════
// INTERACTIVE MESSAGES
//
// Buttons, lists, catalogues and product messages — the message types
// the Journey canvas offers as nodes (TEXT_BUTTONS, MEDIA_BUTTONS,
// LIST, CATALOGUE, SINGLE_PRODUCT, MULTI_PRODUCT).
//
// Until now the only senders here were text, template and reaction, so
// a TEXT_BUTTONS node could only send its text and silently dropped the
// buttons, and the LIST/product nodes did nothing at all. Everything
// below exists so those nodes send what the merchant designed.
//
// Meta's limits are enforced here rather than trusted from the caller:
// exceeding them returns a 400 that surfaces as a failed send, which is
// far harder to debug than a value clamped at the source.
// ════════════════════════════════════════════════════════════════════

/** A tappable reply button. Max 3 per message; title max 20 chars. */
export interface InteractiveButton {
  /** Returned in the webhook when tapped — keep it stable, it is how
   *  a flow knows which branch the customer chose. */
  id: string
  title: string
}

/** One selectable row inside a list section. */
export interface InteractiveListRow {
  id: string
  title: string        // max 24 chars
  description?: string // max 72 chars
}

export interface InteractiveListSection {
  title: string        // max 24 chars
  rows: InteractiveListRow[]
}

/** Header options. Media headers need an uploaded media id or a public URL. */
export type InteractiveHeader =
  | { type: 'text'; text: string }
  | { type: 'image'; link: string }
  | { type: 'video'; link: string }
  | { type: 'document'; link: string; filename?: string }

interface BaseInteractiveArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  /** The message body. Required by Meta for every interactive type. */
  body: string
  header?: InteractiveHeader
  footer?: string
  contextMessageId?: string
}

/** Trim to Meta's limit without throwing — a clipped label beats a failed send. */
function clamp(value: string, max: number): string {
  const text = (value ?? '').trim()
  return text.length > max ? text.slice(0, max) : text
}

/** Shared POST + error handling for every interactive type. */
async function postInteractive(
  args: { phoneNumberId: string; accessToken: string; to: string; contextMessageId?: string },
  interactive: Record<string, unknown>,
): Promise<MetaSendResult> {
  const url = `${META_API_BASE}/${args.phoneNumberId}/messages`
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: args.to,
    type: 'interactive',
    interactive,
  }
  if (args.contextMessageId) {
    body.context = { message_id: args.contextMessageId }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

/** Build the optional header/footer block shared by all interactive types. */
function decorate(
  interactive: Record<string, unknown>,
  header?: InteractiveHeader,
  footer?: string,
): Record<string, unknown> {
  if (header) {
    if (header.type === 'text') {
      interactive.header = { type: 'text', text: clamp(header.text, 60) }
    } else if (header.type === 'document') {
      interactive.header = {
        type: 'document',
        document: { link: header.link, ...(header.filename ? { filename: header.filename } : {}) },
      }
    } else {
      interactive.header = { type: header.type, [header.type]: { link: header.link } }
    }
  }
  if (footer) interactive.footer = { text: clamp(footer, 60) }
  return interactive
}

export interface SendButtonMessageArgs extends BaseInteractiveArgs {
  buttons: InteractiveButton[]
}

/**
 * Reply buttons — up to 3. The customer taps one and the webhook
 * receives the button's `id`, which is what lets a flow branch on the
 * choice rather than parsing free text.
 */
export async function sendButtonMessage(
  args: SendButtonMessageArgs,
): Promise<MetaSendResult> {
  const buttons = args.buttons
    .filter((b) => b.title?.trim())
    .slice(0, 3) // Meta's hard limit
    .map((b) => ({
      type: 'reply',
      reply: { id: clamp(b.id, 256), title: clamp(b.title, 20) },
    }))

  if (buttons.length === 0) {
    throw new Error('A button message needs at least one button')
  }

  const interactive = decorate(
    {
      type: 'button',
      body: { text: clamp(args.body, 1024) },
      action: { buttons },
    },
    args.header,
    args.footer,
  )
  return postInteractive(args, interactive)
}

export interface SendListMessageArgs extends BaseInteractiveArgs {
  /** Label on the button that opens the list. Max 20 chars. */
  buttonText: string
  sections: InteractiveListSection[]
}

/**
 * A list message — the right choice above 3 options, since buttons cap
 * at 3. Meta allows up to 10 sections and 10 rows in total.
 */
export async function sendListMessage(
  args: SendListMessageArgs,
): Promise<MetaSendResult> {
  let rowBudget = 10 // total rows across ALL sections, not per section
  const sections = args.sections
    .filter((s) => s.rows?.length)
    .slice(0, 10)
    .map((section) => {
      const rows = section.rows.slice(0, rowBudget).map((row) => ({
        id: clamp(row.id, 200),
        title: clamp(row.title, 24),
        ...(row.description ? { description: clamp(row.description, 72) } : {}),
      }))
      rowBudget -= rows.length
      return { title: clamp(section.title, 24), rows }
    })
    .filter((s) => s.rows.length > 0)

  if (sections.length === 0) {
    throw new Error('A list message needs at least one row')
  }

  const interactive = decorate(
    {
      type: 'list',
      body: { text: clamp(args.body, 1024) },
      action: { button: clamp(args.buttonText || 'Choose', 20), sections },
    },
    args.header,
    args.footer,
  )
  return postInteractive(args, interactive)
}

export interface SendSingleProductArgs extends BaseInteractiveArgs {
  catalogId: string
  productRetailerId: string
}

/** One product from the merchant's Meta catalogue, with a Buy button. */
export async function sendSingleProductMessage(
  args: SendSingleProductArgs,
): Promise<MetaSendResult> {
  const interactive = decorate(
    {
      type: 'product',
      body: { text: clamp(args.body, 1024) },
      action: {
        catalog_id: args.catalogId,
        product_retailer_id: args.productRetailerId,
      },
    },
    undefined, // Meta rejects a header on single-product messages
    args.footer,
  )
  return postInteractive(args, interactive)
}

export interface SendMultiProductArgs extends BaseInteractiveArgs {
  catalogId: string
  /** Grouped exactly as they should appear to the customer. */
  sections: { title: string; productRetailerIds: string[] }[]
}

/**
 * Several catalogue products in one browsable message. Meta requires a
 * text header here and caps the total at 30 products.
 */
export async function sendMultiProductMessage(
  args: SendMultiProductArgs,
): Promise<MetaSendResult> {
  let productBudget = 30
  const sections = args.sections
    .filter((s) => s.productRetailerIds?.length)
    .slice(0, 10)
    .map((section) => {
      const items = section.productRetailerIds
        .slice(0, productBudget)
        .map((id) => ({ product_retailer_id: id }))
      productBudget -= items.length
      return { title: clamp(section.title, 24), product_items: items }
    })
    .filter((s) => s.product_items.length > 0)

  if (sections.length === 0) {
    throw new Error('A multi-product message needs at least one product')
  }

  const headerText =
    args.header?.type === 'text' ? args.header.text : 'Our products'

  const interactive = decorate(
    {
      type: 'product_list',
      body: { text: clamp(args.body, 1024) },
      action: { catalog_id: args.catalogId, sections },
    },
    { type: 'text', text: headerText }, // required for product_list
    args.footer,
  )
  return postInteractive(args, interactive)
}

export interface SendCatalogueArgs extends BaseInteractiveArgs {
  /** Optional product to show as the cover. Meta picks one if omitted. */
  thumbnailProductRetailerId?: string
}

/** The merchant's whole catalogue, with a "View catalog" button. */
export async function sendCatalogueMessage(
  args: SendCatalogueArgs,
): Promise<MetaSendResult> {
  const interactive = decorate(
    {
      type: 'catalog_message',
      body: { text: clamp(args.body, 1024) },
      action: {
        name: 'catalog_message',
        ...(args.thumbnailProductRetailerId
          ? {
              parameters: {
                thumbnail_product_retailer_id: args.thumbnailProductRetailerId,
              },
            }
          : {}),
      },
    },
    undefined, // catalog messages take no header
    args.footer,
  )
  return postInteractive(args, interactive)
}

/* ═══════════════════════════════════════════════════════════════════
   MEDIA MESSAGES
   ═══════════════════════════════════════════════════════════════════

   Images, PDFs and videos, sent by public URL.

   These were missing, and their absence was silently breaking the
   media capability on the channel the product is sold for. The AI
   would decide to send a floor plan, the engine would resolve it, and
   then every WhatsApp caller dropped it — so the customer read "here
   are the photos" and received no photos. On the website widget the
   same agent worked fine, which is why it went unnoticed.

   Meta fetches the `link` itself, so the URL has to be publicly
   reachable — Supabase public bucket URLs are, signed ones are not.  */

interface BaseMediaArgs {
  phoneNumberId: string
  accessToken: string
  to: string
  /** Publicly reachable URL. Meta downloads this server-side. */
  link: string
  /** Shown under the media. Meta caps captions at 1024 characters. */
  caption?: string
  contextMessageId?: string
}

/**
 * Local truncate, rather than reusing clamp() from the interactive
 * section above. This block is meant to be safe to append to any
 * version of this file, and depending on a helper that arrived in a
 * later commit is exactly how a paste turns into a build failure.
 */
function capText(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max)
}

async function postMedia(
  args: BaseMediaArgs & { type: 'image' | 'video' | 'document'; filename?: string },
): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, link, caption, type, filename, contextMessageId } = args

  const media: Record<string, unknown> = { link }
  if (caption?.trim()) media.caption = capText(caption.trim(), 1024)
  // Without a filename WhatsApp shows documents as "document.pdf", which
  // looks like a broken attachment next to a named brochure.
  if (type === 'document' && filename) media.filename = capText(filename, 240)

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type,
    [type]: media,
  }
  if (contextMessageId) body.context = { message_id: contextMessageId }

  const response = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    await throwMetaError(response, `Meta API error sending ${type}: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.messages[0].id }
}

/** A photo — property shots, before/after, product images. */
export async function sendImageMessage(args: BaseMediaArgs): Promise<MetaSendResult> {
  return postMedia({ ...args, type: 'image' })
}

/** A PDF or other file. `filename` is what the customer sees. */
export async function sendDocumentMessage(
  args: BaseMediaArgs & { filename?: string },
): Promise<MetaSendResult> {
  return postMedia({ ...args, type: 'document' })
}

/** A video file. Note: YouTube/Instagram links are NOT videos to Meta — it
 *  downloads the URL, so a watch page fails. Send those as text links. */
export async function sendVideoMessage(args: BaseMediaArgs): Promise<MetaSendResult> {
  return postMedia({ ...args, type: 'video' })
}
