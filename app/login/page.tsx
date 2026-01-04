'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [checking, setChecking] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    setMounted(true)
    
    // ✅ Check if already logged in
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log('✅ [Login] Already logged in, redirecting to home')
          router.replace('/')
          return
        }
      } catch (error) {
        console.error('❌ [Login] Error checking session:', error)
      } finally {
        setChecking(false)
      }
    }
    
    checkAuth()
    
    const error = searchParams.get('error')
    const message = searchParams.get('message')
    
    if (message) {
      toast.success(decodeURIComponent(message), { duration: 5000 })
    } else if (error) {
      toast.error(decodeURIComponent(error), { duration: 5000 })
    }
  }, [searchParams, supabase, router])

  if (!mounted || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('🔐 [Login] Starting email login...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      console.log('✅ [Login] Login successful:', data.user?.email)
      toast.success('Login berhasil! Mengalihkan...')
      
      // ✅ Wait longer for cookies to be set and propagate
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // ✅ Hard reload to ensure middleware sees new cookies
      console.log('🔄 [Login] Redirecting to home...')
      window.location.href = '/'
      
      // Keep loading state true (page will unload anyway)
      
    } catch (error: any) {
      console.error('❌ [Login] Error:', error)
      
      let errorMessage = 'Login gagal'
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email atau password salah'
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Email belum diverifikasi'
      }
      
      toast.error(errorMessage)
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    
    try {
      console.log('🔐 [Google Login] Starting...')
      
      // ✅ Clear existing session first
      try {
        await supabase.auth.signOut({ scope: 'local' })
        console.log('✅ [Google Login] Cleared existing session')
      } catch (e) {
        console.log('ℹ️ [Google Login] No existing session')
      }
      
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const origin = window.location.origin
      const redirectTo = `${origin}/auth/callback`
      
      console.log('🌐 [Google Login] Origin:', origin)
      console.log('↩️ [Google Login] Redirect URL:', redirectTo)
      
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
        console.error('❌ [Google Login] Error:', error)
        throw error
      }
      
      console.log('✅ [Google Login] Redirect initiated')
      
      // ✅ OAuth will handle redirect, don't set loading to false
      
    } catch (error: any) {
      console.error('❌ [Google Login] Failed:', error)
      toast.error('Login dengan Google gagal. Silakan coba lagi.')
      setGoogleLoading(false)
    }
  }

  const clearCacheAndReload = async () => {
    try {
      console.log('🧹 [Clear] Clearing session...')
      
      await supabase.auth.signOut()
      
      toast.success('Cache berhasil dibersihkan!')
      console.log('✅ [Clear] Session cleared')
      
      setTimeout(() => window.location.reload(), 1000)
    } catch (e) {
      console.error('❌ [Clear] Error:', e)
      toast.error('Gagal membersihkan cache')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-50 to-green-50">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-3xl">A</span>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Sharing Opini Arek Kost</h2>
            <p className="text-gray-600">Masuk ke akun Anda</p>
          </div>

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                placeholder="nama@email.com"
                disabled={loading || googleLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
                disabled={loading || googleLoading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Memproses...
                </span>
              ) : (
                'Masuk dengan Email'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500 font-medium">Atau lanjutkan dengan</span>
            </div>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full py-3 px-4 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {googleLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span className="text-gray-700">Menghubungkan...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-gray-700 font-medium">Google</span>
              </>
            )}
          </button>

          {/* Troubleshooting */}
          <div className="mt-6 text-center">
            <button
              onClick={clearCacheAndReload}
              className="text-sm text-gray-500 hover:text-primary-600 underline transition-colors"
              disabled={loading || googleLoading}
            >
              Mengalami masalah? Bersihkan cache
            </button>
          </div>

          {/* Register Link */}
          <p className="text-center text-sm text-gray-600 mt-6">
            Belum punya akun?{' '}
            <Link href="/register" className="font-medium text-primary-600 hover:text-primary-500 transition-colors">
              Daftar sekarang
            </Link>
          </p>
        </div>

        {/* Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            🔐 Menggunakan cookie-based authentication
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

export const dynamic = 'force-dynamic'
