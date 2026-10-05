import { supabase } from '../lib/supabaseClient.ts'

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

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
