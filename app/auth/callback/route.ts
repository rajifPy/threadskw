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
  })

  // Handle OAuth errors
  if (error) {
    console.error('❌ [Callback] OAuth error:', error, error_description)
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
  
  // ✅ Create response dengan redirect ke home
  const response = NextResponse.redirect(new URL('/', requestUrl.origin))
  
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
            response.cookies.set({
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
            response.cookies.set({
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
      
      // If PKCE error, clear everything and redirect with instruction
      if (sessionError.message?.toLowerCase().includes('pkce') || 
          sessionError.message?.toLowerCase().includes('code_verifier')) {
        
        const clearResponse = new NextResponse(
          `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Clearing Cache...</title>
              <style>
                body {
                  font-family: system-ui, -apple-system, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                }
                .container {
                  text-align: center;
                  padding: 2rem;
                  background: white;
                  border-radius: 1rem;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                  max-width: 400px;
                }
                .spinner {
                  width: 50px;
                  height: 50px;
                  margin: 0 auto 1rem;
                  border: 4px solid #e5e7eb;
                  border-top-color: #22c55e;
                  border-radius: 50%;
                  animation: spin 1s linear infinite;
                }
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
                h2 { color: #166534; margin: 0 0 0.5rem; }
                p { color: #6b7280; margin: 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="spinner"></div>
                <h2>🔄 Membersihkan Cache...</h2>
                <p>Mohon tunggu sebentar...</p>
              </div>
              <script>
                console.log('PKCE error detected, clearing all storage...');
                
                setTimeout(function() {
                  window.location.href = '/login?message=' + encodeURIComponent('Silakan coba login kembali.');
                }, 2000);
              </script>
            </body>
          </html>
          `,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-store, no-cache, must-revalidate, private',
              'Pragma': 'no-cache',
            },
          }
        )
        
        return clearResponse
      }
      
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(sessionError.message)}`, requestUrl.origin)
      )
    }

    const user = data?.user

    if (!user) {
      console.error('❌ [Callback] No user in response')
      return NextResponse.redirect(
        new URL('/login?error=Authentication failed', requestUrl.origin)
      )
    }

    console.log('✅ [Callback] User authenticated:', user.email)
    
    // ✅ Check/create profile dengan retry yang lebih cepat
    let profile = null
    let attempts = 0
    const maxAttempts = 3
    
    while (!profile && attempts < maxAttempts) {
      attempts++
      
      if (attempts > 1) {
        // ✅ Shorter wait time
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      console.log(`🔍 [Callback] Checking profile... attempt ${attempts}/${maxAttempts}`)
      
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (existingProfile) {
        profile = existingProfile
        console.log('✅ [Callback] Profile found:', profile.username)
        break
      }
      
      // Try to create profile if doesn't exist
      if (attempts === 1) {
        console.log('📝 [Callback] Creating profile...')
        
        const username = (
          user.user_metadata?.username || 
          user.user_metadata?.preferred_username ||
          user.user_metadata?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
          user.email?.split('@')[0] || 
          `user_${user.id.substring(0, 8)}`
        ).toLowerCase().replace(/[^a-z0-9_]/g, '_')
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: username,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          })

        if (insertError) {
          console.error('❌ [Callback] Profile creation error:', insertError)
        }
      }
    }

    // ✅ If still no profile, redirect to debug (bukan loop ke callback lagi)
    if (!profile) {
      console.warn('⚠️ [Callback] Profile not found after retries, redirecting to debug')
      return NextResponse.redirect(new URL('/debug', requestUrl.origin))
    }

    console.log('🎉 [Callback] Success! Redirecting to home...')
    
    // ✅ Set headers untuk prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
    
  } catch (err: any) {
    console.error('❌ [Callback] Unexpected error:', err)
    
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || 'Unexpected error')}`, requestUrl.origin)
    )
  }
}

export const dynamic = 'force-dynamic'
