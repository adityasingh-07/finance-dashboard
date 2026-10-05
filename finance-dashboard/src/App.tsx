import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { RequireAuth } from './auth/RequireAuth.tsx'
import { Layout } from './components/Layout.tsx'

// Each page is its own chunk, so the first load only downloads the page in
// view (Chart.js is split further, inside the dashboard).
const LoginPage = lazy(() => import('./pages/LoginPage.tsx').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage.tsx').then((m) => ({ default: m.DashboardPage })),
)
const ExpensesPage = lazy(() => import('./pages/ExpensesPage.tsx').then((m) => ({ default: m.ExpensesPage })))
const BudgetsPage = lazy(() => import('./pages/BudgetsPage.tsx').then((m) => ({ default: m.BudgetsPage })))
const CategoriesPage = lazy(() =>
  import('./pages/CategoriesPage.tsx').then((m) => ({ default: m.CategoriesPage })),
)

function Page({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="page-loading" role="status">
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

const router = createBrowserRouter([
  { path: '/login', element: <Page><LoginPage /></Page> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Page><DashboardPage /></Page> },
          { path: 'expenses', element: <Page><ExpensesPage /></Page> },
          { path: 'budgets', element: <Page><BudgetsPage /></Page> },
          { path: 'categories', element: <Page><CategoriesPage /></Page> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
