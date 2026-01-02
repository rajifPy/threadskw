import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('Callback received:', { 
    hasCode: !!code, 
    error, 
    error_description,
    origin: requestUrl.origin,
    fullUrl: request.url 
  })

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
      
      const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

      if (sessionError) {
        console.error('Session exchange error:', sessionError)
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(sessionError.message || 'Authentication failed')}`, requestUrl.origin)
        )
      }

      const user = data?.user

      if (user) {
        console.log('User authenticated:', user.email)
        
        // PERBAIKAN: Retry mechanism dengan delay lebih lama
        let profile = null
        let attempts = 0
        const maxAttempts = 5
        
        while (!profile && attempts < maxAttempts) {
          attempts++
          console.log(`Checking profile... attempt ${attempts}/${maxAttempts}`)
          
          const { data: existingProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Profile check error:', profileError)
          }

          if (existingProfile) {
            profile = existingProfile
            console.log('Profile found:', profile.username)
            break
          }

          // Wait before retry (increasing delay)
          if (attempts < maxAttempts) {
            const delay = attempts * 1000 // 1s, 2s, 3s, 4s
            console.log(`Waiting ${delay}ms before retry...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }

        // If still no profile after retries, create it
        if (!profile) {
          console.log('Profile not found after retries, creating manually...')
          
          const username = user.user_metadata?.username || 
                          user.user_metadata?.preferred_username ||
                          user.user_metadata?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
                          user.email?.split('@')[0] || 
                          `user_${user.id.substring(0, 8)}`
          
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              username: username.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
              avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            })
            .select()
            .single()

          if (insertError) {
            console.error('Profile creation error:', insertError)
            // Even if creation fails, redirect to fix page instead of error
            return NextResponse.redirect(new URL('/debug', requestUrl.origin))
          } else {
            console.log('Profile created successfully:', newProfile)
          }
        }

        console.log('Redirecting to home...')
        
        const response = NextResponse.redirect(new URL('/', requestUrl.origin))
        
        // Prevent caching
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        
        return response
      }
    } catch (err) {
      console.error('Unexpected error in callback:', err)
      return NextResponse.redirect(
        new URL(`/debug?error=${encodeURIComponent('Unexpected error occurred')}`, requestUrl.origin)
      )
    }
  }

  console.log('No code provided, redirecting to login')
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}

export const dynamic = 'force-dynamic'
