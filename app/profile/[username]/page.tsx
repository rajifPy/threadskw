'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'
import { Profile, PostWithProfile } from '@/lib/supabase/types'
import Navbar from '@/components/ui/Navbar'
import ThreadCard from '@/components/ui/ThreadCard'
import { generateAvatarUrl } from '@/utils/helpers'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user, profile: currentUserProfile, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<PostWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '',
    bio: '',
    avatar_url: '',
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const username = params.username as string
  const isOwnProfile = currentUserProfile?.username === username

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  const fetchProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (profileError) throw profileError

      setProfile(profileData)
      setEditForm({
        full_name: profileData.full_name || '',
        bio: profileData.bio || '',
        avatar_url: profileData.avatar_url || '',
      })
      setAvatarPreview(profileData.avatar_url || '')
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast.error('Profil tidak ditemukan')
      router.push('/')
    }
  }

  const fetchUserPosts = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single()

      if (!profileData) return

      const { data: postsData, error: postsError } = await supabase
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
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false })

      if (postsError) throw postsError

      // Fetch likes and comments counts for each post
      const postsWithCounts = await Promise.all(
        (postsData || []).map(async (post) => {
          const [{ count: likesCount }, { count: commentsCount }] = await Promise.all([
            supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
            supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
          ])

          return {
            ...post,
            _count: {
              likes: likesCount || 0,
              comments: commentsCount || 0,
            },
          } as PostWithProfile
        })
      )

      setPosts(postsWithCounts)
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && username) {
      fetchProfile()
      fetchUserPosts()
    }
  }, [user, username])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar')
        return
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ukuran gambar maksimal 2MB')
        return
      }

      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile) return editForm.avatar_url

    setUploading(true)
    try {
      const fileExt = avatarFile.name.split('.').pop()
      const fileName = `${user!.id}-avatar-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      console.log('📤 [Avatar] Uploading avatar:', filePath)

      // Delete old avatar if exists and it's from our storage
      if (profile?.avatar_url && profile.avatar_url.includes('supabase.co/storage')) {
        try {
          const urlParts = profile.avatar_url.split('post-images/')
          if (urlParts.length > 1) {
            const oldPath = urlParts[1]
            console.log('🗑️ [Avatar] Deleting old avatar:', oldPath)
            await supabase.storage
              .from('post-images')
              .remove([oldPath])
          }
        } catch (err) {
          console.warn('⚠️ [Avatar] Could not delete old avatar:', err)
        }
      }

      // Upload new avatar
      const { error: uploadError, data } = await supabase.storage
        .from('post-images')
        .upload(filePath, avatarFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('❌ [Avatar] Upload error:', uploadError)
        throw uploadError
      }

      console.log('✅ [Avatar] Upload successful:', data)

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath)

      console.log('🔗 [Avatar] Public URL:', publicUrl)

      return publicUrl
    } catch (error: any) {
      console.error('❌ [Avatar] Upload failed:', error)
      
      if (error.message?.includes('Duplicate')) {
        toast.error('File sudah ada, coba lagi')
      } else if (error.message?.includes('size')) {
        toast.error('Ukuran file terlalu besar')
      } else {
        toast.error('Gagal upload avatar: ' + (error.message || 'Unknown error'))
      }
      
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Upload avatar if new file selected
      let avatarUrl = editForm.avatar_url
      if (avatarFile) {
        const uploadedUrl = await uploadAvatar()
        if (uploadedUrl) {
          avatarUrl = uploadedUrl
        } else {
          return // Upload failed
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          bio: editForm.bio,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id)

      if (error) throw error

      toast.success('Profil berhasil diupdate')
      setIsEditing(false)
      setAvatarFile(null)
      fetchProfile()
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Gagal update profil')
    }
  }

  const removeAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(editForm.avatar_url || '')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden">
                <Image
                  src={profile.avatar_url || generateAvatarUrl(profile.username)}
                  alt={profile.username}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile.full_name || profile.username}
                </h1>
                <p className="text-gray-500">@{profile.username}</p>
              </div>
            </div>

            {isOwnProfile && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border border-primary-500 text-primary-500 rounded-lg font-medium hover:bg-primary-50 transition-colors"
              >
                Edit Profile
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4 mt-4">
              {/* Avatar Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto Profil
                </label>
                <div className="flex items-center space-x-4">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200">
                    <Image
                      src={avatarPreview || generateAvatarUrl(profile.username)}
                      alt="Avatar preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      Pilih Gambar
                    </label>
                    {avatarFile && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="ml-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition-colors"
                      >
                        Hapus
                      </button>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      JPG, PNG, atau GIF. Maksimal 2MB.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                  rows={3}
                  maxLength={150}
                />
                <p className="text-xs text-gray-500 mt-1">{editForm.bio.length}/150</p>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setAvatarFile(null)
                    setAvatarPreview(profile.avatar_url || '')
                  }}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          ) : (
            <>
              {profile.bio && (
                <p className="text-gray-700 mt-4">{profile.bio}</p>
              )}

              <div className="flex items-center space-x-6 mt-6 pt-4 border-t border-gray-100">
                <div>
                  <span className="font-bold text-gray-900">{posts.length}</span>
                  <span className="text-gray-500 ml-1">Threads</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Threads</h2>
        </div>

        {posts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <p className="text-gray-500">Belum ada post</p>
          </div>
        ) : (
          <div>
            {posts.map((post) => (
              <ThreadCard
                key={post.id}
                post={post}
                onDelete={fetchUserPosts}
                onUpdate={fetchUserPosts}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
export const dynamic = 'force-dynamic'
