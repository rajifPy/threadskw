import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
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
    const supabase = createClient()
    
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

      if (user) {
        console.log('User authenticated:', user.email)
        
        // Check if profile exists
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle() // Use maybeSingle instead of single

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Profile check error:', profileError)
        }

        if (!profile) {
          console.log('Profile not found, creating manually...')
          
          // Create profile manually if trigger failed
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
            // Don't fail the login, profile can be created later
          } else {
            console.log('Profile created successfully')
          }
        } else {
          console.log('Profile exists:', profile.username)
        }

        // Success - redirect to home
        console.log('Redirecting to home...')
        
        // Use revalidatePath untuk clear cache
        const response = NextResponse.redirect(new URL('/', requestUrl.origin))
        
        // Add cache headers
        response.headers.set('Cache-Control', 'no-store, max-age=0')
        
        return response
      }
    } catch (err) {
      console.error('Unexpected error in callback:', err)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent('Unexpected error occurred')}`, requestUrl.origin)
      )
    }
  }

  // No code provided - redirect to login
  console.log('No code provided, redirecting to login')
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
