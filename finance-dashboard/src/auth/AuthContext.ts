import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthState = {
  session: Session | null
  /** True until Supabase has restored (or ruled out) a stored session. */
  loading: boolean
  /**
   * Set when the last sign-out ended the session on this device but couldn't
   * reach the server. Lives here rather than in the page that called signOut,
   * because that page unmounts as soon as the local session is cleared.
   */
  signOutError: string | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
