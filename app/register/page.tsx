const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)

  try {
    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .single()

    if (existingUser) {
      toast.error('Username sudah digunakan')
      setLoading(false)
      return
    }

    // Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase(),
          full_name: fullName,
        },
      },
    })

    if (authError) throw authError

    if (authData.user) {
      // Wait a moment for auth session to be established
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Create profile with proper error handling
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username: username.toLowerCase(),
        full_name: fullName,
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Try to delete the auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id)
        throw new Error('Gagal membuat profil. Silakan coba lagi.')
      }

      toast.success('Registrasi berhasil!')
      router.push('/login')
    }
  } catch (error: any) {
    console.error('Registration error:', error)
    toast.error(error.message || 'Registrasi gagal')
  } finally {
    setLoading(false)
  }
}
