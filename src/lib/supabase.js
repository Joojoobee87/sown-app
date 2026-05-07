import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseClient

// Create Supabase client with proper error handling
if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
    console.log('Supabase client created successfully')
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    // Fall back to mock client
    supabaseClient = createMockClient()
  }
} else {
  console.warn('Missing Supabase environment variables, using mock client')
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
      getUser: () => ({ data: { user: null }, error: null }),
      signInWithPassword: async (email, password) => {
        // Mock successful sign in for testing
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
      signUp: async (email, password) => {
        // Mock successful sign up for testing
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
      signOut: async () => ({ error: null }),
      onAuthStateChange: (callback) => {
        // Mock auth state change listener
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
