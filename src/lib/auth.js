// Auth helpers. UI components import these instead of touching the SDK directly.

import { supabase } from './supabase.js'

// Magic-link sign-in. Supabase emails a one-tap link back to the current origin.
export async function signInWithEmail(email) {
  const emailRedirectTo = window.location.origin + window.location.pathname
  return supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo },
  })
}

// Google OAuth. Requires the provider to be enabled in Supabase auth settings,
// and the current origin to be on the allowed-redirects list.
export async function signInWithGoogle() {
  const redirectTo = window.location.origin + window.location.pathname
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}
