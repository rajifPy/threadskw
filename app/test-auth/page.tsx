'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function TestAuthPage() {
  const [status, setStatus] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    setLoading(true)
    const results: any = {}

    // 1. Check session
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      results.session = {
        exists: !!session,
        user: session?.user?.email || null,
        error: error?.message || null
      }
    } catch (e: any) {
      results.session = { error: e.message }
    }

    // 2. Check localStorage
    try {
      const keys = Object.keys(localStorage)
      const supabaseKeys = keys.filter(k => k.includes('supabase'))
      results.localStorage = {
        totalKeys: keys.length,
        supabaseKeys: supabaseKeys.length,
        keys: supabaseKeys
      }
    } catch (e: any) {
      results.localStorage = { error: e.message }
    }

    // 3. Check cookies
    try {
      results.cookies = {
        total: document.cookie.split(';').length,
        hasCookies: document.cookie.length > 0,
        cookies: document.cookie.split(';').map(c => c.trim().split('=')[0])
      }
    } catch (e: any) {
      results.cookies = { error: e.message }
    }

    // 4. Check environment
    results.environment = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      currentUrl: typeof window !== 'undefined' ? window.location.origin : 'Unknown'
    }

    setStatus(results)
    setLoading(false)
  }

  const clearAllStorage = () => {
    try {
      // Clear localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })

      // Clear cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
      })

      alert('Storage cleared! Reloading...')
      window.location.reload()
    } catch (e: any) {
      alert('Error clearing storage: ' + e.message)
    }
  }

  const testGoogleLogin = async () => {
    try {
      console.log('Testing Google OAuth...')
      
      await supabase.auth.signOut()
      
      const origin = window.location.origin
      const redirectTo = `${origin}/auth/callback`
      
      console.log('Origin:', origin)
      console.log('Redirect To:', redirectTo)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })

      if (error) {
        console.error('OAuth Error:', error)
        alert('OAuth Error: ' + error.message)
      } else {
        console.log('OAuth Success:', data)
      }
    } catch (e: any) {
      console.error('Exception:', e)
      alert('Exception: ' + e.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">🔧 Auth Diagnostic Tool</h1>
            <Link
              href="/login"
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              Back to Login
            </Link>
          </div>

          {/* Session Status */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="font-bold text-blue-900 mb-2">📊 Session Status</h2>
            <pre className="text-sm bg-blue-100 p-3 rounded overflow-auto">
              {JSON.stringify(status.session, null, 2)}
            </pre>
          </div>

          {/* LocalStorage Status */}
          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <h2 className="font-bold text-green-900 mb-2">💾 LocalStorage Status</h2>
            <pre className="text-sm bg-green-100 p-3 rounded overflow-auto">
              {JSON.stringify(status.localStorage, null, 2)}
            </pre>
          </div>

          {/* Cookies Status */}
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
            <h2 className="font-bold text-yellow-900 mb-2">🍪 Cookies Status</h2>
            <pre className="text-sm bg-yellow-100 p-3 rounded overflow-auto">
              {JSON.stringify(status.cookies, null, 2)}
            </pre>
          </div>

          {/* Environment Status */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <h2 className="font-bold text-purple-900 mb-2">⚙️ Environment</h2>
            <pre className="text-sm bg-purple-100 p-3 rounded overflow-auto">
              {JSON.stringify(status.environment, null, 2)}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={checkAuthStatus}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              🔄 Refresh Status
            </button>

            <button
              onClick={clearAllStorage}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
            >
              🧹 Clear All Storage
            </button>

            <button
              onClick={testGoogleLogin}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
            >
              🧪 Test Google OAuth
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-bold text-gray-900 mb-3">📋 Testing Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Click "Clear All Storage" to remove cached auth data</li>
              <li>Click "Refresh Status" to check current state</li>
              <li>Click "Test Google OAuth" to test login flow</li>
              <li>Check console (F12) for detailed logs</li>
              <li>If OAuth redirects correctly, check if profile is created</li>
            </ol>
          </div>

          {/* Expected Values */}
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-bold text-green-900 mb-3">✅ Expected Values:</h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li>• <strong>Site URL:</strong> https://sharing-opini-rek.vercel.app</li>
              <li>• <strong>Redirect URL:</strong> https://sharing-opini-rek.vercel.app/auth/callback</li>
              <li>• <strong>Google OAuth Callback:</strong> https://[project-id].supabase.co/auth/v1/callback</li>
            </ul>
          </div>

          {/* Common Issues */}
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-bold text-red-900 mb-3">❌ Common Issues:</h3>
            <ul className="space-y-2 text-sm text-red-800">
              <li>• <strong>PKCE Error:</strong> Clear browser storage and try again</li>
              <li>• <strong>Redirect Error:</strong> Check URL config in Supabase Dashboard</li>
              <li>• <strong>Profile Not Created:</strong> Check database trigger or use /debug page</li>
              <li>• <strong>Cookie Blocked:</strong> Check browser privacy settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'