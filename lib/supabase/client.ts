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
        storage: window.localStorage,
        storageKey: 'sb-auth-token',
        debug: false,
      },
      cookies: {
        get(name: string) {
          const cookies = document.cookie.split(';')
          const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))
          if (!cookie) return undefined
          return cookie.split('=')[1]
        },
        set(name: string, value: string, options: any) {
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

// Helper to completely reset auth state
export const clearAuthStorage = () => {
  try {
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
    
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
    })
    
    console.log('✅ Auth storage cleared')
    return true
  } catch (error) {
    console.error('❌ Error clearing auth storage:', error)
    return false
  }
}

// Helper to reset client (useful for logout or debugging)
export const resetClient = () => {
  client = null
  clearAuthStorage()
}
