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

  const fetchProfile = useCallback(async (userId: string, retryAttempt: number = 0): Promise<Profile | null> => {
    if (isFetchingRef.current && retryAttempt === 0) {
      console.log('⏳ [Auth] Already fetching profile, skipping...')
      return null
    }

    isFetchingRef.current = true
    
    try {
      console.log(`🔵 [Auth] Fetching profile for user ${userId} (attempt ${retryAttempt + 1})`)
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (error) {
        console.error('❌ [Auth] Profile fetch error:', error)
        console.error('❌ [Auth] Error code:', error.code)
        console.error('❌ [Auth] Error message:', error.message)
        
        // Retry on network errors
        if (retryAttempt < 2 && (error.message.includes('fetch') || error.message.includes('network'))) {
          console.log('🔄 [Auth] Retrying profile fetch...')
          await new Promise(resolve => setTimeout(resolve, 1000))
          return fetchProfile(userId, retryAttempt + 1)
        }
        
        return null
      }
      
      if (data) {
        console.log('✅ [Auth] Profile loaded successfully:', data.username)
        console.log('🔵 [Auth] Profile data:', JSON.stringify(data, null, 2))
        return data
      }
      
      console.log('⚠️ [Auth] Profile not found for user:', userId)
      return null
    } catch (error) {
      console.error('❌ [Auth] Profile fetch exception:', error)
      
      // Retry on exceptions
      if (retryAttempt < 2) {
        console.log('🔄 [Auth] Retrying after exception...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        return fetchProfile(userId, retryAttempt + 1)
      }
      
      return null
    } finally {
      if (retryAttempt === 0) {
        isFetchingRef.current = false
      }
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
        console.log('🔵 [Auth] Initializing authentication...')
        
        // ✅ Use getSession instead of getUser (faster)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('❌ [Auth] Session error:', sessionError)
          if (mounted) {
            setLoading(false)
          }
          return
        }

        if (session?.user && mounted) {
          console.log('✅ [Auth] Session found for:', session.user.email)
          console.log('🔵 [Auth] User ID:', session.user.id)
          setUser(session.user)
          
          // ✅ Fetch profile with retry logic
          console.log('🔵 [Auth] Fetching profile...')
          const profileData = await fetchProfile(session.user.id)
          
          if (mounted) {
            if (profileData) {
              console.log('✅ [Auth] Profile set successfully:', profileData.username)
              setProfile(profileData)
            } else {
              console.log('⚠️ [Auth] Profile not found, will retry on home page')
              setProfile(null)
            }
          }
        } else {
          console.log('⚠️ [Auth] No active session')
        }
        
        if (mounted) {
          setLoading(false)
          initCompleteRef.current = true
          console.log('✅ [Auth] Initialization complete')
        }
      } catch (error) {
        console.error('❌ [Auth] Init error:', error)
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
