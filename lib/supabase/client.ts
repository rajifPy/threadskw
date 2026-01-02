import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
  // Return existing client if already created
  if (client) return client

  // Check if we're in browser
  if (typeof window === 'undefined') {
    throw new Error('createClient can only be used in browser')
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
        // CRITICAL: Don't set storage to localStorage
        // Let Supabase SSR handle it with cookies
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
          
          // Set default options
          cookie += `; path=${options?.path || '/'}`
          cookie += `; max-age=${options?.maxAge || 60 * 60 * 24 * 365}` // 1 year default
          
          if (options?.domain) {
            cookie += `; domain=${options.domain}`
          }
          
          // Use Lax for PKCE flow compatibility
          cookie += `; samesite=${options?.sameSite || 'lax'}`
          
          // Use secure in production
          if (window.location.protocol === 'https:' || options?.secure) {
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

// Helper to completely reset auth state
export const clearAuthStorage = () => {
  try {
    console.log('🧹 [Supabase] Clearing auth storage...')
    
    // Clear localStorage (just in case)
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes('supabase') || key.includes('sb-'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    // Clear sessionStorage
    sessionStorage.clear()
    
    // Clear ALL cookies (important!)
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i]
      const eqPos = cookie.indexOf('=')
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
      
      // Clear with multiple domain variations
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`
    }
    
    console.log('✅ [Supabase] Auth storage cleared')
    return true
  } catch (error) {
    console.error('❌ [Supabase] Error clearing auth storage:', error)
    return false
  }
}

// Helper to reset client
export const resetClient = () => {
  console.log('🔄 [Supabase] Resetting client...')
  client = null
  clearAuthStorage()
}
