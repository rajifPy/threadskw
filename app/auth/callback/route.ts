import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Check if profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Create profile if it doesn't exist (for OAuth users)
      if (!profile) {
        const username = user.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${user.id.substring(0, 8)}`
        
        await supabase.from('profiles').insert({
          id: user.id,
          username,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || username,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        })
      }
    }
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}