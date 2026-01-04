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
  
  // ✅ OPTIMASI: Prevent duplicate fetches
  const isFetchingRef = useRef(false)
  const profileCacheRef = useRef<Map<string, Profile>>(new Map())

  const fetchProfile = useCallback(async (userId: string, userMetadata?: any): Promise<Profile | null> => {
    // ✅ Check cache first
    if (profileCacheRef.current.has(userId)) {
      console.log('✅ Using cached profile')
      return profileCacheRef.current.get(userId)!
    }

    // ✅ Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      console.log('⏳ Profile fetch already in progress, waiting...')
      await new Promise(resolve => setTimeout(resolve, 500))
      return profileCacheRef.current.get(userId) || null
    }

    isFetchingRef.current = true
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ Profile fetch error:', error)
        return null
      }
      
      if (data) {
        console.log('✅ Profile found:', data.username)
        profileCacheRef.current.set(userId, data)
        return data
      }
      
      // Create profile if not exists
      if (userMetadata) {
        console.log('📝 Creating profile...')
        
        const username = (
          userMetadata.username ||
          userMetadata.preferred_username ||
          userMetadata.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
          userMetadata.email?.split('@')[0] ||
          `user_${userId.substring(0, 8)}`
        ).toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 30)

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            username: username,
            full_name: userMetadata.full_name || userMetadata.name || null,
            avatar_url: userMetadata.avatar_url || userMetadata.picture || null,
          })
          .select()
          .single()

        if (insertError) {
          console.error('❌ Profile creation error:', insertError)
          return null
        }

        if (newProfile) {
          profileCacheRef.current.set(userId, newProfile as Profile)
          return newProfile as Profile
        }
      }
      
      return null
    } catch (error) {
      console.error('❌ Exception in fetchProfile:', error)
      return null
    } finally {
      isFetchingRef.current = false
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) {
      // ✅ Clear cache untuk force refresh
      profileCacheRef.current.delete(user.id)
      const profileData = await fetchProfile(user.id, user.user_metadata)
      setProfile(profileData)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    let mounted = true
    let initComplete = false

    const initAuth = async () => {
      // ✅ Prevent re-initialization
      if (initComplete) return
      
      try {
        console.log('🔐 [Auth] Initializing...')
        
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
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
            setProfile(profileData)
          }
        } else {
          console.log('ℹ️ [Auth] No session')
        }
        
        if (mounted) {
          setLoading(false)
          initComplete = true
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

    // ✅ OPTIMASI: Debounce auth state changes
    let authChangeTimeout: NodeJS.Timeout
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [Auth] Event:', event)
        
        if (!mounted) return

        // ✅ Debounce untuk prevent multiple rapid calls
        clearTimeout(authChangeTimeout)
        authChangeTimeout = setTimeout(async () => {
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('✅ [Auth] User signed in:', session.user.email)
            setUser(session.user)
            const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
            setProfile(profileData)
            setLoading(false)
          } else if (event === 'SIGNED_OUT') {
            console.log('👋 [Auth] User signed out')
            profileCacheRef.current.clear()
            setUser(null)
            setProfile(null)
            setLoading(false)
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            console.log('🔄 [Auth] Token refreshed')
            setUser(session.user)
          }
        }, 100) // 100ms debounce
      }
    )

    initAuth()

    return () => {
      mounted = false
      clearTimeout(authChangeTimeout)
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = async () => {
    try {
      console.log('👋 [Auth] Signing out...')
      await supabase.auth.signOut()
      profileCacheRef.current.clear()
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
