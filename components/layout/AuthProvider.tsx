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
  const initializingRef = useRef(false)
  const authStateReceivedRef = useRef(false)

  const createProfileForUser = async (userId: string, userMetadata: any): Promise<Profile | null> => {
    try {
      console.log('📝 [AuthProvider] Creating profile for user:', userId)
      
      const username = (
        userMetadata?.username ||
        userMetadata?.preferred_username ||
        userMetadata?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
        userMetadata?.email?.split('@')[0] ||
        `user_${userId.substring(0, 8)}`
      ).toLowerCase().replace(/[^a-z0-9_]/g, '_')

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: username,
          full_name: userMetadata?.full_name || userMetadata?.name || null,
          avatar_url: userMetadata?.avatar_url || userMetadata?.picture || null,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          console.log('ℹ️ [AuthProvider] Profile already exists, fetching...')
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
          return existingProfile
        }
        console.error('❌ [AuthProvider] Error creating profile:', error)
        return null
      }

      console.log('✅ [AuthProvider] Profile created:', data)
      return data as Profile
    } catch (error) {
      console.error('❌ [AuthProvider] Exception creating profile:', error)
      return null
    }
  }

  const fetchProfile = useCallback(async (userId: string, userMetadata?: any): Promise<Profile | null> => {
    try {
      console.log('🔍 [AuthProvider] Fetching profile for user:', userId)
      
      let profile = null
      const maxAttempts = 6
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔄 [AuthProvider] Fetch attempt ${attempt}/${maxAttempts}`)
        
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
        
        if (error && error.code !== 'PGRST116') {
          console.error('❌ [AuthProvider] Error fetching profile:', error)
        }
        
        if (profileData) {
          profile = profileData
          console.log('✅ [AuthProvider] Profile found:', profile.username)
          break
        }
        
        if (!profileData && attempt < maxAttempts) {
          const delay = attempt === 1 ? 500 : Math.min(1000 * attempt, 4000)
          console.log(`⏳ [AuthProvider] Waiting ${delay}ms before next attempt...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      
      if (!profile && userMetadata) {
        console.log('📝 [AuthProvider] Creating profile after failed fetches...')
        profile = await createProfileForUser(userId, userMetadata)
      }
      
      return profile
    } catch (error) {
      console.error('❌ [AuthProvider] Exception in fetchProfile:', error)
      return null
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) {
      console.log('🔄 [AuthProvider] Refreshing profile...')
      const profileData = await fetchProfile(user.id, user.user_metadata)
      setProfile(profileData)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    let mounted = true
    let fallbackTimeout: NodeJS.Timeout

    // Setup auth state listener FIRST (most reliable)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [AuthProvider] Auth state changed:', event, session?.user?.email)
        authStateReceivedRef.current = true
        
        if (!mounted) return
        
        if (session?.user) {
          setUser(session.user)
          
          // Fetch profile for any auth event with user
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            console.log('🔐 [AuthProvider] User session detected, fetching profile...')
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
            setProfile(profileData)
          }
          
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 [AuthProvider] User signed out')
          setUser(null)
          setProfile(null)
          setLoading(false)
        } else {
          // No session and not signed out - still loading
          console.log('ℹ️ [AuthProvider] No session in auth state')
        }
      }
    )

    // Then try getSession (but don't rely on it exclusively)
    const initAuth = async () => {
      if (initializingRef.current) return
      initializingRef.current = true

      try {
        console.log('🚀 [AuthProvider] Checking initial session...')
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('❌ [AuthProvider] Error getting session:', error)
        }

        // Only update state if auth state change hasn't already handled it
        if (mounted && !authStateReceivedRef.current) {
          if (session?.user) {
            console.log('✅ [AuthProvider] Initial session found:', session.user.email)
            setUser(session.user)
            
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
            setProfile(profileData)
          } else {
            console.log('ℹ️ [AuthProvider] No initial session')
          }
          setLoading(false)
        } else {
          console.log('ℹ️ [AuthProvider] Auth state already handled by listener')
        }
      } catch (error) {
        console.error('❌ [AuthProvider] Error in initAuth:', error)
        if (mounted && !authStateReceivedRef.current) {
          setLoading(false)
        }
      }
    }

    // Start initialization
    initAuth()

    // Fallback: Stop loading after 12 seconds no matter what
    fallbackTimeout = setTimeout(() => {
      if (mounted && loading && !user) {
        console.warn('⏱️ [AuthProvider] Fallback timeout - stopping loading state')
        setLoading(false)
      }
    }, 12000)

    return () => {
      mounted = false
      clearTimeout(fallbackTimeout)
      subscription.unsubscribe()
    }
  }, []) // Only run once on mount

  const signOut = async () => {
    try {
      console.log('👋 [AuthProvider] Signing out...')
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error('❌ [AuthProvider] Error signing out:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
