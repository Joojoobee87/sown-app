import { createClient } from '@supabase/supabase-js'

// Get environment variables with detailed debugging
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('=== Supabase Debug ===')
console.log('URL value:', supabaseUrl)
console.log('URL type:', typeof supabaseUrl)
console.log('Key length:', supabaseKey ? supabaseKey.length : 'MISSING')
console.log('Key starts with eyJ?:', supabaseKey?.startsWith('eyJ'))

let supabaseClient

// Create Supabase client with validation and alternative initialization
if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://') && supabaseKey.startsWith('eyJ')) {
  try {
    console.log('Creating real Supabase client with validated credentials...')
    
    // Try different initialization approaches for version compatibility
    try {
      // Approach 1: Standard initialization
      supabaseClient = createClient(supabaseUrl, supabaseKey)
    } catch (e1) {
      console.log('Standard init failed, trying with empty options...')
      try {
        // Approach 2: With empty options object
        supabaseClient = createClient(supabaseUrl, supabaseKey, {})
      } catch (e2) {
        console.log('Empty options failed, trying with null options...')
        try {
          // Approach 3: With null options
          supabaseClient = createClient(supabaseUrl, supabaseKey, null)
        } catch (e3) {
          throw new Error('All initialization approaches failed')
        }
      }
    }
    
    console.log('Real Supabase client created successfully - emails will work!')
  } catch (error) {
    console.error('All Supabase client creation attempts failed:', error)
    console.warn('Falling back to mock client - emails will not work')
    supabaseClient = createMockClient()
  }
} else {
  console.warn('Invalid Supabase environment variables, using mock client')
  console.log('URL valid:', supabaseUrl?.startsWith('https://'))
  console.log('Key valid:', supabaseKey?.startsWith('eyJ'))
  supabaseClient = createMockClient()
}

function createMockClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          data: [],
          error: null
        })
      })
    }),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async ({ email, password }) => {
        console.log('Mock sign in:', email)
        return { 
          data: { 
            user: { 
              id: 'mock-user-id', 
              email, 
              created_at: new Date().toISOString() 
            } 
          }, 
          error: null 
        }
      },
      signUp: async ({ email, password, options }) => {
        console.log('Mock sign up:', email)
        return { 
          data: { 
            user: { 
              id: 'mock-user-id', 
              email, 
              created_at: new Date().toISOString() 
            } 
          }, 
          error: null 
        }
      },
      signInWithOtp: async ({ email }) => {
        console.log('Mock magic link sent to:', email)
        return { error: null }
      },
      resetPasswordForEmail: async (email, options) => {
        console.log('Mock password reset sent to:', email)
        return { error: null }
      },
      setSession: async ({ access_token, refresh_token }) => {
        console.log('Mock session set with tokens')
        return { error: null }
      },
      signOut: async () => ({ error: null }),
      onAuthStateChange: (callback) => {
        const { data: { subscription } } = {
          data: {
            subscription: {
              unsubscribe: () => {}
            }
          }
        }
        return { data: { subscription } }
      }
    }
  }
}

export const supabase = supabaseClient
