'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('🔴 [Error Boundary]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Oops! Terjadi Kesalahan
        </h2>
        
        <p className="text-gray-600 mb-6">
          {error.message || 'Terjadi kesalahan yang tidak terduga'}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => {
              // Clear any corrupted state
              try {
                localStorage.removeItem('sb-auth-token')
                sessionStorage.clear()
              } catch (e) {
                console.error('Error clearing storage:', e)
              }
              reset()
            }}
            className="w-full py-3 px-4 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            🔄 Coba Lagi
          </button>

          <Link
            href="/login"
            className="block w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            🏠 Kembali ke Login
          </Link>

          <Link
            href="/debug"
            className="block w-full py-3 px-4 border border-primary-300 text-primary-600 rounded-lg font-medium hover:bg-primary-50 transition-colors"
          >
            🔧 Debug Tool
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-gray-400">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
