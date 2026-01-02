import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('🔍 [Callback] Received:', { 
    hasCode: !!code, 
    error, 
    error_description,
    origin: requestUrl.origin,
    fullUrl: request.url,
  })

  // Handle OAuth errors
  if (error) {
    console.error('❌ [Callback] OAuth error:', error, error_description)
    
    // Handle PKCE specific errors
    if (error_description?.toLowerCase().includes('pkce') || 
        error_description?.toLowerCase().includes('code_verifier') ||
        error_description?.toLowerCase().includes('cache')) {
      
      // Return HTML that clears storage and redirects
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Clearing Cache...</title>
          </head>
          <body>
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui;">
              <div style="text-align: center;">
                <h2>🔄 Membersihkan Cache...</h2>
                <p>Mohon tunggu sebentar...</p>
              </div>
            </div>
            <script>
              console.log('Clearing storage...');
              
              // Clear localStorage
              try { localStorage.clear(); } catch(e) {}
              
              // Clear sessionStorage
              try { sessionStorage.clear(); } catch(e) {}
              
              // Clear cookies
              try {
                document.cookie.split(";").forEach(function(c) { 
                  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                });
              } catch(e) {}
              
              console.log('Storage cleared, redirecting...');
              
              // Redirect after clearing
              setTimeout(function() {
                window.location.href = '/login?error=pkce_cleared&message=Cache has been cleared. Please try logging in again.';
              }, 1500);
            </script>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      )
    }
    
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }

  if (!code) {
    console.log('⚠️ [Callback] No code provided')
    return NextResponse.redirect(
      new URL('/login?error=No authorization code received', requestUrl.origin)
    )
  }

  const cookieStore = cookies()
  
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
            cookieStore.set({ 
              name, 
              value, 
              ...options,
              path: '/',
              secure: process.env.NODE_ENV === 'production',
              httpOnly: true,
              sameSite: 'lax',
            })
          } catch (error) {
            console.error('❌ [Callback] Error setting cookie:', error)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ 
              name, 
              value: '', 
              ...options,
              maxAge: 0,
              path: '/',
            })
          } catch (error) {
            console.error('❌ [Callback] Error removing cookie:', error)
          }
        },
      },
    }
  )
  
  try {
    console.log('🔄 [Callback] Exchanging code for session...')
    
    const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

    if (sessionError) {
      console.error('❌ [Callback] Session exchange error:', sessionError)
      
      // Handle PKCE specific errors with storage clearing
      if (sessionError.message?.toLowerCase().includes('pkce') || 
          sessionError.message?.toLowerCase().includes('code_verifier')) {
        
        return new NextResponse(
          `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Clearing Cache...</title>
            </head>
            <body>
              <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui;">
                <div style="text-align: center;">
                  <h2>🔄 Membersihkan Cache...</h2>
                  <p>Mohon tunggu sebentar...</p>
                </div>
              </div>
              <script>
                console.log('PKCE error detected, clearing storage...');
                
                try { localStorage.clear(); } catch(e) {}
                try { sessionStorage.clear(); } catch(e) {}
                try {
                  document.cookie.split(";").forEach(function(c) { 
                    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                  });
                } catch(e) {}
                
                setTimeout(function() {
                  window.location.href = '/login?error=pkce_cleared&message=PKCE error fixed. Cache cleared. Please login again.';
                }, 1500);
              </script>
            </body>
          </html>
          `,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        )
      }
      
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(sessionError.message)}`, requestUrl.origin)
      )
    }

    const user = data?.user

    if (!user) {
      console.error('❌ [Callback] No user in response')
      return NextResponse.redirect(
        new URL('/login?error=Authentication failed - no user data', requestUrl.origin)
      )
    }

    console.log('✅ [Callback] User authenticated:', user.email)
    
    // Wait for profile with shorter retries
    let profile = null
    let attempts = 0
    const maxAttempts = 5
    
    while (!profile && attempts < maxAttempts) {
      attempts++
      
      if (attempts > 1) {
        const delay = Math.min(400 * attempts, 2000)
        console.log(`⏳ [Callback] Waiting ${delay}ms before retry ${attempts}/${maxAttempts}...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
      console.log(`🔍 [Callback] Checking profile... attempt ${attempts}/${maxAttempts}`)
      
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('❌ [Callback] Profile check error:', profileError)
      }

      if (existingProfile) {
        profile = existingProfile
        console.log('✅ [Callback] Profile found:', profile.username)
        break
      }
    }

    // Create profile if not found
    if (!profile) {
      console.log('📝 [Callback] Creating profile...')
      
      const username = (
        user.user_metadata?.username || 
        user.user_metadata?.preferred_username ||
        user.user_metadata?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
        user.email?.split('@')[0] || 
        `user_${user.id.substring(0, 8)}`
      ).toLowerCase().replace(/[^a-z0-9_]/g, '_')
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: username,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ [Callback] Profile creation error:', insertError)
        
        // If profile creation fails, redirect to debug page
        return NextResponse.redirect(
          new URL('/debug?error=profile_creation_failed', requestUrl.origin)
        )
      }
      
      console.log('✅ [Callback] Profile created:', newProfile)
    }

    console.log('🎉 [Callback] Success! Redirecting to home...')
    
    const response = NextResponse.redirect(new URL('/', requestUrl.origin))
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
    
  } catch (err: any) {
    console.error('❌ [Callback] Unexpected error:', err)
    
    // Handle PKCE errors
    if (err.message?.toLowerCase().includes('pkce') || 
        err.message?.toLowerCase().includes('code_verifier')) {
      
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Clearing Cache...</title>
          </head>
          <body>
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui;">
              <div style="text-align: center;">
                <h2>🔄 Membersihkan Cache...</h2>
                <p>Mohon tunggu sebentar...</p>
              </div>
            </div>
            <script>
              console.log('Clearing all storage...');
              try { localStorage.clear(); } catch(e) {}
              try { sessionStorage.clear(); } catch(e) {}
              try {
                document.cookie.split(";").forEach(function(c) { 
                  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                });
              } catch(e) {}
              
              setTimeout(function() {
                window.location.href = '/login?error=cache_cleared&message=Cache cleared successfully. Please try again.';
              }, 1500);
            </script>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      )
    }
    
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || 'Unexpected error')}`, requestUrl.origin)
    )
  }
}

export const dynamic = 'force-dynamic'
