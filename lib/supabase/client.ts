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
        // CRITICAL: Use window.localStorage but make sure it's available
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        // IMPORTANT: Use a consistent storage key
        storageKey: 'sb-auth-token',
        debug: false,
      },
      cookies: {
        // CRITICAL: Define cookie methods for SSR compatibility
        get(name: string) {
          if (typeof window === 'undefined') return undefined
          const cookies = document.cookie.split(';')
          const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))
          if (!cookie) return undefined
          return cookie.split('=')[1]
        },
        set(name: string, value: string, options: any) {
          if (typeof window === 'undefined') return
          let cookie = `${name}=${value}`
          if (options?.maxAge) {
            cookie += `; max-age=${options.maxAge}`
          }
          if (options?.path) {
            cookie += `; path=${options.path}`
          }
          if (options?.domain) {
            cookie += `; domain=${options.domain}`
          }
          if (options?.sameSite) {
            cookie += `; samesite=${options.sameSite}`
          }
          if (options?.secure) {
            cookie += '; secure'
          }
          document.cookie = cookie
        },
        remove(name: string, options: any) {
          if (typeof window === 'undefined') return
          let cookie = `${name}=; max-age=0`
          if (options?.path) {
            cookie += `; path=${options.path}`
          }
          if (options?.domain) {
            cookie += `; domain=${options.domain}`
          }
          document.cookie = cookie
        },
      },
      global: {
        headers: {
          'x-client-info': 'supabase-js-web',
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
