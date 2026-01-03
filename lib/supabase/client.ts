'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  // Initialize Supabase client only on mount (client-side)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    setMounted(true)
    
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log('✅ [Register] Already logged in, redirecting to home...')
          window.location.href = '/'
          return
        }
      } catch (error) {
        console.error('❌ [Register] Error checking session:', error)
      } finally {
        setChecking(false)
      }
    }
    
    checkSession()
  }, [supabase])

  if (!mounted || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const usernameRegex = /^[a-z0-9_]+$/
      if (!usernameRegex.test(username)) {
        toast.error('Username hanya boleh huruf kecil, angka, dan underscore')
        setLoading(false)
        return
      }

      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle()

      if (existingUser) {
        toast.error('Username sudah digunakan')
        setLoading(false)
        return
      }

      const origin = window.location.origin
      const redirectTo = `${origin}/auth/callback`

      console.log('[Register] Starting registration...')
      console.log('[Register] Redirect URL:', redirectTo)

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase(),
            full_name: fullName,
          },
          emailRedirectTo: redirectTo,
        },
      })

      if (authError) {
        console.error('[Register] Auth error:', authError)
        throw authError
      }

      console.log('[Register] Sign up response:', authData)

      if (authData.user) {
        if (authData.user.identities && authData.user.identities.length === 0) {
          toast.error('Email sudah terdaftar. Silakan login.')
          setLoading(false)
          return
        }

        const isAutoConfirmed = authData.user.email_confirmed_at !== null

        if (isAutoConfirmed) {
          console.log('[Register] Auto-confirmed, creating profile...')
          
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle()

          if (!profile) {
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: authData.user.id,
                username: username.toLowerCase(),
                full_name: fullName || null,
              })

            if (insertError) {
              console.error('[Register] Profile creation error:', insertError)
            }
          }

          toast.success('Registrasi berhasil! Mengalihkan...')
          setTimeout(() => {
            window.location.href = '/'
          }, 1000)
        } else {
          toast.success(
            'Registrasi berhasil! Cek email Anda untuk verifikasi.',
            { duration: 5000 }
          )
          setTimeout(() => {
            router.push('/login')
          }, 2000)
        }
      }
    } catch (error: any) {
      console.error('[Register] Registration error:', error)
      
      let errorMessage = 'Registrasi gagal'
      
      if (error.message?.includes('User already registered')) {
        errorMessage = 'Email sudah terdaftar. Silakan login.'
      } else if (error.message?.includes('Password should be')) {
        errorMessage = 'Password minimal 6 karakter'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    try {
      console.log('[Register] Starting Google OAuth...')
      const origin = window.location.origin
      const redirectTo = `${origin}/auth/callback`
      
      console.log('[Register] Redirect URL:', redirectTo)
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('[Register] Google OAuth error:', error)
        throw error
      }
    } catch (error: any) {
      console.error('[Register] Google signup error:', error)
      toast.error('Daftar dengan Google gagal: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-primary-50 to-green-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-3xl">A</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Sharing Opini Arek Kost</h2>
          <p className="mt-2 text-gray-600">Buat akun baru</p>
        </div>

        <form onSubmit={handleRegister} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Nama Lengkap
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                placeholder="johndoe"
              />
              <p className="mt-1 text-xs text-gray-500">Hanya huruf kecil, angka, dan underscore</p>
            </div>

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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-gray-500">Minimal 6 karakter</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Loading...' : 'Daftar'}
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
          onClick={handleGoogleSignup}
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

        <p className="text-center text-sm text-gray-600">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
            Masuk sekarang
          </Link>
        </p>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
