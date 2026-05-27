import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // ============================================================
  // AUTH PAGES — redirect logged-in users to their dashboard
  // ============================================================
  if (user && (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password'
  )) {
    // Get user's slug from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('slug')
      .eq('user_id', user.id)
      .maybeSingle()

    const url = request.nextUrl.clone()
    if (profile?.slug) {
      url.pathname = `/${profile.slug}/dashboard`
    } else {
      url.pathname = '/dashboard' // fallback for old accounts
    }
    return NextResponse.redirect(url)
  }

  // ============================================================
  // SLUG ROUTES — /[slug]/dashboard, /[slug]/inbox etc
  // Pattern: first segment is slug, second is the page
  // ============================================================
  const slugRouteMatch = pathname.match(
    /^\/([a-z0-9-]+)\/(dashboard|inbox|contacts|pipelines|broadcasts|automations|settings)(\/.*)?$/
  )

  if (slugRouteMatch) {
    const slug = slugRouteMatch[1]

    // Skip reserved paths
    const reserved = ['api', 'admin', '_next', 'favicon', 'login', 'signup', 'forgot-password']
    if (reserved.includes(slug)) {
      return supabaseResponse
    }

    // Not logged in — redirect to login
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    // Verify this slug belongs to this user
    const { data: profile } = await supabase
      .from('profiles')
      .select('slug, user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // If user has no slug (old account) — let them through
    if (!profile?.slug) {
      return supabaseResponse
    }

    // If slug doesn't match their profile — forbidden
    if (profile.slug !== slug) {
      const url = request.nextUrl.clone()
      url.pathname = `/${profile.slug}/dashboard`
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  // ============================================================
  // LEGACY PROTECTED PATHS — keep working for existing accounts
  // ============================================================
  const protectedPaths = [
    '/dashboard', '/inbox', '/contacts',
    '/pipelines', '/broadcasts', '/automations', '/settings'
  ]

  if (!user && protectedPaths.some(path => pathname.startsWith(path))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ============================================================
  // ADMIN ROUTE — only admin users
  // ============================================================
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!adminCheck) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // ============================================================
  // API ROUTES — protect non-webhook endpoints
  // ============================================================
  if (!user &&
    pathname.startsWith('/api/whatsapp/') &&
    !pathname.includes('/webhook')
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
