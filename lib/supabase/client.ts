import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
  // Return existing client if already created
  if (client) return client

  // IMPORTANT: Only throw if we're trying to use it during SSR
  if (typeof window === 'undefined') {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        // CRITICAL: Store in cookies only, not localStorage
        storage: undefined, // This disables localStorage
        storageKey: undefined,
        debug: false,
      },
      cookies: {
        get(name: string) {
          const cookies = document.cookie.split(';')
          const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))
          if (!cookie) return undefined
          return decodeURIComponent(cookie.split('=')[1])
        },
        set(name: string, value: string, options: any) {
          let cookie = `${name}=${encodeURIComponent(value)}`
          
          // IMPORTANT: Set proper cookie attributes for security
          cookie += `; path=${options?.path || '/'}`
          cookie += `; max-age=${options?.maxAge || 60 * 60 * 24 * 365}` // 1 year
          
          if (options?.domain) {
            cookie += `; domain=${options.domain}`
          }
          
          // SameSite MUST be Lax for OAuth to work
          cookie += `; samesite=${options?.sameSite || 'lax'}`
          
          // Secure in production
          if (window.location.protocol === 'https:') {
            cookie += '; secure'
          }
          
          document.cookie = cookie
        },
        remove(name: string, options: any) {
          let cookie = `${name}=; max-age=0`
          cookie += `; path=${options?.path || '/'}`
          
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

// Helper to clear only auth cookies (not localStorage)
export const clearAuthStorage = () => {
  if (typeof window === 'undefined') return false
  
  try {
    console.log('🧹 [Supabase] Clearing auth cookies...')
    
    // Only clear cookies, don't touch localStorage
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i]
      const eqPos = cookie.indexOf('=')
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
      
      // Only clear Supabase auth cookies
      if (name.includes('sb-') || name.includes('supabase')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`
      }
    }
    
    console.log('✅ [Supabase] Auth cookies cleared')
    return true
  } catch (error) {
    console.error('❌ [Supabase] Error clearing auth cookies:', error)
    return false
  }
}

// Helper to reset client
export const resetClient = () => {
  if (typeof window === 'undefined') return
  
  console.log('🔄 [Supabase] Resetting client...')
  client = null
  clearAuthStorage()
}
