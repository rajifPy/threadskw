'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/layout/AuthProvider'

export default function DebugPage() {
  const { user, profile, loading } = useAuth()
  const [session, setSession] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
    }
    checkSession()
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug Auth Status</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Auth Context</h2>
          <div className="space-y-2">
            <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
            <p><strong>User:</strong> {user ? user.email : 'null'}</p>
            <p><strong>User ID:</strong> {user?.id || 'null'}</p>
            <p><strong>Profile:</strong> {profile ? profile.username : 'null'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">Session Data</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <button
            onClick={async () => {
              const { data } = await supabase.auth.getSession()
              setSession(data.session)
              alert('Session refreshed!')
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
          >
            Refresh Session
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              alert('Signed out!')
            }}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'