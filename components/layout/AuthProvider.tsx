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
  const supabase = createClient()

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
      const maxAttempts = 5
      
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
          const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 5000)
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
    let initTimeout: NodeJS.Timeout
    let sessionCheckAborted = false

    const initAuth = async () => {
      try {
        console.log('🚀 [AuthProvider] Initializing auth...')
        
        // Create abort controller for session check
        const controller = new AbortController()
        
        // Set timeout to abort session check
        const timeoutId = setTimeout(() => {
          sessionCheckAborted = true
          controller.abort()
          console.warn('⏱️ [AuthProvider] Session check timeout, continuing without session')
          if (mounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
        }, 8000) // 8 second timeout instead of 15
        
        try {
          const { data: { session }, error } = await supabase.auth.getSession()
          
          clearTimeout(timeoutId)
          
          if (sessionCheckAborted) {
            console.log('⚠️ [AuthProvider] Session check was aborted')
            return
          }
          
          if (error) {
            console.error('❌ [AuthProvider] Error getting session:', error)
          }

          if (mounted) {
            if (session?.user) {
              console.log('✅ [AuthProvider] User session found:', session.user.email)
              setUser(session.user)
              
              const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
              setProfile(profileData)
              
              if (!profileData) {
                console.error('⚠️ [AuthProvider] Failed to create/fetch profile')
              }
            } else {
              console.log('ℹ️ [AuthProvider] No session found')
              setUser(null)
              setProfile(null)
            }
            setLoading(false)
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId)
          
          if (fetchError.name === 'AbortError') {
            console.log('⚠️ [AuthProvider] Session fetch aborted due to timeout')
          } else {
            console.error('❌ [AuthProvider] Error fetching session:', fetchError)
          }
          
          if (mounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('❌ [AuthProvider] Error in initAuth:', error)
        if (mounted) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    }

    // Fallback timeout - force loading to false after 10 seconds
    initTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⏱️ [AuthProvider] Force stopping loading state after 10s')
        setLoading(false)
      }
    }, 10000)

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [AuthProvider] Auth state changed:', event, session?.user?.email)
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user)
            
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              console.log('🔐 [AuthProvider] Sign in detected, ensuring profile exists...')
              const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
              setProfile(profileData)
            } else {
              const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
              setProfile(profileData)
            }
          } else {
            setUser(null)
            setProfile(null)
          }
          
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(initTimeout)
      subscription.unsubscribe()
    }
  }, [fetchProfile, supabase.auth])

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
