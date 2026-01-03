import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
  if (client) return client

  if (typeof window === 'undefined') {
    throw new Error('createClient must be called on the client side')
  }

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
