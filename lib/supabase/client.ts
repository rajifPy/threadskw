import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
  // Create singleton client to avoid multiple instances
  if (client) return client

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'supabase.auth.token', // Explicit storage key
        debug: true, // Enable debug mode
      },
      // Add cookie options for better compatibility
      cookieOptions: {
        name: 'sb-auth-token',
        domain: typeof window !== 'undefined' ? window.location.hostname : undefined,
        path: '/',
        sameSite: 'lax',
        secure: typeof window !== 'undefined' ? window.location.protocol === 'https:' : true,
      },
    }
  )

  return client
}
