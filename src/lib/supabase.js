// Simple mock Supabase client - no real initialization
export const supabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        data: [],
        error: null
      })
    })
  }),
  auth: {
    getUser: () => ({ data: { user: null }, error: null }),
    signInWithPassword: () => ({ data: { user: null }, error: null }),
    signOut: () => ({ error: null })
  }
}
