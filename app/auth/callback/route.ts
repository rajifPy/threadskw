import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('=== AUTH CALLBACK START ===')
  console.log('Has code:', !!code)
  console.log('Error:', error, error_description)
  console.log('Origin:', requestUrl.origin)

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, error_description)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    )
  }

  if (code) {
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
              console.error('Error setting cookie:', error)
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              console.error('Error removing cookie:', error)
            }
          },
        },
      }
    )
    
    try {
      console.log('Exchanging code for session...')
      
      // Exchange code for session
      const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

      if (sessionError) {
        console.error('Session exchange error:', sessionError)
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(sessionError.message || 'Authentication failed')}`, requestUrl.origin)
        )
      }

      const user = data?.user
      const session = data?.session

      if (user && session) {
        console.log('✅ User authenticated:', user.email)
        console.log('✅ Session created:', session.access_token.substring(0, 20) + '...')
        
        // Check if profile exists
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Profile check error:', profileError)
        }

        if (!profile) {
          console.log('Creating profile...')
          
          // Create profile manually
          const username = user.user_metadata?.username || 
                          user.user_metadata?.preferred_username ||
                          user.email?.split('@')[0] || 
                          `user_${user.id.substring(0, 8)}`
          
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              username: username.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
              avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            })

          if (insertError) {
            console.error('Profile creation error:', insertError)
          } else {
            console.log('✅ Profile created successfully')
          }
        } else {
          console.log('✅ Profile exists:', profile.username)
        }

        // Create response with proper headers
        const response = NextResponse.redirect(new URL('/', requestUrl.origin))
        
        // Set cache headers
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        
        console.log('=== AUTH CALLBACK SUCCESS ===')
        return response
      } else {
        console.error('No user or session after exchange')
        return NextResponse.redirect(
          new URL('/login?error=No session created', requestUrl.origin)
        )
      }
    } catch (err) {
      console.error('Unexpected error in callback:', err)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent('Unexpected error occurred')}`, requestUrl.origin)
      )
    }
  }

  // No code provided
  console.log('No code provided, redirecting to login')
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
