'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import LoadingCube from '@/components/ui/LoadingCube'
import toast from 'react-hot-toast'

export default function LogoutPage() {
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { user, profile } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    // Fade in animation
    setTimeout(() => setMounted(true), 100)
  }, [])

  const handleLogout = async () => {
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) throw error
      
      toast.success('Logout berhasil!')
      
      // Redirect after successful logout
      setTimeout(() => {
        router.push('/login')
        router.refresh()
      }, 500)
      
    } catch (error: any) {
      console.error('Logout error:', error)
      toast.error('Gagal logout: ' + error.message)
      setLoading(false)
    }
  }

  const handleCancel = () => {
    // Fade out animation before going back
    setMounted(false)
    setTimeout(() => {
      router.back()
    }, 300)
  }

  // Show loading cube animation while logging out
  if (loading) {
    return <LoadingCube text="Logging out..." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-50 dark:from-gray-900 dark:to-slate-900 flex items-center justify-center px-4 transition-colors duration-300">
      <div 
        className={`max-w-md w-full transform transition-all duration-500 ${
          mounted 
            ? 'translate-y-0 opacity-100 scale-100' 
            : 'translate-y-8 opacity-0 scale-95'
        }`}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transition-colors duration-300">
          
          {/* Icon with bounce animation */}
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg 
              className="w-10 h-10 text-red-600 dark:text-red-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-3">
            Konfirmasi Logout
          </h1>

          {/* User Info */}
          {user && profile && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 transform transition-all hover:scale-105">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-1">
                Anda sedang login sebagai:
              </p>
              <p className="font-semibold text-gray-900 dark:text-white text-center">
                {profile.full_name || profile.username}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                @{profile.username}
              </p>
            </div>
          )}

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
            Apakah Anda yakin ingin keluar dari akun Anda? Anda perlu login kembali untuk mengakses aplikasi.
          </p>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full py-3 px-4 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Ya, Logout Sekarang</span>
            </button>
            
            <button
              onClick={handleCancel}
              disabled={loading}
              className="w-full py-3 px-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              Batal, Tetap Login
            </button>
          </div>

          {/* Additional Info */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              💡 Tips: Jangan logout jika Anda masih ingin menjelajahi aplikasi
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
