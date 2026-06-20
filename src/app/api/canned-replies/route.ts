import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/canned-replies — list all for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('canned_replies')
      .select('*')
      .eq('user_id', user.id)
      .order('category')
      .order('shortcode')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ replies: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/canned-replies — create
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { shortcode, title, content, category } = body

    if (!shortcode?.trim()) return NextResponse.json({ error: 'shortcode is required' }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 })
    if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    // Normalise shortcode: lowercase, no spaces
    const slug = shortcode.trim().toLowerCase().replace(/\s+/g, '-')

    const { data, error } = await supabase
      .from('canned_replies')
      .insert({
        user_id: user.id,
        shortcode: slug,
        title: title.trim(),
        content: content.trim(),
        category: category?.trim() || 'General',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Shortcode "/${slug}" already exists` }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reply: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH /api/canned-replies — update
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, shortcode, title, content, category } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const slug = shortcode?.trim().toLowerCase().replace(/\s+/g, '-')

    const { data, error } = await supabase
      .from('canned_replies')
      .update({
        ...(slug && { shortcode: slug }),
        ...(title && { title: title.trim() }),
        ...(content && { content: content.trim() }),
        ...(category !== undefined && { category: category.trim() || 'General' }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Shortcode "/${slug}" already exists` }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reply: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/canned-replies?id=<id>
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { error } = await supabase
      .from('canned_replies')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
