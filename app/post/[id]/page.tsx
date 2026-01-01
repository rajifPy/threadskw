'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import { PostWithProfile } from '@/lib/supabase/types'
import Navbar from '@/components/ui/Navbar'
import ThreadCard from '@/components/ui/ThreadCard'
import CommentCard from '@/components/ui/CommentCard'
import toast from 'react-hot-toast'

interface CommentWithProfile {
  id: number
  post_id: number
  user_id: string
  content: string
  created_at: string
  profiles: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [post, setPost] = useState<PostWithProfile | null>(null)
  const [comments, setComments] = useState<CommentWithProfile[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const postId = params.id as string

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  const fetchPost = async () => {
    try {
      const { data: postData, error: postError } = await supabase
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
        .eq('id', postId)
        .single()

      if (postError) throw postError

      // Fetch likes and comments counts
      const [{ count: likesCount }, { count: commentsCount }] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      ])

      setPost({
        ...postData,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        },
      } as PostWithProfile)
    } catch (error) {
      console.error('Error fetching post:', error)
      toast.error('Post tidak ditemukan')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setComments(data as CommentWithProfile[])
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  useEffect(() => {
    if (user && postId) {
      fetchPost()
      fetchComments()

      // Subscribe to real-time changes
      const channel = supabase
        .channel(`post-${postId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, () => {
          fetchComments()
          fetchPost()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${postId}` }, () => {
          fetchPost()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, postId])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newComment.trim()) {
      toast.error('Komentar tidak boleh kosong')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: parseInt(postId),
          user_id: user!.id,
          content: newComment.trim(),
        })

      if (error) throw error

      setNewComment('')
      toast.success('Komentar berhasil ditambahkan')
    } catch (error) {
      console.error('Error creating comment:', error)
      toast.error('Gagal menambahkan komentar')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!post) {
    return null
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Kembali</span>
        </button>

        <ThreadCard 
          post={post} 
          onDelete={() => router.push('/')}
          onUpdate={fetchPost}
        />

        <div className="bg-white rounded-xl shadow-md p-4 mt-4">
          <h3 className="font-bold text-gray-900 mb-4">
            Komentar ({comments.length})
          </h3>

          <form onSubmit={handleSubmitComment} className="mb-6">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Tulis komentar..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              rows={3}
              maxLength={300}
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-sm ${newComment.length > 250 ? 'text-red-500' : 'text-gray-400'}`}>
                {newComment.length}/300
              </span>
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="px-6 py-2 bg-primary-500 text-white rounded-full font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Loading...' : 'Kirim'}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {comments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Belum ada komentar</p>
            ) : (
              comments.map((comment) => (
                <CommentCard 
                  key={comment.id} 
                  comment={comment}
                  onDelete={fetchComments}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
export const dynamic = 'force-dynamic'
