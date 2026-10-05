import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, type Location } from 'react-router'
import { useAuth } from '../auth/AuthContext.ts'
import { signIn, signUp } from '../auth/authActions.ts'
import { friendlyError } from '../lib/dbErrors.ts'

type Mode = 'sign-in' | 'sign-up'

// Matches supabase/seed.sql; only offered in local development.
const DEMO = { email: 'demo@example.com', password: 'demo-password-123' }

export function LoginPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = (location.state as { from?: Location } | null)?.from
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/'} replace />
  }

  async function submit(creds: { email: string; password: string }) {
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      if (mode === 'sign-in') {
        await signIn(creds.email, creds.password)
      } else if (await signUp(creds.email, creds.password)) {
        setNotice('Check your email for a confirmation link, then sign in.')
        setMode('sign-in')
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submit({ email, password })
  }

  const isSignIn = mode === 'sign-in'

  return (
    <main className="auth-page">
      <div className="card auth-card">
        <h1>Finance Dashboard</h1>
        <p className="muted">
          {isSignIn ? 'Sign in to track your spending.' : 'Create an account to get started.'}
        </p>

        <form onSubmit={onSubmit} className="stack">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-notice" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Please wait…' : isSignIn ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {import.meta.env.DEV && isSignIn && (
          <button
            type="button"
            className="btn btn-ghost auth-demo"
            disabled={submitting}
            onClick={() => void submit(DEMO)}
          >
            Use demo account
          </button>
        )}

        <p className="auth-switch muted">
          {isSignIn ? 'New here?' : 'Already have an account?'}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(isSignIn ? 'sign-up' : 'sign-in')
              setError(null)
            }}
          >
            {isSignIn ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  )
}
