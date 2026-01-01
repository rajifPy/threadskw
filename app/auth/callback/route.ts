import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createClient()
    
    try {
      const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Auth error:', error)
        return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin))
      }

      if (user) {
        // Check if profile exists
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        // Create profile if it doesn't exist
        if (!profile && !profileError) {
          const username = user.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${user.id.substring(0, 8)}`
          
          const { error: insertError } = await supabase.from('profiles').insert([{
            id: user.id,
            username,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || username,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          }])

          if (insertError) {
            console.error('Profile insert error:', insertError)
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      return NextResponse.redirect(new URL('/login?error=unexpected', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
