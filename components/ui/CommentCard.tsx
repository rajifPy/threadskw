'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Comment, Profile } from '@/lib/supabase/types'
import { getRelativeTime, generateAvatarUrl } from '@/utils/helpers'
import { useAuth } from '@/components/layout/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface CommentWithProfile extends Comment {
  profiles: Profile
}

interface CommentCardProps {
  comment: CommentWithProfile
  onDelete?: () => void
}

export default function CommentCard({ comment, onDelete }: CommentCardProps) {
  const { user } = useAuth()
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = createClient()

  const isOwner = user?.id === comment.user_id

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
    <div className="flex items-start space-x-3 py-4 border-b border-gray-100 last:border-b-0">
      <Link href={`/profile/${comment.profiles.username}`}>
        <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
          <Image
            src={comment.profiles.avatar_url || generateAvatarUrl(comment.profiles.username)}
            alt={comment.profiles.username}
            fill
            className="object-cover"
          />
        </div>
      </Link>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <Link href={`/profile/${comment.profiles.username}`} className="flex items-center space-x-2">
            <span className="font-semibold text-gray-900 text-sm">
              {comment.profiles.full_name || comment.profiles.username}
            </span>
            <span className="text-gray-500 text-sm">@{comment.profiles.username}</span>
          </Link>
          <span className="text-xs text-gray-400">{getRelativeTime(comment.created_at)}</span>
        </div>

        <p className="text-gray-800 text-sm whitespace-pre-wrap">{comment.content}</p>

        {isOwner && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="mt-2 text-xs text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Menghapus...' : 'Hapus'}
          </button>
        )}
      </div>
    </div>
  )
}