'use client'

import { useEffect, useState } from 'react'
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
  const [editForm, setEditForm] = useState({
    full_name: '',
    bio: '',
    avatar_url: '',
  })
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          bio: editForm.bio,
          avatar_url: editForm.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id)

      if (error) throw error

      toast.success('Profil berhasil diupdate')
      setIsEditing(false)
      fetchProfile()
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Gagal update profil')
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar URL
                </label>
                <input
                  type="url"
                  value={editForm.avatar_url}
                  onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
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