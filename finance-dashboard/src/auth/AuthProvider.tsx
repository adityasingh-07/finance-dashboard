import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient.ts'
import { AuthContext, type AuthState } from './AuthContext.ts'

const SIGN_OUT_FAILED =
  "You're signed out on this device, but we couldn't reach the server to end the session everywhere. Sign in and out again when you're back online."

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  useEffect(() => {
    // Fires INITIAL_SESSION immediately with any stored session, then on every
    // sign-in, sign-out and token refresh.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT') {
        // Drop the previous user's cached rows so the next user never sees them.
        queryClient.clear()
      }
      if (event === 'SIGNED_IN') setSignOutError(null)
      setSession(next)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const signOut = useCallback(async () => {
    setSignOutError(null)
    // supabase-js clears the local session (firing SIGNED_OUT) even when the
    // server call fails, and reports that failure as a returned error.
    try {
      const { error } = await supabase.auth.signOut()
      if (error) setSignOutError(SIGN_OUT_FAILED)
    } catch {
      setSignOutError(SIGN_OUT_FAILED)
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ session, loading, signOutError, signOut }),
    [session, loading, signOutError, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
