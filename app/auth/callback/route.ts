import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

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
      // Exchange code for session
      const { data: { user }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

      if (sessionError) {
        console.error('Session exchange error:', sessionError)
        return NextResponse.redirect(
          new URL('/login?error=auth_failed', requestUrl.origin)
        )
      }

      if (user) {
        // Trigger sudah otomatis membuat profil
        // Tapi kita bisa cek apakah profil sudah ada
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (!profile) {
          // Jika trigger gagal, log error tapi tetap redirect ke home
          console.error('Profile not created by trigger for user:', user.id)
          // User tetap bisa login, profil bisa dibuat manual nanti
        }

        console.log('Login successful for user:', user.email)
      }
    } catch (err) {
      console.error('Unexpected error in callback:', err)
      return NextResponse.redirect(
        new URL('/login?error=unexpected_error', requestUrl.origin)
      )
    }
  }

  // Redirect to home page
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
