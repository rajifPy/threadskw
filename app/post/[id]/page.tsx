'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import { PostWithProfile } from '@/lib/supabase/types'
import Navbar from '@/components/ui/Navbar'
import Link from 'next/link'
import Image from 'next/image'
import { getRelativeTime, generateAvatarUrl } from '@/utils/helpers'
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
  const [likesCount, setLikesCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
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
      
      setLikesCount(likesCount || 0)
      
      if (user) {
        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .single()
        
        setIsLiked(!!likeData)
      }
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

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', parseInt(postId))
          .eq('user_id', user.id)
        
        setIsLiked(false)
        setLikesCount(prev => prev - 1)
      } else {
        await supabase
          .from('likes')
          .insert({ post_id: parseInt(postId), user_id: user.id })
        
        setIsLiked(true)
        setLikesCount(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

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

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Yakin ingin menghapus komentar ini?')) return

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error

      toast.success('Komentar berhasil dihapus')
      fetchComments()
    } catch (error) {
      console.error('Error deleting comment:', error)
      toast.error('Gagal menghapus komentar')
    }
  }

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-green-50 dark:from-gray-900 dark:to-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!post) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-green-50 dark:from-gray-900 dark:to-slate-900 transition-colors duration-300">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Kembali</span>
        </button>

        {/* Main Post */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6 transition-colors duration-300">
          <div className="flex items-start space-x-3">
            <Link href={`/profile/${post.profiles.username}`}>
              <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={post.profiles.avatar_url || generateAvatarUrl(post.profiles.username)}
                  alt={post.profiles.username}
                  fill
                  className="object-cover"
                />
              </div>
            </Link>

            <div className="flex-1">
              <Link href={`/profile/${post.profiles.username}`} className="flex items-center space-x-2 mb-1">
                <span className="font-bold text-gray-900 dark:text-white">{post.profiles.full_name || post.profiles.username}</span>
                <span className="text-gray-500 dark:text-gray-400">@{post.profiles.username}</span>
              </Link>

              <p className="text-gray-800 dark:text-gray-100 mb-3 whitespace-pre-wrap">{post.content}</p>

              {post.image_url && (
                <div className="relative w-full rounded-lg overflow-hidden mb-3">
                  <Image
                    src={post.image_url}
                    alt="Post image"
                    width={600}
                    height={400}
                    className="w-full h-auto max-h-96 object-cover"
                  />
                </div>
              )}

              <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span>{getRelativeTime(post.created_at)}</span>
              </div>

              <div className="flex items-center space-x-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={handleLike}
                  className={`flex items-center space-x-2 transition-all ${
                    isLiked ? 'text-red-500' : 'text-gray-500 dark:text-gray-400 hover:text-red-500'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="text-sm font-medium">{likesCount}</span>
                </button>

                <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-sm font-medium">{comments.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comment Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-6 transition-colors duration-300">
          <form onSubmit={handleSubmitComment}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Tulis komentar..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              rows={3}
              maxLength={300}
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-sm ${newComment.length > 250 ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                {newComment.length}/300
              </span>
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="px-6 py-2 bg-primary-500 text-white rounded-full font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Posting...' : 'Kirim'}
              </button>
            </div>
          </form>
        </div>

        {/* Comments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 transition-colors duration-300">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">
            Komentar ({comments.length})
          </h3>

          {comments.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">Belum ada komentar</p>
          ) : (
            <div className="space-y-0">
              {comments.map((comment, index) => (
                <div key={comment.id} className="relative flex items-start space-x-3 pb-6">
                  {/* Thread Line */}
                  {index < comments.length - 1 && (
                    <div className="absolute left-[19px] top-[52px] bottom-0 w-[2px] bg-gray-300 dark:bg-gray-600"></div>
                  )}

                  {/* Avatar */}
                  <Link href={`/profile/${comment.profiles.username}`}>
                    <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 z-10 ring-4 ring-white dark:ring-gray-800">
                      <Image
                        src={comment.profiles.avatar_url || generateAvatarUrl(comment.profiles.username)}
                        alt={comment.profiles.username}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </Link>

                  {/* Comment Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <Link href={`/profile/${comment.profiles.username}`} className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">
                          {comment.profiles.full_name || comment.profiles.username}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm">@{comment.profiles.username}</span>
                      </Link>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{getRelativeTime(comment.created_at)}</span>
                    </div>

                    <p className="text-gray-800 dark:text-gray-100 text-sm whitespace-pre-wrap mb-2">{comment.content}</p>

                    {user?.id === comment.user_id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export const dynamic = 'force-dynamic'
