import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
  // Return existing client if already created
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
        storageKey: 'sb-auth-token',
        debug: false, // Disable debug in production for better performance
      },
      global: {
        headers: {
          'x-client-info': 'supabase-js-web',
        },
      },
      db: {
        schema: 'public',
      },
      // Optimize realtime settings
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  )

  return client
}

// Helper to reset client (useful for logout or debugging)
export const resetClient = () => {
  client = null
}
