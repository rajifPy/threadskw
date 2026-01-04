'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import toast from 'react-hot-toast'

interface CreatePostProps {
  onPostCreated: () => void
}

export default function CreatePost({ onPostCreated }: CreatePostProps) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [showTruck, setShowTruck] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  
  // Audio refs
  const truckSoundRef = useRef<HTMLAudioElement | null>(null)
  const successSoundRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio elements
  useEffect(() => {
    truckSoundRef.current = new Audio('/sound/volvo-engine-431665.mp3')
    successSoundRef.current = new Audio('/sound/successed-295058.mp3')
    
    // Preload audio
    truckSoundRef.current.load()
    successSoundRef.current.load()
    
    return () => {
      // Cleanup
      if (truckSoundRef.current) {
        truckSoundRef.current.pause()
        truckSoundRef.current = null
      }
      if (successSoundRef.current) {
        successSoundRef.current.pause()
        successSoundRef.current = null
      }
    }
  }, [])

  const playTruckSound = () => {
    if (truckSoundRef.current) {
      truckSoundRef.current.currentTime = 0
      truckSoundRef.current.play().catch(err => console.log('Truck sound error:', err))
    }
  }

  const playSuccessSound = () => {
    if (successSoundRef.current) {
      successSoundRef.current.currentTime = 0
      successSoundRef.current.play().catch(err => console.log('Success sound error:', err))
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran gambar maksimal 5MB')
        return
      }

      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null

    try {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${user!.id}-${Date.now()}.${fileExt}`
      const filePath = `posts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error: any) {
      console.error('Upload failed:', error)
      toast.error('Gagal upload gambar')
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim() && !imageFile) {
      toast.error('Post tidak boleh kosong')
      return
    }

    setSubmitting(true)
    setShowTruck(true)
    
    // Play truck sound when animation starts
    playTruckSound()

    try {
      let imageUrl: string | null = null
      if (imageFile) {
        imageUrl = await uploadImage()
        if (!imageUrl) {
          setSubmitting(false)
          setShowTruck(false)
          return
        }
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user!.id,
          content: content.trim(),
          image_url: imageUrl,
        })

      if (error) throw error

      // Wait for truck animation to complete (3s total)
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Play success sound
      playSuccessSound()
      
      setShowTruck(false)
      toast.success('Post berhasil dibuat!')
      setContent('')
      setImageFile(null)
      setImagePreview('')
      onPostCreated()
    } catch (error) {
      console.error('Error creating post:', error)
      toast.error('Gagal membuat post')
      setShowTruck(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6 transition-colors duration-300">
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Apa yang ingin kamu bagikan?"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none transition-colors duration-300"
            rows={4}
            maxLength={500}
            disabled={submitting}
          />

          {imagePreview && (
            <div className="mt-4 relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full max-h-64 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="post-image"
                disabled={submitting}
              />
              <label
                htmlFor="post-image"
                className={`flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                  submitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">Gambar</span>
              </label>
              <span className={`text-sm ${content.length > 450 ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                {content.length}/500
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || (!content.trim() && !imageFile)}
              className="px-6 py-2 bg-primary-500 text-white rounded-full font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      {/* Truck Animation with Sound */}
      {showTruck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md">
            {/* Animated Truck */}
            <div className="truck-animation">
              <svg viewBox="0 0 200 100" className="w-full">
                {/* Road */}
                <rect x="0" y="70" width="200" height="4" fill="#444" className="dark:fill-gray-600" />
                
                {/* Truck Body */}
                <g className="truck">
                  <rect x="60" y="45" width="50" height="25" fill="#22c55e" rx="2" />
                  <rect x="110" y="50" width="25" height="20" fill="#16a34a" rx="2" />
                  
                  {/* Wheels */}
                  <circle cx="75" cy="70" r="6" fill="#333" className="wheel" />
                  <circle cx="120" cy="70" r="6" fill="#333" className="wheel" />
                  
                  {/* Window */}
                  <rect x="115" y="55" width="15" height="10" fill="#fff" opacity="0.7" rx="1" />
                </g>
              </svg>
            </div>

            <div className="text-center mt-6">
              <p className="text-white text-lg font-medium">Mengirim post...</p>
              <div className="mt-3 flex justify-center space-x-1">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes truckDrive {
          0% {
            transform: translateX(-100px);
          }
          100% {
            transform: translateX(300px);
          }
        }

        @keyframes wheelRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .truck {
          animation: truckDrive 3s ease-in-out;
          transform-origin: center;
        }

        .wheel {
          animation: wheelRotate 0.5s linear infinite;
          transform-origin: center;
        }
      `}</style>
    </>
  )
}
