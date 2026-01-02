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

  const fetchProfile = useCallback(async (userId: string, userMetadata?: any): Promise<Profile | null> => {
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
      
      // Profile not found, try to create
      if (userMetadata) {
        console.log('📝 [AuthProvider] Creating profile...')
        
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
          console.error('❌ [AuthProvider] Profile creation error:', insertError)
          return null
        }

        console.log('✅ [AuthProvider] Profile created:', newProfile)
        return newProfile as Profile
      }
      
      return null
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

    console.log('🚀 [AuthProvider] Initializing...')

    const initAuth = async () => {
      try {
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
            }
          }
        }
        
        if (mounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('❌ [AuthProvider] Init error:', error)
        if (mounted) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [AuthProvider] Auth event:', event)
        
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ [AuthProvider] User signed in:', session.user.email)
          setUser(session.user)
          
          const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
          setProfile(profileData)
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 [AuthProvider] User signed out')
          setUser(null)
          setProfile(null)
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 [AuthProvider] Token refreshed')
          setUser(session.user)
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

    initAuth()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

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
