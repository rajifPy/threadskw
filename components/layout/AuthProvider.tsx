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
  const initStartedRef = useRef(false)

  const createProfileIfNeeded = useCallback(async (userId: string, userMetadata: any): Promise<Profile | null> => {
    try {
      console.log('📝 [AuthProvider] Creating profile for:', userId)
      
      const username = (
        userMetadata?.username ||
        userMetadata?.preferred_username ||
        userMetadata?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
        userMetadata?.email?.split('@')[0] ||
        `user_${userId.substring(0, 8)}`
      ).toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 30)

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
        // If duplicate, try to fetch existing
        if (error.code === '23505') {
          console.log('ℹ️ [AuthProvider] Profile already exists, fetching...')
          const { data: existing } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
          return existing
        }
        
        console.error('❌ [AuthProvider] Profile creation error:', error)
        return null
      }

      console.log('✅ [AuthProvider] Profile created:', data)
      return data as Profile
    } catch (error) {
      console.error('❌ [AuthProvider] Exception creating profile:', error)
      return null
    }
  }, [supabase])

  const fetchProfile = useCallback(async (userId: string, userMetadata?: any): Promise<Profile | null> => {
    try {
      console.log('🔍 [AuthProvider] Fetching profile for:', userId)
      
      // Try immediate fetch
      const { data: immediateProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ [AuthProvider] Profile fetch error:', error)
      }
      
      if (immediateProfile) {
        console.log('✅ [AuthProvider] Profile found immediately:', immediateProfile.username)
        return immediateProfile
      }
      
      // If not found, wait and retry (for trigger to execute)
      console.log('⏳ [AuthProvider] Profile not found, waiting for trigger...')
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const { data: delayedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (delayedProfile) {
        console.log('✅ [AuthProvider] Profile found after delay:', delayedProfile.username)
        return delayedProfile
      }
      
      // Still not found? Create it manually
      if (userMetadata) {
        console.log('📝 [AuthProvider] Creating profile manually...')
        return await createProfileIfNeeded(userId, userMetadata)
      }
      
      return null
    } catch (error) {
      console.error('❌ [AuthProvider] Exception in fetchProfile:', error)
      return null
    }
  }, [supabase, createProfileIfNeeded])

  const refreshProfile = useCallback(async () => {
    if (user) {
      console.log('🔄 [AuthProvider] Refreshing profile...')
      const profileData = await fetchProfile(user.id, user.user_metadata)
      if (mountedRef.current) {
        setProfile(profileData)
      }
    }
  }, [user, fetchProfile])

  useEffect(() => {
    // Prevent double initialization in Strict Mode
    if (initStartedRef.current) return
    initStartedRef.current = true

    let mounted = true
    mountedRef.current = true

    console.log('🚀 [AuthProvider] Initializing...')

    // Set timeout to stop loading after 5 seconds
    const loadingTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⏱️ [AuthProvider] Loading timeout')
        setLoading(false)
      }
    }, 5000)

    const initAuth = async () => {
      try {
        console.log('🔑 [AuthProvider] Getting session from cookies...')
        
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
            
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
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

        clearTimeout(loadingTimeout)

        if (event === 'SIGNED_IN') {
          if (session?.user) {
            console.log('✅ [AuthProvider] User signed in:', session.user.email)
            setUser(session.user)
            
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
            setProfile(profileData)
            setLoading(false)
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 [AuthProvider] User signed out')
          setUser(null)
          setProfile(null)
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 [AuthProvider] Token refreshed')
          if (session?.user) {
            setUser(session.user)
          }
        } else if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            console.log('✅ [AuthProvider] Initial session loaded')
            setUser(session.user)
            
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
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
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, []) // Run once on mount

  const signOut = async () => {
    try {
      console.log('👋 [AuthProvider] Signing out...')
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      
      // Clear cookies
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim()
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      })
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
