import { createClient } from '@supabase/supabase-js'

// Get environment variables with fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

let supabaseClient

// Create a mock Supabase client if environment variables are missing
if (!supabaseUrl || !supabaseKey || supabaseUrl === '' || supabaseKey === '') {
  console.warn('Supabase environment variables are missing. Using mock client.')
  console.log('VITE_SUPABASE_URL:', supabaseUrl)
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '***' : 'MISSING')
  
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
  console.log('Supabase environment variables found. Creating real client.')
  console.log('URL found:', supabaseUrl ? 'YES' : 'NO')
  console.log('Key found:', supabaseKey ? 'YES' : 'NO')
  console.log('URL value:', supabaseUrl)
  console.log('Key length:', supabaseKey.length)
  
  // Validate URL format
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    console.error('Invalid Supabase URL format:', supabaseUrl)
    console.warn('Falling back to mock client due to invalid URL.')
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
    try {
      // Add more validation for the key
      if (!supabaseKey || supabaseKey.length < 20) {
        throw new Error('Invalid Supabase key format')
      }
      
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
      console.log('Supabase client created successfully.')
    } catch (error) {
      console.error('Error creating Supabase client:', error)
      console.warn('Falling back to mock client due to initialization error.')
    
      // Fallback to mock client
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
    }
  }
}

export const supabase = supabaseClient
// Force deployment trigger Thu May  7 16:29:49 BST 2026
