import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
  // If on server-side, return a new instance (won't be cached)
  // This allows SSR to work without error
  if (typeof window === 'undefined') {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // On client-side, reuse the same instance
  if (client) return client

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}

// Helper to clear auth (only cookies, NO localStorage)
export const clearAuthStorage = async () => {
  if (typeof window === 'undefined') return false
  
  try {
    console.log('🧹 [Supabase] Signing out (cookie-only)...')
    
    const supabase = createClient()
    await supabase.auth.signOut()
    
    console.log('✅ [Supabase] Auth cleared')
    return true
  } catch (error) {
    console.error('❌ [Supabase] Error clearing auth:', error)
    return false
  }
}

// Helper to reset client
export const resetClient = () => {
  if (typeof window === 'undefined') return
  console.log('🔄 [Supabase] Resetting client...')
  client = null
}
