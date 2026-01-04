import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ✅ Skip middleware untuk static files
  const shouldSkip = 
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api') ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js)$/i)

  if (shouldSkip) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.delete(name)
          response.cookies.delete(name)
        },
      },
    }
  )

  // ✅ Public routes - NO AUTH CHECK (ini yang bikin lambat!)
  const publicRoutes = ['/login', '/register', '/auth/callback', '/test-auth', '/debug']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  if (isPublicRoute) {
    // ✅ REMOVED: No auth check for public routes
    // Let the client-side handle redirects if already logged in
    return response
  }

  // Protected routes - only check auth here
  const protectedRoutes = ['/', '/profile', '/post']
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )

  if (isProtectedRoute) {
    try {
      // ✅ Use getSession instead of getUser (faster, uses cached session)
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        console.log(`[Middleware] No session, redirecting ${pathname} -> /login`)
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } catch (error) {
      console.error('[Middleware] Auth check failed:', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

// ✅ Simplified matcher
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
