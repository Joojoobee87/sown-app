import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseClient

// Create a mock Supabase client if environment variables are missing
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase environment variables are missing. Using mock client.')
  
  // Create a mock client that prevents the app from crashing
  supabaseClient = {
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
} else {
  supabaseClient = createClient(supabaseUrl, supabaseKey)
}

export const supabase = supabaseClient
