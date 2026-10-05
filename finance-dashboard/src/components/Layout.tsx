import { NavLink, Outlet, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthContext.ts'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/expenses', label: 'Expenses', end: false },
  { to: '/budgets', label: 'Budgets', end: false },
  { to: '/categories', label: 'Categories', end: false },
]

export function Layout() {
  const { session, signOut } = useAuth()
  const [params] = useSearchParams()

  // Keep the selected month when moving between pages.
  const month = params.get('month')
  const search = month ? `?month=${month}` : ''

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="app-title">Finance</span>
          <nav aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={`${item.to}${search}`} end={item.end}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="app-user">
            <span className="muted app-email">{session?.user.email}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
