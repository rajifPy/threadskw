'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import toast from 'react-hot-toast'
import { generateAvatarUrl } from '@/utils/helpers'

interface CreatePostProps {
  onPostCreated?: () => void
  editMode?: boolean
  initialContent?: string
  initialImageUrl?: string
  postId?: number
  onCancel?: () => void
}

export default function CreatePost({ 
  onPostCreated, 
  editMode = false,
  initialContent = '',
  initialImageUrl = '',
  postId,
  onCancel
}: CreatePostProps) {
  const { user, profile } = useAuth()
  const [content, setContent] = useState(initialContent)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>(initialImageUrl)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const MAX_CHARS = 500

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran gambar maksimal 5MB')
        return
      }
      setImage(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const removeImage = () => {
    setImage(null)
    setImagePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user!.id}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!content.trim()) {
      toast.error('Konten tidak boleh kosong')
      return
    }

    setLoading(true)

    try {
      let imageUrl = imagePreview

      if (image) {
        const uploadedUrl = await uploadImage(image)
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        }
      }

      if (editMode && postId) {
        const { error } = await supabase
          .from('posts')
          .update({
            content: content.trim(),
            image_url: imageUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId)

        if (error) throw error
        toast.success('Post berhasil diupdate!')
      } else {
        const { error } = await supabase
          .from('posts')
          .insert({
            user_id: user!.id,
            content: content.trim(),
            image_url: imageUrl || null,
          })

        if (error) throw error
        toast.success('Post berhasil dibuat!')
      }

      setContent('')
      setImage(null)
      setImagePreview('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      if (onPostCreated) {
        onPostCreated()
      }
    } catch (error) {
      console.error('Error creating post:', error)
      toast.error('Gagal membuat post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-6 transition-colors duration-300">
      <div className="flex items-start space-x-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
          <Image
            src={profile?.avatar_url || generateAvatarUrl(profile?.username || 'user')}
            alt="Avatar"
            fill
            className="object-cover"
          />
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Apa pendapat kamu?"
            className="w-full resize-none border-none focus:outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-transparent"
            rows={3}
            maxLength={MAX_CHARS}
          />

          {imagePreview && (
            <div className="relative mt-3 rounded-lg overflow-hidden">
              <Image
                src={imagePreview}
                alt="Preview"
                width={500}
                height={300}
                className="w-full h-auto max-h-96 object-cover"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </label>
              
              <span className={`text-sm ${content.length > MAX_CHARS - 50 ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                {content.length}/{MAX_CHARS}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {editMode && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 font-medium transition-colors"
                  disabled={loading}
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="px-6 py-2 bg-primary-500 text-white rounded-full font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : editMode ? 'Update' : 'Posting'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
