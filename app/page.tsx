'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { PostWithProfile } from '@/lib/supabase/types'
import Navbar from '@/components/ui/Navbar'
import CreatePost from '@/components/ui/CreatePost'
import ThreadCard from '@/components/ui/ThreadCard'
import toast from 'react-hot-toast'

export default function HomePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<PostWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(false)
  const supabase = createClient()

  // Check auth and redirect
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        console.log('[HomePage] No user found, redirecting to login...')
        router.replace('/login')
      } else if (user && !profile) {
        console.warn('[HomePage] User exists but profile is null')
        setProfileError(true)
        // Don't block UI, just show warning
      } else {
        console.log('[HomePage] User authenticated:', user.email)
        setProfileError(false)
      }
    }
  }, [authLoading, user, profile, router])

  const fetchPosts = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url,
            bio
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch likes and comments counts for each post
      const postsWithCounts = await Promise.all(
        (data || []).map(async (post) => {
          const [{ count: likesCount }, { count: commentsCount }] = await Promise.all([
            supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
            supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
          ])

          return {
            ...post,
            _count: {
              likes: likesCount || 0,
              comments: commentsCount || 0,
            },
          } as PostWithProfile
        })
      )

      setPosts(postsWithCounts)
    } catch (error) {
      console.error('Error fetching posts:', error)
      toast.error('Gagal memuat posts')
    } finally {
      setLoading(false)
    }
  }

  // Fetch posts when user is available
  useEffect(() => {
    if (user) {
      fetchPosts()

      // Subscribe to real-time changes
      const postsChannel = supabase
        .channel('posts-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
          fetchPosts()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
          fetchPosts()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
          fetchPosts()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(postsChannel)
      }
    }
  }, [user])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render anything if no user (will redirect)
  if (!user) {
    return null
  }

  // Show error if profile is missing but don't block UI
  const showProfileWarning = user && !profile && profileError

  return (
    <div className="min-h-screen bg-primary-50">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 py-6">
        {showProfileWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800 mb-1">
                  Profile Incomplete
                </h3>
                <p className="text-sm text-yellow-700 mb-2">
                  Your profile is being set up. Please refresh the page in a moment.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        )}

        {profile && <CreatePost onPostCreated={fetchPosts} />}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <p className="text-gray-500">Belum ada post. Jadilah yang pertama membagikan opini!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <ThreadCard
                key={post.id}
                post={post}
                onDelete={fetchPosts}
                onUpdate={fetchPosts}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export const dynamic = 'force-dynamic'
