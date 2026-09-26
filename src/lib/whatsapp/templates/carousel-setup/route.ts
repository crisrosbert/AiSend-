import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  createCarouselTemplate,
  uploadProfilePhoto,
} from '@/lib/whatsapp/meta-api'

/**
 * POST /api/whatsapp/templates/carousel-setup
 *
 * One-click carousel template setup for the ecommerce agent.
 * Creates a WhatsApp carousel template on Meta and saves the
 * template name to ai_agent_configs.carousel_template_name.
 *
 * Flow:
 *   1. Upload a sample image to Meta (required for template review).
 *   2. Submit the carousel template to Meta for approval.
 *   3. Save the template name in ai_agent_configs.
 *   4. Once Meta approves (webhook updates status), the carousel
 *      is automatically used for product image display.
 *
 * Body (optional):
 *   sample_image_url  — URL of a sample product image for Meta's review.
 *                       Defaults to a generic placeholder.
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

    // Step 1: Upload a sample image for Meta's template review
    const imageUrl =
      sample_image_url ||
      'https://placehold.co/600x400/7c3aed/white?text=Product+Image'

    let sampleImageHandle: string
    try {
      const imageRes = await fetch(imageUrl)
      if (!imageRes.ok) {
        return NextResponse.json(
          { error: `Could not fetch sample image (${imageRes.status}). Provide a public URL.` },
          { status: 400 },
        )
      }
      const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
      const fileBytes = await imageRes.arrayBuffer()

      sampleImageHandle = await uploadProfilePhoto({
        appId,
        accessToken,
        fileBytes,
        mimeType: contentType,
        fileName: 'carousel_sample.jpg',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      return NextResponse.json(
        { error: `Sample image upload failed: ${msg}` },
        { status: 422 },
      )
    }

    // Step 2: Create the carousel template on Meta
    const normalizedName = template_name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')

    let metaResult
    try {
      metaResult = await createCarouselTemplate({
        wabaId: config.waba_id,
        accessToken,
        name: normalizedName,
        language,
        bodyText: 'Check out *{{1}}* 🛍️',
        sampleCardCount: 4,
        sampleImageHandle,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Meta rejected the template'
      return NextResponse.json({ error: msg }, { status: 422 })
    }

    // Step 3: Save the template name in ai_agent_configs
    const { error: updateError } = await supabase
      .from('ai_agent_configs')
      .update({ carousel_template_name: normalizedName })
      .eq('user_id', user.id)

    if (updateError) {
      // Template was submitted to Meta, but local save failed.
      // Not critical — merchant can set it manually.
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
        body_text: 'Check out *{{1}}* 🛍️',
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

    const { data: config } = await supabase
      .from('ai_agent_configs')
      .select('carousel_template_name')
      .eq('user_id', user.id)
      .single()

    if (!config?.carousel_template_name) {
      return NextResponse.json({
        configured: false,
        message: 'No carousel template configured. POST to this endpoint to set one up.',
      })
    }

    // Check template status
    const { data: template } = await supabase
      .from('message_templates')
      .select('name, status')
      .eq('user_id', user.id)
      .eq('name', config.carousel_template_name)
      .single()

    return NextResponse.json({
      configured: true,
      template_name: config.carousel_template_name,
      status: template?.status ?? 'Unknown',
      active: template?.status === 'Approved',
    })
  } catch (error) {
    console.error('[CarouselSetup] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 },
    )
  }
}
