// Di app/login/page.tsx, ganti handleGoogleLogin dengan ini:

const handleGoogleLogin = async () => {
  try {
    // Dapatkan origin yang benar
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const redirectTo = `${origin}/auth/callback`
    
    console.log('Initiating Google login with redirect:', redirectTo)
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('Google login error:', error)
      throw error
    }
    
    console.log('Google OAuth initiated:', data)
  } catch (error: any) {
    console.error('Google login error:', error)
    toast.error('Login dengan Google gagal: ' + (error.message || 'Unknown error'))
  }
}
