'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
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
  const supabase = createClient()
  const mountedRef = useRef(true)
  const loadingTimeoutRef = useRef<NodeJS.Timeout>()

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      console.log('🔍 [AuthProvider] Fetching profile for:', userId)
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ [AuthProvider] Profile fetch error:', error)
        return null
      }
      
      if (data) {
        console.log('✅ [AuthProvider] Profile found:', data.username)
        return data
      }
      
      console.warn('⚠️ [AuthProvider] Profile not found')
      return null
    } catch (error) {
      console.error('❌ [AuthProvider] Exception fetching profile:', error)
      return null
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) {
      console.log('🔄 [AuthProvider] Refreshing profile...')
      const profileData = await fetchProfile(user.id)
      if (mountedRef.current) {
        setProfile(profileData)
      }
    }
  }, [user, fetchProfile])

  useEffect(() => {
    let mounted = true
    mountedRef.current = true

    // Set loading timeout - stop loading after 8 seconds
    loadingTimeoutRef.current = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⏱️ [AuthProvider] Loading timeout reached')
        setLoading(false)
      }
    }, 8000)

    const initAuth = async () => {
      try {
        console.log('🚀 [AuthProvider] Initializing auth...')
        
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('❌ [AuthProvider] Session error:', error)
          if (mounted) setLoading(false)
          return
        }

        if (session?.user) {
          console.log('✅ [AuthProvider] Session found:', session.user.email)
          
          if (mounted) {
            setUser(session.user)
            
            // Fetch profile
            const profileData = await fetchProfile(session.user.id)
            if (mounted) {
              setProfile(profileData)
              setLoading(false)
            }
          }
        } else {
          console.log('ℹ️ [AuthProvider] No session')
          if (mounted) setLoading(false)
        }
      } catch (error) {
        console.error('❌ [AuthProvider] Init error:', error)
        if (mounted) setLoading(false)
      }
    }

    // Setup auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [AuthProvider] Auth event:', event)
        
        if (!mounted) return

        // Clear loading timeout when we get an auth event
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            console.log('✅ [AuthProvider] User signed in:', session.user.email)
            setUser(session.user)
            
            const profileData = await fetchProfile(session.user.id)
            setProfile(profileData)
            setLoading(false)
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 [AuthProvider] User signed out')
          setUser(null)
          setProfile(null)
          setLoading(false)
        } else if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            console.log('✅ [AuthProvider] Initial session:', session.user.email)
            setUser(session.user)
            
            const profileData = await fetchProfile(session.user.id)
            setProfile(profileData)
          }
          setLoading(false)
        }
      }
    )

    // Start initialization
    initAuth()

    return () => {
      mounted = false
      mountedRef.current = false
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      subscription.unsubscribe()
    }
  }, []) // Run once on mount

  const signOut = async () => {
    try {
      console.log('👋 [AuthProvider] Signing out...')
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error('❌ [AuthProvider] Sign out error:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
