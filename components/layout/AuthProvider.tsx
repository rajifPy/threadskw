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

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  
  const isFetchingRef = useRef(false)
  const profileCacheRef = useRef<Map<string, Profile>>(new Map())
  const currentUserIdRef = useRef<string | null>(null)
  const initCompleteRef = useRef(false)

  const fetchProfile = useCallback(async (userId: string, userMetadata?: any): Promise<Profile | null> => {
    // Clear cache jika user berubah
    if (currentUserIdRef.current && currentUserIdRef.current !== userId) {
      console.log('🔄 [Auth] User changed, clearing profile cache')
      profileCacheRef.current.clear()
    }
    currentUserIdRef.current = userId

    // Check cache first
    if (profileCacheRef.current.has(userId)) {
      console.log('✅ [Auth] Using cached profile')
      return profileCacheRef.current.get(userId)!
    }

    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      console.log('⏳ [Auth] Profile fetch already in progress, waiting...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      return profileCacheRef.current.get(userId) || null
    }

    isFetchingRef.current = true
    
    try {
      console.log('🔍 [Auth] Fetching profile for user:', userId)
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ [Auth] Profile fetch error:', error)
        return null
      }
      
      if (data) {
        console.log('✅ [Auth] Profile found:', data.username)
        profileCacheRef.current.set(userId, data)
        return data
      }
      
      // Create profile if not exists
      console.log('📝 [Auth] Profile not found, creating...')
      
      const username = (
        userMetadata?.username ||
        userMetadata?.preferred_username ||
        userMetadata?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
        userMetadata?.email?.split('@')[0] ||
        `user_${userId.substring(0, 8)}`
      ).toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 30)

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: username,
          full_name: userMetadata?.full_name || userMetadata?.name || null,
          avatar_url: userMetadata?.avatar_url || userMetadata?.picture || null,
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ [Auth] Profile creation error:', insertError)
        return null
      }

      if (newProfile) {
        console.log('✅ [Auth] Profile created:', newProfile.username)
        profileCacheRef.current.set(userId, newProfile as Profile)
        return newProfile as Profile
      }
      
      return null
    } catch (error) {
      console.error('❌ [Auth] Exception in fetchProfile:', error)
      return null
    } finally {
      isFetchingRef.current = false
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) {
      console.log('🔄 [Auth] Refreshing profile...')
      profileCacheRef.current.delete(user.id)
      const profileData = await fetchProfile(user.id, user.user_metadata)
      setProfile(profileData)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      if (initCompleteRef.current) {
        console.log('ℹ️ [Auth] Init already complete, skipping')
        return
      }
      
      try {
        console.log('🔐 [Auth] Initializing auth...')
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('❌ [Auth] Session error:', sessionError)
          await supabase.auth.signOut()
          
          if (mounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        if (session?.user) {
          console.log('✅ [Auth] Session found:', session.user.email)
          
          if (mounted) {
            setUser(session.user)
            
            // Fetch profile
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
            
            if (mounted) {
              setProfile(profileData)
              console.log('✅ [Auth] Auth initialization complete')
            }
          }
        } else {
          console.log('ℹ️ [Auth] No session found')
        }
        
        if (mounted) {
          setLoading(false)
          initCompleteRef.current = true
        }
      } catch (error) {
        console.error('❌ [Auth] Init error:', error)
        if (mounted) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [Auth] Auth state changed:', event)
        
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ [Auth] User signed in:', session.user.email)
          
          // Clear cache on account switch
          if (currentUserIdRef.current && currentUserIdRef.current !== session.user.id) {
            console.log('🔄 [Auth] Different user detected, clearing cache')
            profileCacheRef.current.clear()
          }
          
          setUser(session.user)
          setLoading(true)
          
          const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
          
          if (mounted) {
            setProfile(profileData)
            setLoading(false)
          }
          
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 [Auth] User signed out')
          profileCacheRef.current.clear()
          currentUserIdRef.current = null
          initCompleteRef.current = false
          setUser(null)
          setProfile(null)
          setLoading(false)
          
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 [Auth] Token refreshed')
          setUser(session.user)
        }
      }
    )

    initAuth()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = async () => {
    try {
      console.log('👋 [Auth] Signing out...')
      await supabase.auth.signOut()
      
      // Clear everything
      profileCacheRef.current.clear()
      currentUserIdRef.current = null
      initCompleteRef.current = false
      setUser(null)
      setProfile(null)
      
      console.log('✅ [Auth] Sign out complete')
    } catch (error) {
      console.error('❌ [Auth] Sign out error:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
