import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Home', end: true },
  { to: '/dno', label: 'DNO', end: false },
  { to: '/stock', label: 'Stock', end: false },
  { to: '/orders', label: 'Orders', end: false },
  { to: '/bill', label: 'Bill', end: false },
] as const

export function BottomNav() {
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
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[0.7rem] font-medium transition-colors',
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
                <span className={isActive ? 'font-semibold' : ''}>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
