'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import toast from 'react-hot-toast'

export default function LogoutPage() {
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { user, profile } = useAuth()
  const supabase = createClient()
  
  const washingSoundRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Fade in animation
    setTimeout(() => setMounted(true), 100)
  }, [])

  const handleLogout = async () => {
    setLoading(true)
    
    // Initialize and play washing machine sound
    washingSoundRef.current = new Audio('/sound/washing-machine-90458.mp3')
    if (washingSoundRef.current) {
      washingSoundRef.current.volume = 0.7
      washingSoundRef.current.play()
        .catch(err => console.error('❌ Washing machine sound error:', err))
    }
    
    try {
      // Minimum 5 seconds for washing machine animation
      const startTime = Date.now()
      
      const { error } = await supabase.auth.signOut()
      
      if (error) throw error
      
      const elapsed = Date.now() - startTime
      const remainingTime = Math.max(0, 5000 - elapsed)
      
      await new Promise(resolve => setTimeout(resolve, remainingTime))
      
      toast.success('Logout berhasil!')
      
      // Stop sound
      if (washingSoundRef.current) {
        washingSoundRef.current.pause()
        washingSoundRef.current = null
      }
      
      // Redirect after successful logout
      setTimeout(() => {
        router.push('/login')
        router.refresh()
      }, 500)
      
    } catch (error: any) {
      console.error('Logout error:', error)
      toast.error('Gagal logout: ' + error.message)
      
      // Stop sound on error
      if (washingSoundRef.current) {
        washingSoundRef.current.pause()
        washingSoundRef.current = null
      }
      
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

  // Show washing machine animation while logging out
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-slate-900 transition-colors">
        <style jsx>{`
          .washing-machine {
            width: 120px;
            height: 150px;
            background-color: #fff;
            background-repeat: no-repeat;
            background-image: linear-gradient(#ddd 50%, #bbb 51%),
              linear-gradient(#ddd, #ddd), 
              linear-gradient(#ddd, #ddd),
              radial-gradient(ellipse at center, #aaa 25%, #eee 26%, #eee 50%, #0000 55%),
              radial-gradient(ellipse at center, #aaa 25%, #eee 26%, #eee 50%, #0000 55%),
              radial-gradient(ellipse at center, #aaa 25%, #eee 26%, #eee 50%, #0000 55%);
            background-position: 0 20px, 45px 0, 8px 6px, 55px 3px, 75px 3px, 95px 3px;
            background-size: 100% 4px, 1px 23px, 30px 8px, 15px 15px, 15px 15px, 15px 15px;
            position: relative;
            border-radius: 6%;
            animation: shake 5s ease-in-out infinite;
            transform-origin: 60px 180px;
          }

          .dark .washing-machine {
            background-color: #374151;
            background-image: linear-gradient(#4b5563 50%, #6b7280 51%),
              linear-gradient(#4b5563, #4b5563), 
              linear-gradient(#4b5563, #4b5563),
              radial-gradient(ellipse at center, #6b7280 25%, #9ca3af 26%, #9ca3af 50%, #0000 55%),
              radial-gradient(ellipse at center, #6b7280 25%, #9ca3af 26%, #9ca3af 50%, #0000 55%),
              radial-gradient(ellipse at center, #6b7280 25%, #9ca3af 26%, #9ca3af 50%, #0000 55%);
          }

          .washing-machine:before {
            content: "";
            position: absolute;
            left: 5px;
            top: 100%;
            width: 7px;
            height: 5px;
            background: #aaa;
            border-radius: 0 0 4px 4px;
            box-shadow: 102px 0 #aaa;
          }

          .dark .washing-machine:before {
            background: #6b7280;
            box-shadow: 102px 0 #6b7280;
          }

          .washing-machine:after {
            content: "";
            position: absolute;
            width: 95px;
            height: 95px;
            left: 0;
            right: 0;
            margin: auto;
            bottom: 20px;
            background-color: #bbdefb;
            background-image: linear-gradient(to right, #0004 0%, #0004 49%, #0000 50%, #0000 100%),
              linear-gradient(135deg, #64b5f6 50%, #607d8b 51%);
            background-size: 30px 100%, 90px 80px;
            border-radius: 50%;
            background-repeat: repeat, no-repeat;
            background-position: 0 0;
            box-sizing: border-box;
            border: 10px solid #DDD;
            box-shadow: 0 0 0 4px #999 inset, 0 0 6px 6px #0004 inset;
            animation: spin 5s ease-in-out infinite;
          }

          .dark .washing-machine:after {
            background-color: #3b82f6;
            background-image: linear-gradient(to right, #0004 0%, #0004 49%, #0000 50%, #0000 100%),
              linear-gradient(135deg, #60a5fa 50%, #475569 51%);
            border: 10px solid #4b5563;
            box-shadow: 0 0 0 4px #6b7280 inset, 0 0 6px 6px #0004 inset;
          }

          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            50% {
              transform: rotate(360deg);
            }
            75% {
              transform: rotate(750deg);
            }
            100% {
              transform: rotate(1800deg);
            }
          }

          @keyframes shake {
            65%, 80%, 88%, 96% {
              transform: rotate(0.5deg);
            }
            50%, 75%, 84%, 92% {
              transform: rotate(-0.5deg);
            }
            0%, 50%, 100% {
              transform: rotate(0);
            }
          }

          .progress-bar {
            width: 200px;
            height: 4px;
            background: #e0e0e0;
            border-radius: 2px;
            overflow: hidden;
            margin-top: 2rem;
          }

          .dark .progress-bar {
            background: #374151;
          }

          .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #22c55e, #16a34a);
            animation: progress 5s linear;
          }

          @keyframes progress {
            from {
              width: 0%;
            }
            to {
              width: 100%;
            }
          }

          .fade-in {
            animation: fadeIn 0.5s ease-in;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>

        <div className="text-center fade-in">
          <div className="washing-machine mx-auto mb-8"></div>
          
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Cleaning up your session...
          </h3>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Logging out...
          </p>

          <div className="progress-bar mx-auto">
            <div className="progress-bar-fill"></div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            🧼 Washing away your data...
          </p>
        </div>
      </div>
    )
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
