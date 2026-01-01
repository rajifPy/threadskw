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
  const [retryCount, setRetryCount] = useState(0)
  const supabase = createClient()

  const createProfileForUser = async (userId: string, userMetadata: any) => {
    try {
      console.log('[AuthProvider] Creating profile for user:', userId)
      
      const username = (
        userMetadata?.username ||
        userMetadata?.preferred_username ||
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
        console.error('[AuthProvider] Error creating profile:', error)
        return null
      }

      console.log('[AuthProvider] Profile created successfully:', data)
      return data as Profile
    } catch (error) {
      console.error('[AuthProvider] Exception creating profile:', error)
      return null
    }
  }

  const fetchProfile = useCallback(async (userId: string, userMetadata?: any, attempt = 1): Promise<Profile | null> => {
    try {
      console.log(`[AuthProvider] Fetching profile attempt ${attempt} for user:`, userId)
      
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
        console.warn('[AuthProvider] Profile not found')
        
        // If no profile found and we have user metadata, try to create it
        if (userMetadata && attempt === 1) {
          console.log('[AuthProvider] Attempting to create profile...')
          const newProfile = await createProfileForUser(userId, userMetadata)
          if (newProfile) {
            return newProfile
          }
          
          // If creation failed, wait and retry fetch
          if (attempt < 3) {
            console.log('[AuthProvider] Retrying profile fetch in 2 seconds...')
            await new Promise(resolve => setTimeout(resolve, 2000))
            return fetchProfile(userId, userMetadata, attempt + 1)
          }
        }
        
        return null
      }
      
      console.log('[AuthProvider] Profile found:', profileData.username)
      return profileData
    } catch (error) {
      console.error('[AuthProvider] Exception in fetchProfile:', error)
      return null
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id, user.user_metadata)
      setProfile(profileData)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    let mounted = true
    let initTimeout: NodeJS.Timeout

    const initAuth = async () => {
      try {
        console.log('[AuthProvider] Initializing auth...')
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[AuthProvider] Error getting session:', error)
        }

        if (mounted) {
          if (session?.user) {
            console.log('[AuthProvider] User session found:', session.user.email)
            setUser(session.user)
            
            // Fetch profile with retry and auto-creation
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
            setProfile(profileData)
            
            // If still no profile after retries, set loading to false anyway
            // Don't block the UI forever
            if (!profileData) {
              console.error('[AuthProvider] Failed to create/fetch profile after retries')
            }
          } else {
            console.log('[AuthProvider] No session found')
            setUser(null)
            setProfile(null)
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('[AuthProvider] Error in initAuth:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    // Set a maximum timeout for initialization
    initTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[AuthProvider] Auth initialization timeout - forcing loading to false')
        setLoading(false)
      }
    }, 10000) // 10 second max timeout

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event, session?.user?.email)
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user)
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
            setProfile(profileData)
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
