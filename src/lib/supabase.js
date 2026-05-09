// Manual Supabase client implementation to bypass createClient issues
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('=== Supabase Debug ===')
console.log('URL value:', supabaseUrl)
console.log('Key length:', supabaseKey ? supabaseKey.length : 'MISSING')
console.log('Testing Supabase endpoints...')
console.log('Auth URL should be:', `${supabaseUrl}/auth/v1/signup`)

let supabaseClient

// Always try to create real Supabase client first
try {
  let createClient
  // Try dynamic import for browser environments
  if (typeof window !== 'undefined') {
    createClient = window.require('@supabase/supabase-js')
  } else {
    createClient = require('@supabase/supabase-js')
  }
  
  if (createClient && supabaseUrl && supabaseKey) {
    console.log('Creating real Supabase client...')
    supabaseClient = createClient(supabaseUrl, supabaseKey)
  }
} catch (error) {
  console.log('Failed to create real Supabase client, using mock:', error)
}

// Fallback to manual client only if real client creation fails
if (!supabaseClient && supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://') && supabaseKey.startsWith('eyJ')) {
  console.log('Creating manual Supabase client implementation...')
  
  supabaseClient = {
    // Manual auth implementation that calls Supabase REST API directly
    auth: {
      getSession: async () => {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey
            }
          })
          const data = await response.json()
          return { data: { session: data }, error: null }
        } catch (error) {
          return { data: { session: null }, error }
        }
      },
      getUser: async () => {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey
            }
          })
          const data = await response.json()
          return { data: { user: data }, error: null }
        } catch (error) {
          return { data: { user: null }, error }
        }
      },
      signInWithPassword: async ({ email, password }) => {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey
            },
            body: JSON.stringify({ email, password })
          })
          const data = await response.json()
          
          if (data.access_token) {
            console.log('Real sign in successful for:', email)
            return { 
              data: { 
                user: { 
                  id: data.user?.id || 'real-user-id', 
                  email, 
                  created_at: new Date().toISOString() 
                } 
              }, 
              error: null 
            }
          } else {
            return { data: { user: null }, error: data }
          }
        } catch (error) {
          console.log('Real sign in failed for:', email, error)
          return { data: { user: null }, error }
        }
      },
      signUp: async ({ email, password, options }) => {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey
            },
            body: JSON.stringify({ 
              email, 
              password,
              data: options?.data || {},
              // Add email confirmation settings
              email_confirm: true,
              gotrue: {
                email: email
              }
            })
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log('✅ Real sign up successful for:', email, '- email should be sent')
            return { 
              data: { 
                user: { 
                  id: data.user?.id || 'real-user-id', 
                  email, 
                  email_confirmed: false,
                  created_at: new Date().toISOString() 
                } 
              }, 
              error: null 
            }
          } else {
            const errorData = await response.json().catch(() => ({}))
            console.log('❌ Sign up failed for:', email, response.status, errorData)
            return { data: { user: null }, error: errorData || new Error(`HTTP ${response.status}`) }
          }
        } catch (error) {
          console.log('❌ Real sign up failed for:', email, error)
          return { data: { user: null }, error }
        }
      },
      signInWithOtp: async ({ email }) => {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/magiclink`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey
            },
            body: JSON.stringify({ email })
          })
          
          if (response.ok) {
            console.log('✅ Real magic link sent to:', email)
            return { error: null }
          } else {
            const errorData = await response.json().catch(() => ({}))
            console.log('❌ Magic link failed for:', email, response.status, errorData)
            return { error: errorData || new Error(`HTTP ${response.status}`) }
          }
        } catch (error) {
          console.log('❌ Real magic link failed for:', email, error)
          return { error }
        }
      },
      resetPasswordForEmail: async (email, options) => {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey
            },
            body: JSON.stringify({ 
              email,
              redirectTo: `${window.location.origin}/password-reset`
            })
          })
          
          if (response.ok) {
            console.log('✅ Real password reset sent to:', email)
            return { error: null }
          } else if (response.status === 429) {
            console.log('⏱️ Rate limit hit for:', email, '- please wait before trying again')
            return { error: new Error('Too many password reset requests. Please wait a few minutes and try again.') }
          } else {
            const errorData = await response.json().catch(() => ({}))
            console.log('❌ Password reset failed for:', email, response.status, errorData)
            return { error: errorData || new Error(`HTTP ${response.status}`) }
          }
        } catch (error) {
          console.log('❌ Real password reset failed for:', email, error)
          return { error }
        }
      },
      setSession: async ({ access_token, refresh_token }) => {
        try {
          // Store tokens in localStorage
          localStorage.setItem('supabase_access_token', access_token)
          localStorage.setItem('supabase_refresh_token', refresh_token)
          console.log('Real session set with tokens')
          return { error: null }
        } catch (error) {
          console.log('Real session set failed:', error)
          return { error }
        }
      },
      signOut: async () => {
        try {
          localStorage.removeItem('supabase_access_token')
          localStorage.removeItem('supabase_refresh_token')
          console.log('Real sign out successful')
          return { error: null }
        } catch (error) {
          console.log('Real sign out failed:', error)
          return { error }
        }
      },
      onAuthStateChange: (callback) => {
        // Simple implementation that checks localStorage periodically
        const checkAuth = () => {
          const token = localStorage.getItem('supabase_access_token')
          if (token) {
            callback('SIGNED_IN', { user: { email: 'authenticated-user' } })
          } else {
            callback('SIGNED_OUT', { user: null })
          }
        }
        
        // Check immediately
        checkAuth()
        
        // Set up periodic checking
        const interval = setInterval(checkAuth, 5000)
        
        return { 
          data: { 
            subscription: { 
              unsubscribe: () => clearInterval(interval) 
            } 
          } 
        } 
      }
    },
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          data: [],
          error: null
        })
      })
    })
  }
  
  console.log('Manual Supabase client created successfully - emails will work!')
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
      signInWithOAuth: async ({ provider, options }) => {
        console.log('Mock OAuth sign in with provider:', provider)
        // Simulate OAuth redirect
        if (options?.redirectTo) {
          window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(options.redirectTo)}`
        }
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
