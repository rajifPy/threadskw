'use client'

import { useState, useRef, useEffect } from 'react'
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

interface MediaFile {
  file: File
  preview: string
  type: 'image' | 'video'
  size: number
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
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const truckSoundRef = useRef<HTMLAudioElement | null>(null)
  const successSoundRef = useRef<HTMLAudioElement | null>(null)

  const MAX_CHARS = 500
  const MAX_TOTAL_SIZE = 5 * 1024 * 1024 // 5MB
  const MAX_FILES = 4 // Maximum 4 files

  // Initialize audio
  useEffect(() => {
    truckSoundRef.current = new Audio('/sound/volvo-engine-431665.mp3')
    successSoundRef.current = new Audio('/sound/successed-295058.mp3')
    
    if (truckSoundRef.current) truckSoundRef.current.volume = 0.7
    if (successSoundRef.current) successSoundRef.current.volume = 0.8
    
    truckSoundRef.current.load()
    successSoundRef.current.load()
    
    return () => {
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

  // Load initial media if editing
  useEffect(() => {
    if (editMode && initialImageUrl) {
      // For edit mode, we'll keep the old single image approach
      // You can enhance this to load multiple images if stored as JSON
    }
  }, [editMode, initialImageUrl])

  const playTruckSound = () => {
    if (truckSoundRef.current) {
      truckSoundRef.current.currentTime = 0
      truckSoundRef.current.play().catch(err => console.error('Truck sound error:', err))
    }
  }

  const playSuccessSound = () => {
    if (successSoundRef.current) {
      successSoundRef.current.currentTime = 0
      successSoundRef.current.play().catch(err => console.error('Success sound error:', err))
    }
  }

  const getTotalSize = (files: MediaFile[]) => {
    return files.reduce((total, file) => total + file.size, 0)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length === 0) return

    // Check if adding these files would exceed max count
    if (mediaFiles.length + files.length > MAX_FILES) {
      toast.error(`Maksimal ${MAX_FILES} file`)
      return
    }

    const newMediaFiles: MediaFile[] = []
    let totalSize = getTotalSize(mediaFiles)

    for (const file of files) {
      // Validate file type
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      
      if (!isImage && !isVideo) {
        toast.error(`${file.name} bukan file gambar/video`)
        continue
      }

      // Check if adding this file would exceed size limit
      if (totalSize + file.size > MAX_TOTAL_SIZE) {
        toast.error(`Total ukuran file tidak boleh lebih dari 5MB. Saat ini: ${formatFileSize(totalSize + file.size)}`)
        break
      }

      totalSize += file.size

      newMediaFiles.push({
        file,
        preview: URL.createObjectURL(file),
        type: isImage ? 'image' : 'video',
        size: file.size
      })
    }

    if (newMediaFiles.length > 0) {
      setMediaFiles(prev => [...prev, ...newMediaFiles])
      toast.success(`${newMediaFiles.length} file ditambahkan`)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const newFiles = [...prev]
      // Revoke URL to free memory
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
    toast.success('File dihapus')
  }

  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user!.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading media:', error)
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
    playTruckSound()
    const startTime = Date.now()

    try {
      let mediaUrls: string[] = []

      // Upload all media files
      if (mediaFiles.length > 0) {
        toast.loading(`Uploading ${mediaFiles.length} file...`, { id: 'upload' })
        
        const uploadPromises = mediaFiles.map(media => uploadMedia(media.file))
        const results = await Promise.all(uploadPromises)
        
        mediaUrls = results.filter((url): url is string => url !== null)
        
        if (mediaUrls.length < mediaFiles.length) {
          toast.error('Beberapa file gagal diupload', { id: 'upload' })
        } else {
          toast.success('Semua file berhasil diupload!', { id: 'upload' })
        }
      }

      // Store media URLs as JSON string
      const mediaUrlsJson = mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null

      if (editMode && postId) {
        const { error } = await supabase
          .from('posts')
          .update({
            content: content.trim(),
            image_url: mediaUrlsJson,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId)

        if (error) throw error
        
        const elapsed = Date.now() - startTime
        if (elapsed < 9000) {
          await new Promise(resolve => setTimeout(resolve, 9000 - elapsed))
        }
        
        playSuccessSound()
        toast.success('Post berhasil diupdate!')
      } else {
        const { error } = await supabase
          .from('posts')
          .insert({
            user_id: user!.id,
            content: content.trim(),
            image_url: mediaUrlsJson,
          })

        if (error) throw error
        
        const elapsed = Date.now() - startTime
        if (elapsed < 9000) {
          await new Promise(resolve => setTimeout(resolve, 9000 - elapsed))
        }
        
        playSuccessSound()
        toast.success('Post berhasil dibuat!')
      }

      // Cleanup
      mediaFiles.forEach(media => URL.revokeObjectURL(media.preview))
      setContent('')
      setMediaFiles([])
      
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

  const totalSize = getTotalSize(mediaFiles)
  const remainingSize = MAX_TOTAL_SIZE - totalSize

  return (
    <>
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl max-w-sm mx-4 animate-in fade-in zoom-in duration-300">
            <style jsx>{`
              .truck-wrapper {
                width: 180px;
                height: 90px;
                display: flex;
                flex-direction: column;
                position: relative;
                align-items: center;
                justify-content: flex-end;
                overflow-x: hidden;
                margin: 0 auto;
              }

              .truck-body {
                width: 65%;
                height: fit-content;
                margin-bottom: 6px;
                animation: motion 1s linear infinite;
              }

              @keyframes motion {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(3px); }
              }

              .truck-tires {
                width: 65%;
                height: fit-content;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0px 10px 0px 15px;
                position: absolute;
                bottom: 0;
              }

              .truck-tires svg {
                width: 22px;
              }

              .road {
                width: 100%;
                height: 1.5px;
                background-color: #64748b;
                position: relative;
                bottom: 0;
                align-self: flex-end;
                border-radius: 3px;
              }

              .road::before {
                content: "";
                position: absolute;
                width: 20px;
                height: 100%;
                background-color: #64748b;
                right: -50%;
                border-radius: 3px;
                animation: roadAnimation 1.4s linear infinite;
                border-left: 10px solid #f1f5f9;
              }

              .road::after {
                content: "";
                position: absolute;
                width: 10px;
                height: 100%;
                background-color: #64748b;
                right: -65%;
                border-radius: 3px;
                animation: roadAnimation 1.4s linear infinite;
                border-left: 4px solid #f1f5f9;
              }

              .lamp-post {
                position: absolute;
                bottom: 0;
                right: -90%;
                height: 80px;
                animation: roadAnimation 1.4s linear infinite;
              }

              @keyframes roadAnimation {
                0% { transform: translateX(0px); }
                100% { transform: translateX(-350px); }
              }

              .loading-text {
                animation: pulse 1.5s ease-in-out infinite;
              }

              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
              }

              .progress-bar {
                width: 100%;
                height: 6px;
                background: #e5e7eb;
                border-radius: 3px;
                overflow: hidden;
                margin-top: 1.5rem;
              }

              .progress-bar-fill {
                height: 100%;
                background: linear-gradient(90deg, #22c55e, #16a34a);
                animation: progress 8s linear;
              }

              @keyframes progress {
                from { width: 0%; }
                to { width: 100%; }
              }

              @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
              }

              @keyframes zoom-in {
                from { transform: scale(0.95); }
                to { transform: scale(1); }
              }

              .animate-in {
                animation: fade-in 0.3s ease-out, zoom-in 0.3s ease-out;
              }
            `}</style>

            <div className="truck-wrapper mb-6">
              <div className="truck-body">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 198 93">
                  <path strokeWidth={3} stroke="#64748b" fill="#22c55e" d="M135 22.5H177.264C178.295 22.5 179.22 23.133 179.594 24.0939L192.33 56.8443C192.442 57.1332 192.5 57.4404 192.5 57.7504V89C192.5 90.3807 191.381 91.5 190 91.5H135C133.619 91.5 132.5 90.3807 132.5 89V25C132.5 23.6193 133.619 22.5 135 22.5Z" />
                  <path strokeWidth={3} stroke="#64748b" fill="#6b7280" d="M146 33.5H181.741C182.779 33.5 183.709 34.1415 184.078 35.112L190.538 52.112C191.16 53.748 189.951 55.5 188.201 55.5H146C144.619 55.5 143.5 54.3807 143.5 53V36C143.5 34.6193 144.619 33.5 146 33.5Z" />
                  <path strokeWidth={2} stroke="#64748b" fill="#64748b" d="M150 65C150 65.39 149.763 65.8656 149.127 66.2893C148.499 66.7083 147.573 67 146.5 67C145.427 67 144.501 66.7083 143.873 66.2893C143.237 65.8656 143 65.39 143 65C143 64.61 143.237 64.1344 143.873 63.7107C144.501 63.2917 145.427 63 146.5 63C147.573 63 148.499 63.2917 149.127 63.7107C149.763 64.1344 150 64.61 150 65Z" />
                  <rect strokeWidth={2} stroke="#64748b" fill="#fbbf24" rx={1} height={7} width={5} y={63} x={187} />
                  <rect strokeWidth={2} stroke="#64748b" fill="#64748b" rx={1} height={11} width={4} y={81} x={193} />
                  <rect strokeWidth={3} stroke="#64748b" fill="#d1d5db" rx="2.5" height={90} width={121} y="1.5" x="6.5" />
                  <rect strokeWidth={2} stroke="#64748b" fill="#d1d5db" rx={2} height={4} width={6} y={84} x={1} />
                </svg>
              </div>

              <div className="truck-tires">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30">
                  <circle strokeWidth={3} stroke="#64748b" fill="#64748b" r="13.5" cy={15} cx={15} />
                  <circle fill="#d1d5db" r={7} cy={15} cx={15} />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30">
                  <circle strokeWidth={3} stroke="#64748b" fill="#64748b" r="13.5" cy={15} cx={15} />
                  <circle fill="#d1d5db" r={7} cy={15} cx={15} />
                </svg>
              </div>

              <div className="road" />

              <svg xmlSpace="preserve" viewBox="0 0 453.459 453.459" xmlns="http://www.w3.org/2000/svg" className="lamp-post" fill="#64748b">
                <path d="M252.882,0c-37.781,0-68.686,29.953-70.245,67.358h-6.917v8.954c-26.109,2.163-45.463,10.011-45.463,19.366h9.993c-1.65,5.146-2.507,10.54-2.507,16.017c0,28.956,23.558,52.514,52.514,52.514c28.956,0,52.514-23.558,52.514-52.514c0-5.478-0.856-10.872-2.506-16.017h9.992c0-9.354-19.352-17.204-45.463-19.366v-8.954h-6.149C200.189,38.779,223.924,16,252.882,16c29.952,0,54.32,24.368,54.32,54.32c0,28.774-11.078,37.009-25.105,47.437c-17.444,12.968-37.216,27.667-37.216,78.884v113.914h-0.797c-5.068,0-9.174,4.108-9.174,9.177c0,2.844,1.293,5.383,3.321,7.066c-3.432,27.933-26.851,95.744-8.226,115.459v11.202h45.75v-11.202c18.625-19.715-4.794-87.527-8.227-115.459c2.029-1.683,3.322-4.223,3.322-7.066c0-5.068-4.107-9.177-9.176-9.177h-0.795V196.641c0-43.174,14.942-54.283,30.762-66.043c14.793-10.997,31.559-23.461,31.559-60.277C323.202,31.545,291.656,0,252.882,0zM232.77,111.694c0,23.442-19.071,42.514-42.514,42.514c-23.442,0-42.514-19.072-42.514-42.514c0-5.531,1.078-10.957,3.141-16.017h78.747C231.693,100.736,232.77,106.162,232.77,111.694z" />
              </svg>
            </div>

            <div className="text-center loading-text">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {editMode ? 'Updating Post...' : 'Posting...'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Sedang mengirim post Anda 🚚
              </p>
              
              <div className="progress-bar">
                <div className="progress-bar-fill"></div>
              </div>
            </div>
          </div>
        </div>
      )}

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

            {/* Media Preview Grid */}
            {mediaFiles.length > 0 && (
              <div className={`mt-3 grid gap-2 ${
                mediaFiles.length === 1 ? 'grid-cols-1' :
                mediaFiles.length === 2 ? 'grid-cols-2' :
                mediaFiles.length === 3 ? 'grid-cols-2' :
                'grid-cols-2'
              }`}>
                {mediaFiles.map((media, index) => (
                  <div 
                    key={index} 
                    className={`relative rounded-lg overflow-hidden group ${
                      mediaFiles.length === 3 && index === 2 ? 'col-span-2' : ''
                    }`}
                  >
                    {media.type === 'image' ? (
                      <Image
                        src={media.preview}
                        alt={`Preview ${index + 1}`}
                        width={300}
                        height={200}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <video
                        src={media.preview}
                        className="w-full h-48 object-cover"
                        controls
                      />
                    )}
                    
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </button>
                    
                    {/* File info */}
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {formatFileSize(media.size)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                {/* Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaChange}
                  className="hidden"
                  id="media-upload"
                  multiple
                  disabled={mediaFiles.length >= MAX_FILES}
                />
                <label
                  htmlFor="media-upload"
                  className={`cursor-pointer transition-colors ${
                    mediaFiles.length >= MAX_FILES
                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      : 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300'
                  }`}
                  title={mediaFiles.length >= MAX_FILES ? `Maksimal ${MAX_FILES} file` : 'Upload media'}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </label>
                
                {/* File counter and size info */}
                <div className="text-xs">
                  <div className="flex items-center space-x-2">
                    <span className={`${mediaFiles.length > 0 ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {mediaFiles.length}/{MAX_FILES} file
                    </span>
                    {mediaFiles.length > 0 && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className={`${totalSize > MAX_TOTAL_SIZE * 0.8 ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400'}`}>
                          {formatFileSize(totalSize)}/{formatFileSize(MAX_TOTAL_SIZE)}
                        </span>
                      </>
                    )}
                  </div>
                  {mediaFiles.length > 0 && remainingSize < MAX_TOTAL_SIZE * 0.2 && (
                    <div className="text-orange-500 mt-0.5">
                      Sisa: {formatFileSize(remainingSize)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Character counter */}
                <span className={`text-sm ${content.length > MAX_CHARS - 50 ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                  {content.length}/{MAX_CHARS}
                </span>

                {/* Cancel button for edit mode */}
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

                {/* Submit button */}
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
    </>
  )
}
