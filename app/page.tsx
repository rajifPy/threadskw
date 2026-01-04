'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { PostWithProfile } from '@/lib/supabase/types'
import Navbar from '@/components/ui/Navbar'
import ThreadCard from '@/components/ui/ThreadCard'
import toast from 'react-hot-toast'
import dynamicImport from 'next/dynamic'

// ✅ Lazy load CreatePost
const CreatePost = dynamicImport(() => import('@/components/ui/CreatePost'), {
  loading: () => (
    <div className="bg-white rounded-xl shadow-md p-4 mb-6 h-32 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  ),
  ssr: false
})

const POSTS_PER_PAGE = 20

export default function HomePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<PostWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // ✅ OPTIMASI 1: Fetch posts dengan aggregated counts (1 query saja!)
  const fetchPosts = useCallback(async () => {
    if (!user) return
    
    try {
      setLoading(true)
      
      // ✅ Single query dengan aggregate functions
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
          ),
          likes:likes(count),
          comments:comments(count)
        `)
        .order('created_at', { ascending: false })
        .limit(POSTS_PER_PAGE)

      if (error) throw error

      // ✅ Transform data dengan counts yang sudah ada
      const postsWithCounts = (data || []).map(post => ({
        ...post,
        _count: {
          likes: post.likes?.[0]?.count || 0,
          comments: post.comments?.[0]?.count || 0,
        },
      })) as PostWithProfile[]

      setPosts(postsWithCounts)
    } catch (error: any) {
      console.error('❌ Error fetching posts:', error)
      toast.error('Gagal memuat posts')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      console.log('❌ No user')
      return
    }

    if (!profile) {
      console.warn('⚠️ Profile missing')
      router.replace('/debug')
      return
    }

    console.log('✅ Auth complete, fetching posts')
    fetchPosts()
  }, [authLoading, user, profile, router, fetchPosts])

  // ✅ OPTIMASI 2: Subscribe hanya ke INSERT dan prepend post baru (tidak fetch ulang!)
  useEffect(() => {
    if (!user || !profile) return

    const postsChannel = supabase
      .channel('posts-insert-only')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'posts' }, 
        async (payload) => {
          console.log('🆕 New post detected')
          
          // ✅ Fetch hanya post baru dengan profile-nya
          const { data: newPostData } = await supabase
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
            .eq('id', payload.new.id)
            .single()

          if (newPostData) {
            const newPost = {
              ...newPostData,
              _count: { likes: 0, comments: 0 }
            } as PostWithProfile
            
            // ✅ Prepend tanpa fetch ulang semua
            setPosts(prev => [newPost, ...prev].slice(0, POSTS_PER_PAGE))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(postsChannel)
    }
  }, [user, profile, supabase])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-primary-50">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 py-6">
        <CreatePost onPostCreated={fetchPosts} />

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-md p-4 animate-pulse">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                  </div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
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
