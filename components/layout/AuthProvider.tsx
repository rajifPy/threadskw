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

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchProfile = useCallback(async (userId: string, userMetadata?: any): Promise<Profile | null> => {
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

        return newProfile as Profile
      }
      
      return null
    } catch (error) {
      console.error('❌ Exception in fetchProfile:', error)
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

    const initAuth = async () => {
      try {
        // 🔥 CRITICAL: Use getUser() instead of getSession()
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('❌ Auth error:', error)
          if (mounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        if (currentUser && mounted) {
          console.log('✅ User authenticated:', currentUser.email)
          setUser(currentUser)
          
          const profileData = await fetchProfile(currentUser.id, currentUser.user_metadata)
          if (mounted) {
            setProfile(profileData)
          }
        }
        
        if (mounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('❌ Init error:', error)
        if (mounted) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth event:', event)
        
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          const profileData = await fetchProfile(session.user.id, session.user.user_metadata)
          setProfile(profileData)
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
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
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim()
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      })
    } catch (error) {
      console.error('❌ Sign out error:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
