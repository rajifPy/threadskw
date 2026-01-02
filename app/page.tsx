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
  const supabase = createClient()

  // Check auth and redirect - NO TIMEOUT, just wait for authLoading to finish
  useEffect(() => {
    // Wait until auth is fully loaded
    if (authLoading) {
      console.log('⏳ [HomePage] Waiting for auth to load...')
      return
    }

    // Auth loading complete, now check state
    if (!user) {
      console.log('ℹ️ [HomePage] No user found, redirecting to login...')
      router.replace('/login')
    } else if (user && !profile) {
      console.warn('⚠️ [HomePage] User exists but profile is null, redirecting to debug...')
      router.replace('/debug')
    } else if (user && profile) {
      console.log('✅ [HomePage] User authenticated:', user.email, profile.username)
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
        .limit(50)

      if (error) throw error

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
    } catch (error: any) {
      console.error('❌ [HomePage] Error fetching posts:', error)
      toast.error('Gagal memuat posts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && profile) {
      console.log('📊 [HomePage] Fetching posts...')
      fetchPosts()

      const postsChannel = supabase
        .channel('posts-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
          console.log('🔄 [HomePage] Posts updated')
          fetchPosts()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
          console.log('🔄 [HomePage] Likes updated')
          fetchPosts()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
          console.log('🔄 [HomePage] Comments updated')
          fetchPosts()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(postsChannel)
      }
    }
  }, [user, profile])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-primary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your account...</p>
          <p className="text-gray-400 text-sm mt-2">Please wait...</p>
        </div>
      </div>
    )
  }

  // Don't render content if no user or profile (will redirect)
  if (!user || !profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-primary-50">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 py-6">
        <CreatePost onPostCreated={fetchPosts} />

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
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
