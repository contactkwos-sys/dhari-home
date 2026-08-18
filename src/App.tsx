import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppFooter } from './components/AppFooter'
import { AppHeader } from './components/AppHeader'
import { BottomNav, RoleGuard } from './components/BottomNav'
import { SideNav } from './components/SideNav'
import { AuthProvider, useAuth } from './lib/auth'
import { LowStockProvider } from './lib/lowStock'
import { BillPage } from './pages/BillPage'
import { DnoPage } from './pages/DnoPage'
import { HomePage } from './pages/HomePage'
import { LoginScreen } from './pages/LoginScreen'
import { OrdersPage } from './pages/OrdersPage'
import { SettingsPage } from './pages/SettingsPage'
import { StockPage } from './pages/StockPage'

function AppRoutes() {
  const { role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center text-sm text-muted">
        Loading…
      </div>
    )
  }

  if (!role) {
    return <LoginScreen />
  }

  const home = role === 'Warehouse' ? '/stock' : '/'

  return (
    <>
      <SideNav />
      <div className="app-main">
        <AppHeader />
        <Routes>
          <Route
            path="/"
            element={
              role === 'Warehouse' ? (
                <Navigate to="/stock" replace />
              ) : (
                <HomePage />
              )
            }
          />
          <Route
            path="/dno"
            element={
              <RoleGuard allow={['Owner']} fallback={home}>
                <DnoPage />
              </RoleGuard>
            }
          />
          <Route
            path="/stock"
            element={
              <RoleGuard allow={['Owner', 'Warehouse']} fallback={home}>
                <StockPage />
              </RoleGuard>
            }
          />
          <Route
            path="/orders"
            element={
              <RoleGuard allow={['Owner', 'Warehouse']} fallback={home}>
                <OrdersPage />
              </RoleGuard>
            }
          />
          <Route
            path="/bill"
            element={
              <RoleGuard allow={['Owner']} fallback={home}>
                <BillPage />
              </RoleGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <RoleGuard allow={['Owner']} fallback={home}>
                <SettingsPage />
              </RoleGuard>
            }
          />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
        <AppFooter />
        <BottomNav />
      </div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LowStockProvider>
          <div className="app-shell">
            <AppRoutes />
          </div>
        </LowStockProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
