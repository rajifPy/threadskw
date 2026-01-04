import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ✅ OPTIMASI 1: Skip auth check untuk static files dan API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
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

  // Public routes
  const publicRoutes = ['/login', '/register', '/auth/callback', '/test-auth']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // ✅ OPTIMASI 2: Skip auth check untuk public routes
  if (isPublicRoute) {
    return response
  }

  // Protected routes
  const protectedRoutes = ['/', '/profile', '/post', '/debug']
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )

  // ✅ OPTIMASI 3: Only check auth for protected routes
  if (isProtectedRoute) {
    try {
      // ✅ Use getUser() with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth check timeout')), 3000)
      )
      
      const authPromise = supabase.auth.getUser()
      
      const { data: { user }, error } = await Promise.race([
        authPromise,
        timeoutPromise
      ]) as any

      if (error || !user) {
        console.log(`[Middleware] No user, redirecting ${pathname} -> /login`)
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } catch (error) {
      console.error('[Middleware] Auth check failed:', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // ✅ OPTIMASI 4: More specific matcher to exclude static files
    '/((?!_next/static|_next/image|_next/webpack|favicon.ico|icon.svg|.*\\.(svg|png|jpg|jpeg|gif|webp|css|js|ico)).*)',
  ],
}
