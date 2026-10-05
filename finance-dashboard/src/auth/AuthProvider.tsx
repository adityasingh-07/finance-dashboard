import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient.ts'
import { AuthContext, type AuthState } from './AuthContext.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    // Fires INITIAL_SESSION immediately with any stored session, then on every
    // sign-in, sign-out and token refresh.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Drop the previous user's cached rows so the next user never sees them.
        queryClient.clear()
      }
      setState({ session, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
