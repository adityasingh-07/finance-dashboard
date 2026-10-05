import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext.ts'

/** Route guard: renders child routes only for signed-in users. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page-loading" role="status">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
