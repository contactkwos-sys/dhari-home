import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLowStock } from '../lib/lowStock'
import { tabsForRole } from '../lib/nav'
import { StripeBar } from './StripeBar'

export function SideNav() {
  const { role } = useAuth()
  const { count } = useLowStock()

  if (!role) return null

  const tabs = tabsForRole(role)

  return (
    <aside className="side-nav hidden lg:flex">
      <div className="side-nav-brand">
        <p className="app-wordmark !text-[0.95rem] tracking-[0.1em]">DHARI HOME</p>
        <div className="mt-3">
          <StripeBar />
        </div>
        <p className="mt-3 text-xs text-ivory/70">{role}</p>
      </div>
      <nav className="side-nav-links" aria-label="Main">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                'side-nav-link',
                isActive ? 'side-nav-link-active' : '',
              ].join(' ')
            }
          >
            <span>{tab.label}</span>
            {tab.to === '/stock' && count > 0 ? (
              <span className="badge-alert ml-auto">{count}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
