export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          updated_at?: string
        }
      }
      posts: {
        Row: {
          id: number
          user_id: string
          content: string
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          content: string
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          content?: string
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: number
          post_id: number
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: number
          post_id: number
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: number
          post_id?: number
          user_id?: string
          content?: string
          created_at?: string
        }
      }
      likes: {
        Row: {
          id: number
          post_id: number
          user_id: string
          created_at: string
        }
        Insert: {
          id?: number
          post_id: number
          user_id: string
          created_at?: string
        }
        Update: {
          id?: number
          post_id?: number
          user_id?: string
          created_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Post = Database['public']['Tables']['posts']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type Like = Database['public']['Tables']['likes']['Row']

export interface PostWithProfile extends Post {
  profiles: Profile
  likes: Like[]
  comments: Comment[]
  _count?: {
    likes: number
    comments: number
  }
}