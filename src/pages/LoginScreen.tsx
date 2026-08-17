import { useState } from 'react'
import { PinPad } from '../components/PinPad'
import { StripeBar } from '../components/StripeBar'
import { useAuth } from '../lib/auth'
import type { AppRole } from '../types'
import { APP_ROLES, errorMessage } from '../types'

export function LoginScreen() {
  const { loginWithPin } = useAuth()
  const [role, setRole] = useState<AppRole>('Owner')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function tryLogin(nextPin: string, nextRole: AppRole = role) {
    if (nextPin.length !== 4 || busy) return
    setBusy(true)
    setError(null)
    try {
      await loginWithPin(nextRole, nextPin)
    } catch (e) {
      setError(errorMessage(e, 'Login failed'))
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  function onPinChange(next: string) {
    setPin(next)
    setError(null)
    if (next.length === 4) void tryLogin(next)
  }

  return (
    <div className="login-screen">
      <div className="login-brand">
        <p className="login-wordmark">DHARI HOME</p>
        <div className="login-accent-line" />
        <p className="login-sub">Enter role PIN to continue</p>
      </div>

      <div className="role-chips" role="tablist" aria-label="Roles">
        {APP_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={role === r}
            className={role === r ? 'chip chip-active' : 'chip'}
            onClick={() => {
              setRole(r)
              setPin('')
              setError(null)
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <StripeBar className="my-4" />

      <PinPad value={pin} onChange={onPinChange} disabled={busy} />

      {busy ? (
        <p className="mt-3 text-center text-sm text-muted">Checking…</p>
      ) : null}
      {error ? <p className="err mt-3 text-center">{error}</p> : null}
    </div>
  )
}
