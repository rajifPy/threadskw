'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/supabase/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const supabase = createClient()

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      console.log('[AuthProvider] Fetching profile for user:', userId)
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        console.error('[AuthProvider] Error fetching profile:', error)
        return null
      }
      
      if (!profileData) {
        console.warn('[AuthProvider] Profile not found for user:', userId)
      }
      
      return profileData
    } catch (error) {
      console.error('[AuthProvider] Error in fetchProfile:', error)
      return null
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    let mounted = true
    let retryTimeout: NodeJS.Timeout

    const initAuth = async () => {
      try {
        console.log('[AuthProvider] Initializing auth...')
        
        // Get initial session with retry logic
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[AuthProvider] Error getting session:', error)
          
          // Retry once after 1 second
          if (!initialized) {
            retryTimeout = setTimeout(() => {
              if (mounted) {
                initAuth()
              }
            }, 1000)
            return
          }
        }

        if (mounted) {
          if (session?.user) {
            console.log('[AuthProvider] User session found:', session.user.email)
            setUser(session.user)
            
            // Fetch profile with retry
            let profileData = await fetchProfile(session.user.id)
            
            // If profile not found, wait and retry once
            if (!profileData) {
              console.log('[AuthProvider] Profile not found, retrying in 2 seconds...')
              await new Promise(resolve => setTimeout(resolve, 2000))
              profileData = await fetchProfile(session.user.id)
            }
            
            setProfile(profileData)
          } else {
            console.log('[AuthProvider] No session found')
            setUser(null)
            setProfile(null)
          }
          setLoading(false)
          setInitialized(true)
        }
      } catch (error) {
        console.error('[AuthProvider] Error in initAuth:', error)
        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event, session?.user?.email)
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user)
            const profileData = await fetchProfile(session.user.id)
            setProfile(profileData)
          } else {
            setUser(null)
            setProfile(null)
          }
          
          // Always set loading to false after auth state change
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      if (retryTimeout) clearTimeout(retryTimeout)
      subscription.unsubscribe()
    }
  }, [fetchProfile, initialized, supabase.auth])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error('[AuthProvider] Error signing out:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
