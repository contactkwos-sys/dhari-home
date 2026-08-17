import { useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { resetRolePin } from '../lib/api'
import type { AppRole } from '../types'
import { APP_ROLES, errorMessage } from '../types'

export function SettingsPage() {
  const [role, setRole] = useState<AppRole>('Owner')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setOk(null)
    if (!/^\d{4}$/.test(pin)) {
      setErr('PIN must be exactly 4 digits')
      return
    }
    if (pin !== confirm) {
      setErr('PINs do not match')
      return
    }
    setBusy(true)
    try {
      await resetRolePin(role, pin)
      setOk(`${role} PIN updated`)
      setPin('')
      setConfirm('')
    } catch (error) {
      setErr(errorMessage(error, 'Failed to update PIN'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        subtitle="Owner-only PIN management"
      />

      <form onSubmit={submit} className="panel panel-accent space-y-3">
        <p className="text-sm text-muted">
          Change the 4-digit PIN for Owner or Warehouse. PINs are verified
          server-side and never stored in the app.
        </p>
        <div className="field">
          <label htmlFor="set_role">Role</label>
          <select
            id="set_role"
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
          >
            {APP_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="set_pin">New PIN</label>
          <input
            id="set_pin"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="num"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="set_confirm">Confirm PIN</label>
          <input
            id="set_confirm"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={confirm}
            onChange={(e) =>
              setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            className="num"
            required
          />
        </div>
        {err ? <p className="err">{err}</p> : null}
        {ok ? <p className="ok">{ok}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Update PIN'}
        </button>
      </form>
    </div>
  )
}
