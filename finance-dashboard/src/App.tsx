import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { RequireAuth } from './auth/RequireAuth.tsx'
import { Layout } from './components/Layout.tsx'
import { BudgetsPage } from './pages/BudgetsPage.tsx'
import { CategoriesPage } from './pages/CategoriesPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { ExpensesPage } from './pages/ExpensesPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'expenses', element: <ExpensesPage /> },
          { path: 'budgets', element: <BudgetsPage /> },
          { path: 'categories', element: <CategoriesPage /> },
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
