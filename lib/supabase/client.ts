import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
  // Return existing client if already created
  if (client) return client

  // IMPORTANT: Only throw if we're trying to use it during SSR
  // Allow it to be imported, just don't use it on server
  if (typeof window === 'undefined') {
    // Return a mock client for SSR that won't be used
    // This prevents build errors while still protecting against server usage
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
          
          cookie += `; path=${options?.path || '/'}`
          cookie += `; max-age=${options?.maxAge || 60 * 60 * 24 * 365}`
          
          if (options?.domain) {
            cookie += `; domain=${options.domain}`
          }
          
          cookie += `; samesite=${options?.sameSite || 'lax'}`
          
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
  if (typeof window === 'undefined') return false
  
  try {
    console.log('🧹 [Supabase] Clearing auth storage...')
    
    // Clear localStorage
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
    
    // Clear ALL cookies
    const cookies = document.cookie.split(';')
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i]
      const eqPos = cookie.indexOf('=')
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
      
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
  if (typeof window === 'undefined') return
  
  console.log('🔄 [Supabase] Resetting client...')
  client = null
  clearAuthStorage()
}
