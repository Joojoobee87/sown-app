import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log first few chars to help diagnose without exposing secrets
console.log('[Sown] VITE_SUPABASE_URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING')
console.log('[Sown] VITE_SUPABASE_ANON_KEY:', supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'MISSING')

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
