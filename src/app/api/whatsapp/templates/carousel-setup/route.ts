import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  createCarouselTemplate,
  uploadProfilePhoto,
} from '@/lib/whatsapp/meta-api'

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

/**
 * POST /api/whatsapp/templates/carousel-setup
 *
 * One-click carousel template setup for the ecommerce agent.
 * Creates a WhatsApp carousel template on Meta and saves the
 * template name to ai_agent_configs.carousel_template_name.
 *
 * Body (optional):
 *   sample_image_url  — URL of a sample product image for Meta's review.
 *                       If omitted, a minimal placeholder PNG is generated.
 *   template_name     — Custom template name (default: product_gallery_v1).
 *   language          — Language code (default: en_US).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      sample_image_url,
      template_name = 'product_gallery_v1',
      language = 'en_US',
    } = body as {
      sample_image_url?: string
      template_name?: string
      language?: string
    }

    // Load WhatsApp config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured. Connect your account in Settings first.' },
        { status: 400 },
      )
    }

    if (!config.waba_id) {
      return NextResponse.json(
        { error: 'WABA ID missing. Re-connect your WhatsApp account in Settings.' },
        { status: 400 },
      )
    }

    const accessToken = decrypt(config.access_token)
    const appId = process.env.META_APP_ID

    if (!appId) {
      return NextResponse.json(
        { error: 'Server not configured (missing META_APP_ID).' },
        { status: 500 },
      )
    }

    // Step 1: Get sample image for Meta's template review
    let fileBytes: ArrayBuffer
    let mimeType: string

    if (sample_image_url) {
      // User provided a custom sample image URL
      try {
        const imageRes = await fetch(sample_image_url, {
          headers: { Accept: 'image/*' },
          redirect: 'follow',
        })
        if (!imageRes.ok) {
          return NextResponse.json(
            { error: `Could not fetch sample image (HTTP ${imageRes.status}). Provide a publicly accessible URL.` },
            { status: 400 },
          )
        }
        const rawCt = imageRes.headers.get('content-type') || 'image/jpeg'
        mimeType = rawCt.split(';')[0].trim()
        fileBytes = await imageRes.arrayBuffer()
      } catch (err) {
        return NextResponse.json(
          { error: `Failed to download sample image: ${err instanceof Error ? err.message : String(err)}` },
          { status: 400 },
        )
      }
    } else {
      // Generate a minimal valid PNG in-memory (no external fetch needed)
      const png = generatePlaceholderPng()
      fileBytes = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer
      mimeType = 'image/png'
    }

    // Upload sample image to Meta
    let sampleImageHandle: string
    try {
      sampleImageHandle = await uploadProfilePhoto({
        appId,
        accessToken,
        fileBytes,
        mimeType,
        fileName: mimeType === 'image/png' ? 'carousel_sample.png' : 'carousel_sample.jpg',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      return NextResponse.json(
        { error: `Meta image upload failed: ${msg}`, step: 'image_upload' },
        { status: 422 },
      )
    }

    // Step 2: Create the carousel template on Meta
    const normalizedName = template_name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')

    let metaResult
    try {
      metaResult = await createCarouselTemplate({
        wabaId: config.waba_id,
        accessToken,
        name: normalizedName,
        language,
        bodyText: 'Check out our latest products!',
        sampleCardCount: 2,
        sampleImageHandle,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Meta rejected the template'
      return NextResponse.json(
        { error: msg, step: 'create_template' },
        { status: 422 },
      )
    }

    // Step 3: Save the template name in ai_agent_configs
    const { error: updateError } = await supabase
      .from('ai_agent_configs')
      .update({ carousel_template_name: normalizedName })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[CarouselSetup] Failed to save template name:', updateError)
    }

    // Step 4: Also save in message_templates for the UI
    await supabase.from('message_templates').upsert(
      {
        user_id: user.id,
        name: normalizedName,
        category: 'Marketing',
        language,
        header_type: null,
        header_content: null,
        body_text: 'Check out our latest products!',
        footer_text: null,
        buttons: null,
        status: metaResult.status === 'APPROVED' ? 'Approved' : 'Pending',
        meta_template_id: metaResult.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,name,language' },
    )

    return NextResponse.json({
      success: true,
      template_name: normalizedName,
      meta_template_id: metaResult.id,
      status: metaResult.status,
      message:
        metaResult.status === 'APPROVED'
          ? 'Carousel template approved! Product images will now show as swipeable carousels.'
          : 'Carousel template submitted for review. Once Meta approves it (usually within minutes), product images will automatically show as carousels.',
    })
  } catch (error) {
    console.error('[CarouselSetup] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set up carousel' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/whatsapp/templates/carousel-setup
 *
 * Check current carousel template status.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: agentConfig } = await supabase
      .from('ai_agent_configs')
      .select('carousel_template_name')
      .eq('user_id', user.id)
      .single()

    if (!agentConfig?.carousel_template_name) {
      return NextResponse.json({
        configured: false,
        message: 'No carousel template configured. POST to this endpoint to set one up.',
      })
    }

    const templateName = agentConfig.carousel_template_name

    // Fetch live status from Meta so we never show stale "Unknown".
    // Every branch below records *why* we didn't get a status, in
    // `debug`, so a failure is diagnosable from the API response alone
    // instead of needing another round of guessing.
    const { data: waConfig } = await supabase
      .from('whatsapp_config')
      .select('waba_id, access_token')
      .eq('user_id', user.id)
      .single()

    let liveStatus: string | null = null
    let liveQuality: string | null = null
    const debug: Record<string, unknown> = {}

    if (!waConfig?.waba_id || !waConfig?.access_token) {
      debug.metaCheck = 'skipped — whatsapp_config missing waba_id or access_token'
    } else {
      try {
        const accessToken = decrypt(waConfig.access_token)
        const metaRes = await fetch(
          `${META_API_BASE}/${waConfig.waba_id}/message_templates?name=${encodeURIComponent(templateName)}&fields=name,status,quality_score`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        if (!metaRes.ok) {
          const errBody = await metaRes.text().catch(() => '')
          debug.metaCheck = `Meta API returned HTTP ${metaRes.status}`
          debug.metaError = errBody.slice(0, 500)
        } else {
          const metaBody = await metaRes.json()
          const list = metaBody.data as Array<{ name: string; status: string; quality_score?: { score?: string } }> | undefined
          const found = list?.find((t) => t.name === templateName)
          if (!found) {
            debug.metaCheck = `Meta returned ${list?.length ?? 0} template(s) but none named "${templateName}"`
            debug.metaTemplateNames = list?.map((t) => t.name) ?? []
          } else {
            liveStatus = found.status // APPROVED | PENDING | REJECTED
            liveQuality = found.quality_score?.score ?? null
            debug.metaCheck = 'ok'
            // Keep local DB in sync
            const normalized =
              liveStatus === 'APPROVED' ? 'Approved'
              : liveStatus === 'REJECTED' ? 'Rejected'
              : 'Pending'
            await supabase
              .from('message_templates')
              .update({ status: normalized, updated_at: new Date().toISOString() })
              .eq('user_id', user.id)
              .eq('name', templateName)
          }
        }
      } catch (err) {
        debug.metaCheck = 'threw before a response came back'
        debug.metaError = err instanceof Error ? err.message : String(err)
      }
    }

    // Fallback: local DB status
    const { data: template } = await supabase
      .from('message_templates')
      .select('name, status')
      .eq('user_id', user.id)
      .eq('name', templateName)
      .single()
    debug.localDbStatus = template?.status ?? null

    const displayStatus = liveStatus ?? template?.status ?? 'Unknown'
    const active = displayStatus === 'APPROVED' || displayStatus === 'Approved'

    return NextResponse.json({
      configured: true,
      template_name: templateName,
      status: displayStatus,
      quality_rating: liveQuality,
      active,
      message: active
        ? '✅ Carousel template is approved and active!'
        : displayStatus === 'PENDING' || displayStatus === 'Pending'
          ? '⏳ Template is pending Meta review (usually approved within minutes to hours)'
          : displayStatus === 'REJECTED' || displayStatus === 'Rejected'
            ? '❌ Template was rejected by Meta. Delete it and create a new one.'
            : 'Status unknown — Meta API check failed',
      debug,
    })
  } catch (error) {
    console.error('[CarouselSetup] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 },
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a minimal valid 100×100 PNG image in-memory.
 * Purple (#7c3aed) solid colour — no external dependencies.
 * Meta needs *some* image to review the template; this is enough.
 */
function generatePlaceholderPng(): Uint8Array {
  // A valid PNG is: signature + IHDR + IDAT (zlib compressed) + IEND
  // For simplicity we create an uncompressed (store) zlib stream.

  const width = 100
  const height = 100

  // Raw image data: for each row, filter byte (0 = None) + RGB pixels
  const rowBytes = 1 + width * 3 // filter byte + 3 bytes per pixel
  const rawData = new Uint8Array(rowBytes * height)
  for (let y = 0; y < height; y++) {
    const offset = y * rowBytes
    rawData[offset] = 0 // filter: None
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3
      rawData[px] = 0x7c     // R
      rawData[px + 1] = 0x3a // G
      rawData[px + 2] = 0xed // B
    }
  }

  // Deflate as a stored (uncompressed) zlib stream
  const zlibData = createStoredZlib(rawData)

  // Build chunks
  const ihdr = createPngChunk('IHDR', (() => {
    const d = new Uint8Array(13)
    const v = new DataView(d.buffer)
    v.setUint32(0, width)
    v.setUint32(4, height)
    d[8] = 8  // bit depth
    d[9] = 2  // colour type: RGB
    d[10] = 0 // compression
    d[11] = 0 // filter
    d[12] = 0 // interlace
    return d
  })())

  const idat = createPngChunk('IDAT', zlibData)
  const iend = createPngChunk('IEND', new Uint8Array(0))

  // PNG signature
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

  // Concatenate
  const png = new Uint8Array(sig.length + ihdr.length + idat.length + iend.length)
  let pos = 0
  png.set(sig, pos); pos += sig.length
  png.set(ihdr, pos); pos += ihdr.length
  png.set(idat, pos); pos += idat.length
  png.set(iend, pos)

  return png
}

/** Create a PNG chunk: length(4) + type(4) + data + crc(4) */
function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  // Type
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i)
  // Data
  chunk.set(data, 8)
  // CRC over type + data
  const crc = crc32(chunk.subarray(4, 8 + data.length))
  view.setUint32(8 + data.length, crc)
  return chunk
}

/** Wrap raw bytes in a zlib stored (no compression) stream. */
function createStoredZlib(data: Uint8Array): Uint8Array {
  // Zlib: header(2) + deflate blocks + adler32(4)
  // Deflate stored blocks: max 65535 bytes each
  const maxBlock = 65535
  const numBlocks = Math.ceil(data.length / maxBlock) || 1
  const deflateSize = numBlocks * 5 + data.length // 5-byte header per block
  const result = new Uint8Array(2 + deflateSize + 4)

  // Zlib header: CMF=0x78 (deflate, 32K window), FLG=0x01 (check bits)
  result[0] = 0x78
  result[1] = 0x01

  let pos = 2
  for (let i = 0; i < numBlocks; i++) {
    const start = i * maxBlock
    const end = Math.min(start + maxBlock, data.length)
    const len = end - start
    const isLast = i === numBlocks - 1
    result[pos] = isLast ? 0x01 : 0x00 // BFINAL + BTYPE=00 (stored)
    result[pos + 1] = len & 0xff
    result[pos + 2] = (len >> 8) & 0xff
    result[pos + 3] = ~len & 0xff
    result[pos + 4] = (~len >> 8) & 0xff
    pos += 5
    result.set(data.subarray(start, end), pos)
    pos += len
  }

  // Adler-32
  const adler = adler32(data)
  const av = new DataView(result.buffer)
  av.setUint32(pos, adler)

  return result
}

/** CRC-32 (ISO 3309 / PNG spec). */
function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Adler-32 checksum. */
function adler32(buf: Uint8Array): number {
  let a = 1
  let b = 0
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}
