import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')

  console.log('🔵 [Callback] Starting auth callback...')
  console.log('🔵 [Callback] Code:', code ? 'Present' : 'Missing')
  console.log('🔵 [Callback] Error:', error || 'None')

  if (error) {
    console.log('❌ [Callback] OAuth error:', error)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, requestUrl.origin)
    )
  }

  if (!code) {
    console.log('❌ [Callback] No authorization code')
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
            console.error('❌ Cookie set error:', e)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 })
            response.cookies.set({ name, value: '', ...options, maxAge: 0 })
          } catch (e) {
            console.error('❌ Cookie remove error:', e)
          }
        },
      },
    }
  )
  
  try {
    console.log('🔵 [Callback] Exchanging code for session...')
    const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

    if (sessionError) {
      console.error('❌ [Callback] Session error:', sessionError)
      
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
      console.log('❌ [Callback] No user in session data')
      return NextResponse.redirect(
        new URL('/login?error=Authentication failed', requestUrl.origin)
      )
    }

    console.log('✅ [Callback] User authenticated:', user.email)
    console.log('🔵 [Callback] User ID:', user.id)
    console.log('🔵 [Callback] User metadata:', JSON.stringify(user.user_metadata, null, 2))
    
    // ✅ Check and create profile with detailed logging
    console.log('🔵 [Callback] Checking for existing profile...')
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (profileCheckError) {
      console.error('❌ [Callback] Profile check error:', profileCheckError)
    } else {
      console.log('🔵 [Callback] Profile check result:', existingProfile ? 'Found' : 'Not found')
      if (existingProfile) {
        console.log('🔵 [Callback] Existing profile:', JSON.stringify(existingProfile, null, 2))
      }
    }

    if (!existingProfile) {
      console.log('⚠️ [Callback] Profile not found, creating...')
      
      const username = (
        user.user_metadata?.username || 
        user.user_metadata?.preferred_username ||
        user.user_metadata?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
        user.email?.split('@')[0] || 
        `user_${user.id.substring(0, 8)}`
      ).toLowerCase().replace(/[^a-z0-9_]/g, '_')
      
      console.log('🔵 [Callback] Generated username:', username)
      
      const profileData = {
        id: user.id,
        username: username,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      }
      
      console.log('🔵 [Callback] Creating profile with data:', JSON.stringify(profileData, null, 2))
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      if (insertError) {
        console.error('❌ [Callback] Profile creation error:', insertError)
        console.error('❌ [Callback] Error code:', insertError.code)
        console.error('❌ [Callback] Error details:', insertError.details)
        console.error('❌ [Callback] Error hint:', insertError.hint)
        
        // Redirect to debug page with error info
        return NextResponse.redirect(
          new URL(`/debug?error=profile_creation_failed&details=${encodeURIComponent(insertError.message)}`, requestUrl.origin)
        )
      }
      
      console.log('✅ [Callback] Profile created successfully:', JSON.stringify(newProfile, null, 2))
    } else {
      console.log('✅ [Callback] Profile already exists')
    }

    // ✅ Verify profile exists before redirecting
    console.log('🔵 [Callback] Final verification - checking profile...')
    const { data: finalProfile, error: finalCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (finalCheckError || !finalProfile) {
      console.error('❌ [Callback] Final verification failed:', finalCheckError)
      return NextResponse.redirect(
        new URL(`/debug?error=profile_not_found_after_creation`, requestUrl.origin)
      )
    }
    
    console.log('✅ [Callback] Final verification passed. Profile:', finalProfile.username)
    console.log('✅ [Callback] Redirecting to home page...')

    // ✅ Redirect with faster meta refresh (0 seconds)
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Login Successful</title>
          <meta http-equiv="refresh" content="0;url=/">
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
    console.error('❌ [Callback] Unexpected error:', err)
    console.error('❌ [Callback] Error stack:', err.stack)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || 'Error')}`, requestUrl.origin)
    )
  }
}

export const dynamic = 'force-dynamic'
