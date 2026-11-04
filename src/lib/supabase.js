import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log first few chars to help diagnose without exposing secrets
console.log('[Sown] VITE_SUPABASE_URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING')
console.log('[Sown] VITE_SUPABASE_ANON_KEY:', supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'MISSING')

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.')
}

// ── Auth links (password reset, magic link, email confirmation) ──────────────
// Read the link before createClient runs: the client clears the tokens from
// the address bar once it has used them, and only tells listeners that
// already exist that it was a password recovery link. Anything that
// subscribes later never hears about it, so we keep our own record here.
const hashParams = new URLSearchParams(window.location.hash.slice(1))
export const authLinkOnLoad = {
  // e.g. #access_token=…&type=recovery
  recovery: hashParams.get('type') === 'recovery',
  // e.g. #error=access_denied&error_code=otp_expired&error_description=…
  error: hashParams.get('error_description') || hashParams.get('error') || null,
}

export const supabase = createClient(supabaseUrl, supabaseKey)
