'use client'

import { useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function QuickFixPage() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [fixing, setFixing] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const supabase = createClient()
  const router = useRouter()

  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const attemptProfileFix = async () => {
    if (!user) {
      toast.error('No user found. Please login first.')
      return
    }

    setFixing(true)
    setLogs([])
    
    try {
      addLog(`[Fix] Starting profile fix for user: ${user.email}`)
      addLog(`[Fix] User ID: ${user.id}`)

      // Step 1: Check if profile exists
      addLog('[Fix] Step 1: Checking if profile exists...')
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        addLog(`[Fix] Error checking profile: ${checkError.message}`)
        throw checkError
      }

      if (existingProfile) {
        addLog('[Fix] Profile already exists!')
        addLog(`[Fix] Username: ${existingProfile.username}`)
        toast.success('Profile already exists! Refreshing...')
        await refreshProfile()
        
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        addLog('[Fix] Redirecting to home...')
        router.push('/')
        return
      }

      // Step 2: Profile doesn't exist, create it
      addLog('[Fix] Step 2: Profile not found, creating new profile...')
      
      const rawUsername = 
        user.user_metadata?.username ||
        user.user_metadata?.preferred_username ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        `user_${user.id.substring(0, 8)}`

      addLog(`[Fix] Raw username: ${rawUsername}`)

      const cleanUsername = rawUsername
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .substring(0, 30)

      addLog(`[Fix] Clean username: ${cleanUsername}`)

      // Check if username is taken
      addLog('[Fix] Step 3: Checking if username is available...')
      const { data: usernameCheck } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', cleanUsername)
        .maybeSingle()

      let finalUsername = cleanUsername
      if (usernameCheck) {
        const suffix = Math.floor(Math.random() * 9999)
        finalUsername = `${cleanUsername}_${suffix}`
        addLog(`[Fix] Username taken, using: ${finalUsername}`)
      }

      // Step 4: Insert profile
      addLog('[Fix] Step 4: Creating profile...')
      const profileData = {
        id: user.id,
        username: finalUsername,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      }

      addLog(`[Fix] Profile data: ${JSON.stringify(profileData, null, 2)}`)

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      if (insertError) {
        addLog(`[Fix] ERROR creating profile: ${insertError.message}`)
        addLog(`[Fix] Error code: ${insertError.code}`)
        throw insertError
      }

      addLog('[Fix] ✅ Profile created successfully!')
      addLog(`[Fix] New profile: ${JSON.stringify(newProfile, null, 2)}`)
      
      toast.success('Profile created successfully!')
      
      addLog('[Fix] Step 5: Refreshing profile context...')
      await refreshProfile()
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      addLog('[Fix] Step 6: Redirecting to home...')
      router.push('/')
      
    } catch (error: any) {
      addLog(`[Fix] ❌ FAILED: ${error.message}`)
      console.error('[Fix] Full error:', error)
      toast.error('Failed to fix profile: ' + error.message)
    } finally {
      setFixing(false)
    }
  }

  const clearStorageAndReload = () => {
    localStorage.clear()
    sessionStorage.clear()
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
    })
    toast.success('Storage cleared! Reloading...')
    setTimeout(() => {
      window.location.href = '/login'
    }, 1000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Quick Fix Tool</h1>
            <p className="text-gray-600">Resolve profile and authentication issues</p>
          </div>

          {/* User Status */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Current Status</h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Loading:</span>
                <span className={`font-semibold ${loading ? 'text-yellow-600' : 'text-green-600'}`}>
                  {loading ? 'Yes' : 'No'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-700">User:</span>
                <span className={`font-semibold ${user ? 'text-green-600' : 'text-red-600'}`}>
                  {user ? user.email : 'Not logged in'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-700">User ID:</span>
                <span className="font-mono text-xs text-gray-600 break-all">
                  {user?.id || 'N/A'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Profile:</span>
                <span className={`font-semibold ${profile ? 'text-green-600' : 'text-red-600'}`}>
                  {profile ? profile.username : 'NULL'}
                </span>
              </div>
            </div>
          </div>

          {/* Issue Detection */}
          {user && !profile && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-red-800 font-semibold mb-1">Profile Missing!</h3>
                  <p className="text-red-700 text-sm mb-3">
                    Your user account exists but the profile was not created. This can happen during Google OAuth signup.
                  </p>
                  <button
                    onClick={attemptProfileFix}
                    disabled={fixing}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {fixing ? 'Creating Profile...' : '🔧 Fix Profile Now'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {user && profile && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-green-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-green-800 font-semibold mb-1">All Good! ✅</h3>
                  <p className="text-green-700 text-sm">
                    Your account and profile are properly set up. You can return to the home page.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Not Logged In */}
          {!user && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-yellow-800 font-semibold mb-1">Not Logged In</h3>
                  <p className="text-yellow-700 text-sm">
                    Please login first to use this tool.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Debug Logs */}
          {logs.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
              <h3 className="text-white font-semibold mb-2">📋 Debug Logs</h3>
              <div className="font-mono text-xs text-green-400 space-y-1">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-4">
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 px-4 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              🏠 Go to Home
            </button>

            <button
              onClick={() => router.push('/test-auth')}
              className="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              🔍 View Auth Test
            </button>

            <button
              onClick={clearStorageAndReload}
              className="w-full py-3 px-4 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors"
            >
              🧹 Clear Storage & Re-login
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Troubleshooting Steps:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>If profile is missing, click "🔧 Fix Profile Now"</li>
              <li>Watch the debug logs to see what's happening</li>
              <li>If still stuck, try "🧹 Clear Storage & Re-login"</li>
              <li>Check "🔍 Auth Test" for detailed diagnostics</li>
              <li>Contact support if issue persists</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
