'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PostWithProfile } from '@/lib/supabase/types'
import { getRelativeTime, generateAvatarUrl } from '@/utils/helpers'
import { useAuth } from '@/components/layout/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import CreatePost from './CreatePost'

interface ThreadCardProps {
  post: PostWithProfile
  onDelete?: () => void
  onUpdate?: () => void
}

export default function ThreadCard({ post, onDelete, onUpdate }: ThreadCardProps) {
  const { user } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [likesCount, setLikesCount] = useState(post._count?.likes || 0)
  const [commentsCount, setCommentsCount] = useState(post._count?.comments || 0)
  const [isLiked, setIsLiked] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showMediaModal, setShowMediaModal] = useState(false)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const isOwner = user?.id === post.user_id

  // Parse media URLs
  const mediaUrls = (() => {
    if (!post.image_url) return []
    
    try {
      // Try to parse as JSON array (new format)
      const parsed = JSON.parse(post.image_url)
      return Array.isArray(parsed) ? parsed : [post.image_url]
    } catch {
      // If not JSON, treat as single URL (old format)
      return [post.image_url]
    }
  })()

  const getMediaType = (url: string): 'image' | 'video' => {
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov']
    const extension = url.split('.').pop()?.toLowerCase() || ''
    return videoExtensions.includes(extension) ? 'video' : 'image'
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!user) return

      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .single()

      setIsLiked(!!data)
    }

    checkLikeStatus()
  }, [post.id, user])

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id)
        
        setIsLiked(false)
        setLikesCount(prev => prev - 1)
      } else {
        await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: user.id })
        
        setIsLiked(true)
        setLikesCount(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Yakin ingin menghapus post ini?')) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)

      if (error) throw error

      toast.success('Post berhasil dihapus')
      if (onDelete) onDelete()
    } catch (error) {
      console.error('Error deleting post:', error)
      toast.error('Gagal menghapus post')
    } finally {
      setIsDeleting(false)
    }
  }

  const openMediaModal = (index: number) => {
    setCurrentMediaIndex(index)
    setShowMediaModal(true)
    document.body.style.overflow = 'hidden'
  }

  const closeMediaModal = () => {
    setShowMediaModal(false)
    document.body.style.overflow = 'unset'
  }

  const nextMedia = () => {
    setCurrentMediaIndex((prev) => (prev + 1) % mediaUrls.length)
  }

  const prevMedia = () => {
    setCurrentMediaIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length)
  }

  if (isEditing) {
    return (
      <CreatePost
        editMode
        initialContent={post.content}
        initialImageUrl={post.image_url || ''}
        postId={post.id}
        onPostCreated={() => {
          setIsEditing(false)
          if (onUpdate) onUpdate()
        }}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <Link href={`/profile/${post.profiles.username}`} className="flex items-center space-x-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden">
              <Image
                src={post.profiles.avatar_url || generateAvatarUrl(post.profiles.username)}
                alt={post.profiles.username}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{post.profiles.full_name || post.profiles.username}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">@{post.profiles.username}</p>
            </div>
          </Link>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400 dark:text-gray-500">{getRelativeTime(post.created_at)}</span>
            {isOwner && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>

                {showMenu && (
                  <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-1 border border-gray-200 dark:border-gray-600 z-10">
                    <button
                      onClick={() => {
                        setIsEditing(true)
                        setShowMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? 'Hapus...' : 'Hapus'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Link href={`/post/${post.id}`} className="block">
          <p className="text-gray-800 dark:text-gray-100 mb-3 whitespace-pre-wrap">{post.content}</p>

          {/* Media Grid */}
          {mediaUrls.length > 0 && (
            <div className={`grid gap-1 rounded-lg overflow-hidden mb-3 ${
              mediaUrls.length === 1 ? 'grid-cols-1' :
              mediaUrls.length === 2 ? 'grid-cols-2' :
              mediaUrls.length === 3 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {mediaUrls.map((url, index) => {
                const mediaType = getMediaType(url)
                const isLastOdd = mediaUrls.length === 3 && index === 2

                return (
                  <div
                    key={index}
                    className={`relative cursor-pointer group ${
                      isLastOdd ? 'col-span-2' : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      openMediaModal(index)
                    }}
                  >
                    {mediaType === 'image' ? (
                      <div className="relative w-full h-48">
                        <Image
                          src={url}
                          alt={`Media ${index + 1}`}
                          fill
                          className="object-cover group-hover:opacity-90 transition-opacity"
                        />
                      </div>
                    ) : (
                      <video
                        src={url}
                        className="w-full h-48 object-cover"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    
                    {/* Overlay untuk multiple media */}
                    {mediaUrls.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {index + 1}/{mediaUrls.length}
                      </div>
                    )}

                    {/* Play icon for videos */}
                    {mediaType === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center group-hover:bg-black/80 transition-colors">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Link>

        <div className="flex items-center space-x-6 pt-3 border-t border-gray-100 dark:border-gray-700">
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

          <Link href={`/post/${post.id}`} className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-medium">{commentsCount}</span>
          </Link>

          <button className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Media Modal */}
      {showMediaModal && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={closeMediaModal}
        >
          {/* Close button */}
          <button
            onClick={closeMediaModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Media counter */}
          {mediaUrls.length > 1 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
              {currentMediaIndex + 1} / {mediaUrls.length}
            </div>
          )}

          {/* Previous button */}
          {mediaUrls.length > 1 && currentMediaIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                prevMedia()
              }}
              className="absolute left-4 text-white hover:text-gray-300 z-10"
            >
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next button */}
          {mediaUrls.length > 1 && currentMediaIndex < mediaUrls.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                nextMedia()
              }}
              className="absolute right-4 text-white hover:text-gray-300 z-10"
            >
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Media content */}
          <div 
            className="max-w-5xl max-h-[90vh] w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {getMediaType(mediaUrls[currentMediaIndex]) === 'image' ? (
              <div className="relative w-full h-[80vh]">
                <Image
                  src={mediaUrls[currentMediaIndex]}
                  alt={`Media ${currentMediaIndex + 1}`}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <video
                src={mediaUrls[currentMediaIndex]}
                controls
                autoPlay
                className="w-full h-auto max-h-[80vh]"
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}
