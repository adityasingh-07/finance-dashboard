import { supabase } from '../lib/supabaseClient.ts'

// Sign-out lives in AuthProvider (useAuth().signOut) so it can report errors
// after the signed-in pages have unmounted.

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** Returns true if the user must confirm their email before signing in. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data.session === null
}
