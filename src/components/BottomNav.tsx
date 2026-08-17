import type { ReactNode } from 'react'
import { NavLink, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLowStock } from '../lib/lowStock'

const allTabs = [
  { to: '/', label: 'Home', end: true, roles: ['Owner'] as const },
  { to: '/dno', label: 'DNO', end: false, roles: ['Owner'] as const },
  {
    to: '/stock',
    label: 'Stock',
    end: false,
    roles: ['Owner', 'Warehouse'] as const,
  },
  {
    to: '/orders',
    label: 'Orders',
    end: false,
    roles: ['Owner', 'Warehouse'] as const,
  },
  { to: '/bill', label: 'Bill', end: false, roles: ['Owner'] as const },
] as const

export function BottomNav() {
  const { role } = useAuth()
  const { count } = useLowStock()

  if (!role) return null

  const tabs = allTabs.filter((t) =>
    (t.roles as readonly string[]).includes(role),
  )

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(31,59,87,0.12)] bg-[rgba(250,246,239,0.94)] backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-1 py-1.5">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[0.7rem] font-medium transition-colors',
                isActive
                  ? 'text-turmeric animate-[tab-pop_180ms_ease-out]'
                  : 'text-muted',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'h-1 w-5 rounded-full transition-all',
                    isActive ? 'bg-turmeric' : 'bg-transparent',
                  ].join(' ')}
                />
                <span className={isActive ? 'font-semibold' : ''}>
                  {tab.label}
                </span>
                {tab.to === '/stock' && count > 0 ? (
                  <span
                    className="nav-low-dot"
                    aria-label={`${count} low stock items`}
                  />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function RoleGuard({
  allow,
  children,
  fallback = '/',
}: {
  allow: Array<'Owner' | 'Warehouse'>
  children: ReactNode
  fallback?: string
}) {
  const { role } = useAuth()
  if (!role || !allow.includes(role)) {
    return <Navigate to={fallback} replace />
  }
  return <>{children}</>
}
