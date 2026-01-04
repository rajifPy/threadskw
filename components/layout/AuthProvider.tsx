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
  const initCompleteRef = useRef(false)

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (isFetchingRef.current) {
      console.log('⏳ [Auth] Already fetching profile, skipping...')
      return null
    }

    isFetchingRef.current = true
    
    try {
      // ✅ Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      )
      
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      const result = await Promise.race([fetchPromise, timeoutPromise])
      
      if (!result || 'error' in result) {
        const error = 'error' in result ? result.error : null
        if (error && error.code !== 'PGRST116') {
          console.error('❌ Profile error:', error)
        }
        return null
      }
      
      if (result.data) {
        console.log('✅ Profile loaded:', result.data.username)
        return result.data
      }
      
      console.log('⚠️ Profile not found')
      return null
    } catch (error) {
      console.error('❌ Profile fetch exception:', error)
      return null
    } finally {
      isFetchingRef.current = false
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    if (initCompleteRef.current) return
    
    let mounted = true

    const initAuth = async () => {
      try {
        // ✅ Use getSession instead of getUser (faster)
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user && mounted) {
          console.log('✅ Session found:', session.user.email)
          setUser(session.user)
          
          // ✅ Fetch profile in parallel, don't block UI
          fetchProfile(session.user.id).then(profileData => {
            if (mounted) {
              setProfile(profileData)
            }
          })
        }
        
        if (mounted) {
          setLoading(false)
          initCompleteRef.current = true
        }
      } catch (error) {
        console.error('❌ Init error:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        console.log('🔄 Auth event:', event)

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          // ✅ Fetch profile asynchronously
          fetchProfile(session.user.id).then(profileData => {
            if (mounted) setProfile(profileData)
          })
          
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          initCompleteRef.current = false
          
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
      }
    )

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
      initCompleteRef.current = false
      console.log('✅ Signed out')
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
