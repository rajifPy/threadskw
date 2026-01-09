'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import { getRelativeTime, generateAvatarUrl } from '@/utils/helpers'
import toast from 'react-hot-toast'

interface CommentMetadata {
  sticker?: string | null
  voiceNote?: string | null
  type?: 'text' | 'sticker' | 'voice'
}

interface CommentWithProfile {
  id: number
  post_id: number
  user_id: string
  content: string
  created_at: string
  metadata?: string | null
  profiles: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

interface EnhancedCommentCardProps {
  comment: CommentWithProfile
  onDelete?: () => void
}

export default function EnhancedCommentCard({ comment, onDelete }: EnhancedCommentCardProps) {
  const { user } = useAuth()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const supabase = createClient()

  const isOwner = user?.id === comment.user_id

  // Parse metadata
  const metadata: CommentMetadata = comment.metadata 
    ? JSON.parse(comment.metadata)
    : {}

  const handleDelete = async () => {
    if (!confirm('Yakin ingin menghapus komentar ini?')) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', comment.id)

      if (error) throw error

      toast.success('Komentar berhasil dihapus')
      if (onDelete) onDelete()
    } catch (error) {
      console.error('Error deleting comment:', error)
      toast.error('Gagal menghapus komentar')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="relative flex items-start space-x-3 pb-6">
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

        {/* Text Content */}
        {comment.content && (
          <p className="text-gray-800 dark:text-gray-100 text-sm whitespace-pre-wrap mb-2">
            {comment.content}
          </p>
        )}

        {/* Sticker Display */}
        {metadata.sticker && (
          <div className="my-2 inline-block">
            <div className="relative w-24 h-24 bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
              <Image
                src={metadata.sticker}
                alt="Sticker"
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}

        {/* Voice Note Display */}
        {metadata.voiceNote && (
          <div className="my-2 max-w-sm">
            <div className="flex items-center space-x-2 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex-shrink-0 w-10 h-10 bg-primary-500 hover:bg-primary-600 rounded-full flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              
              <div className="flex-1">
                <audio
                  controls
                  src={metadata.voiceNote}
                  className="w-full h-8"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              </div>
              
              <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        {/* Delete Button */}
        {isOwner && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="mt-2 text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Menghapus...' : 'Hapus'}
          </button>
        )}
      </div>
    </div>
  )
}
