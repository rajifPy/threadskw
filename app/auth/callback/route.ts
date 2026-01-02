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
    fullUrl: request.url 
  })

  // Handle OAuth errors
  if (error) {
    console.error('❌ [Callback] OAuth error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }

  if (!code) {
    console.log('⚠️ [Callback] No code provided, redirecting to login')
    return NextResponse.redirect(new URL('/login?error=No authorization code', requestUrl.origin))
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
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            console.error('❌ [Callback] Error setting cookie:', error)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
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
      
      // Jika PKCE error, redirect ke login dengan instruksi clear cache
      if (sessionError.message?.includes('PKCE')) {
        return NextResponse.redirect(
          new URL('/login?error=pkce_error&message=Please clear your browser cache and try again', requestUrl.origin)
        )
      }
      
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(sessionError.message || 'Authentication failed')}`, requestUrl.origin)
      )
    }

    const user = data?.user

    if (!user) {
      console.error('❌ [Callback] No user in response')
      return NextResponse.redirect(
        new URL('/login?error=No user data', requestUrl.origin)
      )
    }

    console.log('✅ [Callback] User authenticated:', user.email)
    
    // Wait for profile creation with exponential backoff
    let profile = null
    let attempts = 0
    const maxAttempts = 8
    
    while (!profile && attempts < maxAttempts) {
      attempts++
      const delay = Math.min(500 * Math.pow(2, attempts - 1), 8000)
      
      console.log(`🔍 [Callback] Checking profile... attempt ${attempts}/${maxAttempts}`)
      
      // Wait before checking (except first attempt)
      if (attempts > 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
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

    // If profile still doesn't exist, create it manually
    if (!profile) {
      console.log('⚠️ [Callback] Profile not found after retries, creating manually...')
      
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
        // Redirect to debug page instead of error
        return NextResponse.redirect(new URL('/debug', requestUrl.origin))
      }
      
      console.log('✅ [Callback] Profile created successfully:', newProfile)
      profile = newProfile
    }

    console.log('🎉 [Callback] Redirecting to home...')
    
    const response = NextResponse.redirect(new URL('/', requestUrl.origin))
    
    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
    
  } catch (err: any) {
    console.error('❌ [Callback] Unexpected error:', err)
    
    // Handle PKCE specific errors
    if (err.message?.includes('PKCE') || err.message?.includes('code_verifier')) {
      return NextResponse.redirect(
        new URL('/login?error=pkce_error&message=Please clear your browser cache and cookies, then try again', requestUrl.origin)
      )
    }
    
    return NextResponse.redirect(
      new URL(`/debug?error=${encodeURIComponent(err.message || 'Unexpected error occurred')}`, requestUrl.origin)
    )
  }
}

export const dynamic = 'force-dynamic'
