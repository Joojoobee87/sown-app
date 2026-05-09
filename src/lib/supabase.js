import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('=== Supabase Debug ===')
console.log('URL value:', supabaseUrl)
console.log('Key length:', supabaseKey ? supabaseKey.length : 'MISSING')

let supabaseClient

// Simple initialization with stable Supabase version 2.39.8
if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://') && supabaseKey.startsWith('eyJ')) {
  try {
    console.log('Creating real Supabase client with stable version...')
    supabaseClient = createClient(supabaseUrl, supabaseKey)
    console.log('Real Supabase client created successfully - emails will work!')
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    console.warn('Falling back to mock client - emails will not work')
    supabaseClient = createMockClient()
  }
} else {
  console.warn('Invalid Supabase environment variables, using mock client')
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
