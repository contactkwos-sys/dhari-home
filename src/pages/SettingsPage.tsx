import { useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { resetRolePin } from '../lib/api'
import {
  DEFAULT_STAFF_WHATSAPP_E164,
  staffSupportWhatsAppDisplay,
  staffSupportWhatsAppHref,
} from '../lib/support'
import {
  getWarehouseWhatsAppPhone,
  setWarehouseWhatsAppPhone,
} from '../lib/whatsapp'
import type { AppRole } from '../types'
import { APP_ROLES, errorMessage } from '../types'

export function SettingsPage() {
  const [role, setRole] = useState<AppRole>('Owner')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [waPhone, setWaPhone] = useState(() => getWarehouseWhatsAppPhone())
  const [waOk, setWaOk] = useState<string | null>(null)
  const [waErr, setWaErr] = useState<string | null>(null)

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

  function saveWhatsApp(e: FormEvent) {
    e.preventDefault()
    setWaOk(null)
    setWaErr(null)
    const digits = waPhone.replace(/\D/g, '')
    if (digits && digits.length < 10) {
      setWaErr('Include country code, e.g. 919825063208')
      return
    }
    setWarehouseWhatsAppPhone(digits || DEFAULT_STAFF_WHATSAPP_E164)
    setWaPhone(digits || DEFAULT_STAFF_WHATSAPP_E164)
    setWaOk(
      digits
        ? 'Warehouse WhatsApp number saved on this device'
        : `Reset to default packing number (${DEFAULT_STAFF_WHATSAPP_E164})`,
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        subtitle="Owner-only PIN & dispatch"
      />

      <form onSubmit={saveWhatsApp} className="panel panel-accent mb-4 space-y-3">
        <h2 className="font-display text-lg text-indigo">
          Warehouse WhatsApp
        </h2>
        <p className="text-sm text-muted">
          Pre-filled with the packing staff number. After issuing an order,
          “Send to packing on WhatsApp” opens WhatsApp / WhatsApp Business with
          design number, size, pieces, platform, and a DN photo link. Change
          this if packing uses a different phone.
        </p>
        <div className="field">
          <label htmlFor="wa_phone">Phone (with country code)</label>
          <input
            id="wa_phone"
            inputMode="tel"
            value={waPhone}
            onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, ''))}
            placeholder={DEFAULT_STAFF_WHATSAPP_E164}
            className="num"
          />
        </div>
        {waErr ? <p className="err">{waErr}</p> : null}
        {waOk ? <p className="ok">{waOk}</p> : null}
        <button type="submit" className="btn btn-primary">
          Save WhatsApp number
        </button>
      </form>

      <form onSubmit={submit} className="panel panel-accent space-y-3">
        <h2 className="font-display text-lg text-indigo">Role PINs</h2>
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

      <section className="panel mt-4 space-y-1.5">
        <h2 className="font-display text-lg text-indigo">About</h2>
        <p className="text-sm text-muted">
          Built by KWOS — Powered by Kumaresh Budhia · For any help, WhatsApp:{' '}
          <a
            href={staffSupportWhatsAppHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="num text-indigo underline-offset-2 hover:underline"
          >
            {staffSupportWhatsAppDisplay()}
          </a>
        </p>
      </section>
    </div>
  )
}
