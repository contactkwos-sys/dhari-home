import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function AppHeader() {
  const { role, isOwner, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div>
          <p className="app-wordmark">DHARI HOME</p>
          <div className="app-header-accent" />
        </div>
        <div className="relative">
          <button
            type="button"
            className="header-menu-btn"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen((v) => !v)}
          >
            {role ?? 'Menu'}
          </button>
          {open ? (
            <div className="header-menu" role="menu">
              {isOwner ? (
                <Link
                  to="/settings"
                  role="menuitem"
                  className="header-menu-item"
                  onClick={() => setOpen(false)}
                >
                  Settings
                </Link>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="header-menu-item"
                onClick={() => {
                  setOpen(false)
                  void logout()
                }}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
