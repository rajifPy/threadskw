'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('✅ [Login] Already logged in, redirecting...')
        router.replace('/')
      } else {
        setChecking(false)
      }
    }
    checkSession()
  }, [router, supabase])

  useEffect(() => {
    const error = searchParams.get('error')
    const message = searchParams.get('message')
    
    if (error === 'pkce_cleared' || error === 'cache_cleared') {
      toast.success(
        message || 'Cache berhasil dibersihkan! Silakan login kembali.',
        { duration: 5000 }
      )
    } else if (error === 'pkce_error') {
      toast.error(
        message || 'PKCE error. Browser cache telah dibersihkan. Silakan coba login lagi.',
        { duration: 6000 }
      )
    } else if (error) {
      toast.error(decodeURIComponent(error), { duration: 5000 })
    }
  }, [searchParams])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('🔐 [Login] Attempting login...')
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      console.log('✅ [Login] Login successful:', data.user?.email)
      toast.success('Login berhasil!')
      
      window.location.href = '/'
    } catch (error: any) {
      console.error('❌ [Login] Login error:', error)
      
      let errorMessage = 'Login gagal'
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email atau password salah'
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Email belum diverifikasi. Cek inbox Anda.'
      }
      
      toast.error(errorMessage)
      setLoading(false)
    }
  }

  const clearStorageAndRetry = () => {
    try {
      console.log('🧹 [Login] Clearing storage...')
      
      // Clear localStorage
      localStorage.clear()
      
      // Clear sessionStorage
      sessionStorage.clear()
      
      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
      })
      
      toast.success('Storage dibersihkan! Silakan coba login lagi.')
      
      // Reload after a short delay
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (e: any) {
      console.error('Error clearing storage:', e)
      toast.error('Gagal membersihkan storage')
    }
  }

  const handleGoogleLogin = async () => {
    try {
      console.log('🔐 [Login] Starting Google OAuth...')
      
      // Clear any stale auth data first
      await supabase.auth.signOut({ scope: 'local' })
      
      // Small delay to ensure signout completes
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const origin = window.location.origin
      const redirectTo = `${origin}/auth/callback`
      
      console.log('📍 [Login] Origin:', origin)
      console.log('📍 [Login] Redirect URL:', redirectTo)
      
      const { error } = await supabase.auth.signInWithOAuth({
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
        console.error('❌ [Login] Google OAuth error:', error)
        
        // If PKCE error, clear storage and show message
        if (error.message?.toLowerCase().includes('pkce')) {
          toast.error('PKCE error terdeteksi. Membersihkan cache...')
          clearStorageAndRetry()
        } else {
          throw error
        }
      }
    } catch (error: any) {
      console.error('❌ [Login] Google login failed:', error)
      toast.error('Login dengan Google gagal: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-3xl">A</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Sharing Opini Arek Kost</h2>
          <p className="mt-2 text-gray-600">Masuk ke akun Anda</p>
        </div>

        <form onSubmit={handleEmailLogin} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
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
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Loading...' : 'Masuk'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-primary-50 text-gray-500">Atau lanjutkan dengan</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full py-3 px-4 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Google</span>
        </button>

        {/* Troubleshooting Button */}
        <div className="text-center">
          <button
            onClick={clearStorageAndRetry}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Mengalami masalah? Bersihkan cache & coba lagi
          </button>
        </div>

        <p className="text-center text-sm text-gray-600">
          Belum punya akun?{' '}
          <Link href="/register" className="font-medium text-primary-600 hover:text-primary-500">
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

export const dynamic = 'force-dynamic'
