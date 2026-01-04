'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/components/layout/AuthProvider'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { generateAvatarUrl } from '@/utils/helpers'
import LogoutAnimation from './LogoutAnimation' // ✅ IMPORT ANIMASI LOGOUT

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false) // ✅ STATE LOGOUT
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setShowDropdown(false)
    setIsLoggingOut(true) // ✅ TAMPILKAN ANIMASI
    
    // Animasi akan berjalan 3 detik, lalu redirect
    // LogoutAnimation component akan handle timing
  }

  const completeLogout = async () => {
    await signOut()
    router.push('/login')
  }

  // ✅ TAMPILKAN ANIMASI LOGOUT
  if (isLoggingOut) {
    return (
      <LogoutAnimation 
        text="See you soon! 👋"
        onComplete={completeLogout}
      />
    )
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <span className="text-xl font-bold text-primary-700">
              Arek Kost
            </span>
          </Link>

          {user && (
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                Home
              </Link>
              
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-primary-400">
                    <Image
                      src={profile?.avatar_url || generateAvatarUrl(profile?.username || 'user')}
                      alt="Profile"
                      fill
                      className="object-cover"
                    />
                  </div>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 border border-gray-200">
                    <Link
                      href={`/profile/${profile?.username}`}
                      className="block px-4 py-2 text-gray-700 hover:bg-primary-50 transition-colors"
                      onClick={() => setShowDropdown(false)}
                    >
                      Profile Saya
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
