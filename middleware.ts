import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create a response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client
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

  // 🔥 CRITICAL: Use getUser() instead of getSession()
  const { data: { user }, error } = await supabase.auth.getUser()

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/register', '/auth/callback', '/test-auth']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Protected routes
  const protectedRoutes = ['/', '/profile', '/post', '/debug']
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )

  // If no user and trying to access protected route -> redirect to login
  if (!user && isProtectedRoute) {
    console.log(`[Middleware] No user, redirecting ${pathname} -> /login`)
    const redirectUrl = new URL('/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // If user exists and trying to access login/register -> redirect to home
  if (user && (pathname === '/login' || pathname === '/register')) {
    console.log(`[Middleware] User exists, redirecting ${pathname} -> /`)
    const redirectUrl = new URL('/', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
