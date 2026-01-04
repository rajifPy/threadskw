import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, requestUrl.origin)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=No authorization code', requestUrl.origin)
    )
  }

  const cookieStore = cookies()
  let response = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
            response.cookies.set({ name, value, ...options })
          } catch (e) {
            console.error('Cookie set error:', e)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 })
            response.cookies.set({ name, value: '', ...options, maxAge: 0 })
          } catch (e) {
            console.error('Cookie remove error:', e)
          }
        },
      },
    }
  )
  
  try {
    const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

    if (sessionError) {
      console.error('Session error:', sessionError)
      
      if (sessionError.message?.toLowerCase().includes('pkce')) {
        return new NextResponse(
          `<!DOCTYPE html>
          <html>
            <head>
              <title>Redirecting...</title>
              <meta http-equiv="refresh" content="1;url=/login?message=Silakan login kembali">
            </head>
            <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;">
              <div style="text-align:center;">
                <div style="width:50px;height:50px;border:4px solid #e5e7eb;border-top-color:#22c55e;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
                <h2>Mengalihkan...</h2>
              </div>
              <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
            </body>
          </html>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        )
      }
      
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(sessionError.message)}`, requestUrl.origin)
      )
    }

    const user = data?.user
    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=Authentication failed', requestUrl.origin)
      )
    }

    console.log('✅ User authenticated:', user.email)
    
    // Check profile - single query, no retries
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      console.log('⚠️ Profile not found, creating...')
      
      const username = (
        user.user_metadata?.username || 
        user.user_metadata?.preferred_username ||
        user.user_metadata?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
        user.email?.split('@')[0] || 
        `user_${user.id.substring(0, 8)}`
      ).toLowerCase().replace(/[^a-z0-9_]/g, '_')
      
      await supabase.from('profiles').insert({
        id: user.id,
        username: username,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      })
    }

    // Simple HTML redirect
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Login Successful</title>
          <meta http-equiv="refresh" content="1;url=/">
        </head>
        <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;">
          <div style="text-align:center;">
            <div style="width:64px;height:64px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 1rem;">✓</div>
            <h2 style="color:#166534;">Login Berhasil!</h2>
            <p style="color:#6b7280;">Mengalihkan...</p>
          </div>
        </body>
      </html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store',
        },
      }
    )
    
  } catch (err: any) {
    console.error('Callback error:', err)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || 'Error')}`, requestUrl.origin)
    )
  }
}

export const dynamic = 'force-dynamic'
