'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import { PostWithProfile } from '@/lib/supabase/types'
import Navbar from '@/components/ui/Navbar'
import CreatePost from '@/components/ui/CreatePost'
import ThreadCard from '@/components/ui/ThreadCard'
import LoadingCube from '@/components/ui/LoadingCube'

export default function HomePage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const [posts, setPosts] = useState<PostWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true) // ✅ TAMBAH INI
  const router = useRouter()
  const supabase = createClient()

  // ✅ TAMBAH: Minimum delay 3 detik untuk initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false)
    }, 3000) // 3 detik

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!authLoading) {
      console.log('🔵 [HomePage] Auth loading complete')
      console.log('🔵 [HomePage] User:', user?.email || 'null')
      console.log('🔵 [HomePage] Profile:', profile?.username || 'null')
      
      if (!user) {
        console.log('⚠️ [HomePage] No user, redirecting to login')
        router.push('/login')
      } else if (!profile) {
        console.log('⚠️ [HomePage] User exists but no profile')
        
        if (retryCount < 3) {
          console.log(`🔄 [HomePage] Attempting to refresh profile (attempt ${retryCount + 1}/3)`)
          setTimeout(() => {
            refreshProfile().then(() => {
              setRetryCount(prev => prev + 1)
            })
          }, 1000 * (retryCount + 1))
        } else {
          console.log('❌ [HomePage] Profile refresh failed after 3 attempts, redirecting to debug')
          router.push('/debug')
        }
      }
    }
  }, [user, profile, authLoading, router, retryCount, refreshProfile])

  const fetchPosts = async () => {
    const startTime = Date.now() // ✅ TAMBAH: Track waktu mulai
    
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!inner (
            id,
            username,
            full_name,
            avatar_url,
            bio
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      const postIds = postsData?.map(p => p.id) || []
      
      if (postIds.length === 0) {
        setPosts([])
        
        // ✅ TAMBAH: Pastikan minimal 3 detik
        const elapsed = Date.now() - startTime
        if (elapsed < 3000) {
          await new Promise(resolve => setTimeout(resolve, 3000 - elapsed))
        }
        
        setLoading(false)
        return
      }

      const [likesData, commentsData] = await Promise.all([
        supabase
          .from('likes')
          .select('post_id')
          .in('post_id', postIds),
        supabase
          .from('comments')
          .select('post_id')
          .in('post_id', postIds)
      ])

      const likeCounts = (likesData.data || []).reduce((acc, like) => {
        acc[like.post_id] = (acc[like.post_id] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      const commentCounts = (commentsData.data || []).reduce((acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      const postsWithCounts = postsData.map(post => ({
        ...post,
        _count: {
          likes: likeCounts[post.id] || 0,
          comments: commentCounts[post.id] || 0,
        },
      })) as PostWithProfile[]

      setPosts(postsWithCounts)
      
      // ✅ TAMBAH: Pastikan minimal 3 detik
      const elapsed = Date.now() - startTime
      if (elapsed < 3000) {
        await new Promise(resolve => setTimeout(resolve, 3000 - elapsed))
      }
      
    } catch (error) {
      console.error('❌ Error fetching posts:', error)
      
      // ✅ TAMBAH: Pastikan minimal 3 detik bahkan saat error
      const elapsed = Date.now() - startTime
      if (elapsed < 3000) {
        await new Promise(resolve => setTimeout(resolve, 3000 - elapsed))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && profile) {
      console.log('✅ [HomePage] Both user and profile available, fetching posts')
      fetchPosts()

      const channel = supabase
        .channel('posts-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'posts' },
          () => fetchPosts()
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, profile])

  // ✅ GANTI: Gabungkan authLoading dengan initialLoading
  if (authLoading || initialLoading) {
    return <LoadingCube text="Loading authentication..." />
  }

  // Show retry state
  if (user && !profile && retryCount < 3) {
    return <LoadingCube text={`Loading profile... Attempt ${retryCount + 1} of 3`} />
  }

  // Don't render if no user or profile
  if (!user || !profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-50">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Selamat Datang, {profile.full_name || profile.username}! 👋
          </h1>
          <p className="text-gray-600">
            Bagikan pendapat dan diskusikan ide-ide menarik dengan komunitas
          </p>
        </div>

        <CreatePost onPostCreated={fetchPosts} />

        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Timeline</h2>
        </div>

        {loading ? (
          <LoadingCube text="Loading posts..." fullScreen={false} />
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500 text-lg font-medium mb-2">Belum ada post</p>
            <p className="text-gray-400 text-sm">Jadilah yang pertama membagikan pendapat!</p>
          </div>
        ) : (
          <div>
            {posts.map(post => (
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
