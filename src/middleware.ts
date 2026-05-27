import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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

  // Auth pages — redirect logged-in users to their dashboard
  if (user && (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password'
  )) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('slug')
      .eq('user_id', user.id)
      .maybeSingle()
    const url = request.nextUrl.clone()
    url.pathname = profile?.slug ? `/${profile.slug}/dashboard` : '/dashboard'
    return NextResponse.redirect(url)
  }

  // Admin route — must be logged in
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    // Allow through — admin page checks admin_users table itself
    return supabaseResponse
  }

  // Slug routes — /[slug]/dashboard etc
  const slugRouteMatch = pathname.match(
    /^\/([a-z0-9-]+)\/(dashboard|inbox|contacts|pipelines|broadcasts|automations|settings)(\/.*)?$/
  )
  if (slugRouteMatch) {
    const slug = slugRouteMatch[1]
    const reserved = ['api', 'admin', '_next', 'favicon', 'login', 'signup', 'forgot-password']
    if (!reserved.includes(slug)) {
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('next', pathname)
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }
  }

  // Legacy protected paths
  const protectedPaths = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/settings']
  if (!user && protectedPaths.some(path => pathname.startsWith(path))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // API routes
  if (!user && pathname.startsWith('/api/whatsapp/') && !pathname.includes('/webhook')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
