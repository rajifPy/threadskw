'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/components/layout/AuthProvider'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { generateAvatarUrl } from '@/utils/helpers'
import LogoutAnimation from './LogoutAnimation'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const { user, profile, loading } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    setShowProfileMenu(false)
    setShowMobileMenu(false)
    setIsLoggingOut(true)
  }

  const completeLogout = async () => {
    const { signOut } = await import('@/components/layout/AuthProvider')
    router.push('/login')
  }

  if (isLoggingOut) {
    return (
      <LogoutAnimation 
        text="See you soon! 👋"
        onComplete={completeLogout}
      />
    )
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  // Don't render navbar on auth pages
  const authPages = ['/login', '/register', '/auth/callback']
  if (authPages.some(page => pathname?.startsWith(page))) {
    return null
  }

  return (
    <>
      {/* Desktop Top Navbar */}
      <nav className="hidden md:block sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Arek Kost</span>
            </Link>

            {/* Right Menu */}
            {user && (
              <div className="flex items-center space-x-1">
                {/* Search Icon */}
                <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors group">
                  <svg className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>

                {/* Theme Toggle */}
                <div className="mx-1">
                  <ThemeToggle />
                </div>

                {/* Notifications Icon */}
                <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative group">
                  <svg className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                </button>

                {/* Profile Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                      {loading ? (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                      ) : (
                        <>
                          {!imageLoaded && (
                            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                          )}
                          <Image
                            src={profile?.avatar_url || generateAvatarUrl(profile?.username || 'user')}
                            alt="Profile"
                            fill
                            className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => setImageLoaded(true)}
                            priority
                          />
                        </>
                      )}
                    </div>
                  </button>

                  {showProfileMenu && (
                    <>
                      {/* Backdrop */}
                      <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setShowProfileMenu(false)}
                      />
                      
                      {/* Menu Dropdown */}
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <Link
                          href={`/profile/${profile?.username}`}
                          className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600">
                            <Image
                              src={profile?.avatar_url || generateAvatarUrl(profile?.username || 'user')}
                              alt="Profile"
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                              {profile?.full_name || profile?.username}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 text-xs">View profile</p>
                          </div>
                        </Link>

                        <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>

                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
                        >
                          Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Top Header */}
      <div className="md:hidden sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-base font-semibold text-gray-900 dark:text-white">Arek Kost</span>
          </Link>

          <div className="flex items-center space-x-2">
            {/* Theme Toggle on Mobile Top */}
            <ThemeToggle />
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {showMobileMenu && (
          <>
            <div 
              className="fixed inset-0 bg-black/20 z-40 animate-in fade-in duration-200"
              onClick={() => setShowMobileMenu(false)}
            />
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg z-50 animate-in slide-in-from-top-2 duration-200">
              <div className="p-4 space-y-2">
                <Link
                  href={`/profile/${profile?.username}`}
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <div className="relative w-10 h-10 rounded-full overflow-hidden">
                    <Image
                      src={profile?.avatar_url || generateAvatarUrl(profile?.username || 'user')}
                      alt="Profile"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {profile?.full_name || profile?.username}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">@{profile?.username}</p>
                  </div>
                </Link>

                <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center space-x-3 p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 transition-colors safe-area-pb">
        <div className="flex items-center justify-around h-16 px-2">
          {/* Home */}
          <Link 
            href="/"
            className="flex flex-col items-center justify-center flex-1 py-2 group"
          >
            <div className={`p-2 rounded-lg transition-all ${isActive('/') ? 'bg-primary-50 dark:bg-primary-900/30' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800'}`}>
              {isActive('/') ? (
                <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                  <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              )}
            </div>
          </Link>

          {/* Search */}
          <button className="flex flex-col items-center justify-center flex-1 py-2 group">
            <div className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </button>

          {/* Create Post */}
          <button 
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="flex flex-col items-center justify-center flex-1 py-2 group"
          >
            <div className="w-12 h-12 bg-primary-500 hover:bg-primary-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </button>

          {/* Notifications */}
          <button className="flex flex-col items-center justify-center flex-1 py-2 relative group">
            <div className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </div>
          </button>

          {/* Profile */}
          <Link 
            href={`/profile/${profile?.username}`}
            className="flex flex-col items-center justify-center flex-1 py-2"
          >
            <div className={`p-1 rounded-lg transition-all ${pathname?.includes('/profile') ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}>
              <div className="relative w-7 h-7 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700">
                {loading ? (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                ) : (
                  <Image
                    src={profile?.avatar_url || generateAvatarUrl(profile?.username || 'user')}
                    alt="Profile"
                    fill
                    className="object-cover"
                    priority
                  />
                )}
              </div>
            </div>
          </Link>
        </div>
      </nav>

      {/* Add padding bottom for mobile to prevent content being hidden by bottom nav */}
      <style jsx global>{`
        @media (max-width: 768px) {
          body {
            padding-bottom: 64px;
          }
        }
        .safe-area-pb {
          padding-bottom: env(safe-area-inset-bottom);
        }
        
        /* Smooth animations */
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes slide-in-from-top-2 {
          from {
            transform: translateY(-0.5rem);
          }
          to {
            transform: translateY(0);
          }
        }
        
        .animate-in {
          animation-fill-mode: both;
        }
        
        .fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        .slide-in-from-top-2 {
          animation: slide-in-from-top-2 0.2s ease-out;
        }
        
        .duration-200 {
          animation-duration: 200ms;
        }
      `}</style>
    </>
  )
}
