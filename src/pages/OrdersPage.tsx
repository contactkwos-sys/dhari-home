import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import {
  createOrder,
  fetchDnos,
  fetchOrders,
  formatMoney,
  getStockBalance,
  todayISO,
} from '../lib/api'
import type { DnoMaster, Order, PaymentStatus, Platform } from '../types'
import { INDIAN_STATES, PAYMENT_STATUSES, PLATFORMS } from '../types'

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [dnos, setDnos] = useState<DnoMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [o, d] = await Promise.all([fetchOrders(), fetchDnos()])
      setOrders(o)
      setDnos(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="page">
      <PageHeader
        title="Orders"
        subtitle="Marketplace dispatch"
        action={
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => setShowForm(true)}
          >
            Add order
          </button>
        }
      />

      {error ? <p className="err mb-3">{error}</p> : null}
      {loading ? <p className="text-muted text-sm">Loading…</p> : null}

      {showForm ? (
        <OrderForm
          dnos={dnos}
          onCancel={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false)
            await load()
          }}
        />
      ) : null}

      <ul className="space-y-3">
        {orders.length === 0 && !loading ? (
          <li className="text-sm text-muted">No orders yet.</li>
        ) : (
          orders.map((o) => (
            <li key={o.id} className="panel">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-base text-indigo">
                    {o.platform}
                  </p>
                  <p className="num text-xs text-muted">
                    {o.platform_order_id || '—'} · {o.order_date}
                  </p>
                </div>
                <span className="rounded-md bg-ivory-dark px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-indigo">
                  {o.payment_status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>
                  DNO{' '}
                  <span className="num font-medium">
                    {o.dno_master?.dno_number ?? '—'}
                  </span>
                </span>
                <span>
                  Pcs <span className="num font-medium">{o.pieces}</span>
                </span>
                <span>
                  Rate{' '}
                  <span className="num font-medium">
                    {formatMoney(o.sale_rate)}
                  </span>
                </span>
              </div>
              {(o.buyer_name || o.buyer_state) && (
                <p className="mt-1 text-xs text-muted">
                  {[o.buyer_name, o.buyer_state].filter(Boolean).join(' · ')}
                </p>
              )}
              {(o.courier || o.awb_number) && (
                <p className="mt-0.5 text-xs text-muted">
                  {[o.courier, o.awb_number].filter(Boolean).join(' · ')}
                </p>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

function OrderForm({
  dnos,
  onCancel,
  onSaved,
}: {
  dnos: DnoMaster[]
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [order_date, setOrderDate] = useState(todayISO())
  const [dno_id, setDnoId] = useState(dnos[0]?.id ?? '')
  const [platform, setPlatform] = useState<Platform>('Flipkart')
  const [platform_order_id, setPlatformOrderId] = useState('')
  const [pieces, setPieces] = useState('1')
  const [sale_rate, setSaleRate] = useState('')
  const [buyer_name, setBuyerName] = useState('')
  const [buyer_state, setBuyerState] = useState('Gujarat')
  const [courier, setCourier] = useState('')
  const [awb_number, setAwb] = useState('')
  const [payment_status, setPaymentStatus] =
    useState<PaymentStatus>('Prepaid')
  const [invoice_no, setInvoiceNo] = useState('')
  const [available, setAvailable] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!dno_id) {
      setAvailable(null)
      return
    }
    let cancelled = false
    void getStockBalance(dno_id)
      .then((bal) => {
        if (!cancelled) setAvailable(bal)
      })
      .catch(() => {
        if (!cancelled) setAvailable(null)
      })
    return () => {
      cancelled = true
    }
  }, [dno_id])

  const piecesNum = Number(pieces) || 0
  const blocked = useMemo(() => {
    if (available == null) return false
    return piecesNum > available
  }, [available, piecesNum])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (blocked) {
      setErr(`Only ${available} in stock — cannot save ${piecesNum} pieces.`)
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await createOrder({
        order_date,
        dno_id,
        platform,
        platform_order_id: platform_order_id.trim() || null,
        pieces: piecesNum,
        sale_rate: Number(sale_rate),
        buyer_name: buyer_name.trim() || null,
        buyer_state: buyer_state.trim() || null,
        courier: courier.trim() || null,
        awb_number: awb_number.trim() || null,
        payment_status,
        invoice_no: invoice_no.trim() || null,
      })
      await onSaved()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="panel mb-4 space-y-3">
      <h2 className="font-display text-lg text-indigo">Add order</h2>

      <div className="rounded-lg bg-indigo/5 px-3 py-2 text-sm">
        Current stock:{' '}
        <span className="num font-semibold text-indigo">
          {available == null ? '…' : available}
        </span>
        {blocked ? (
          <span className="err ml-2">Not enough stock</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor="od">Order date</label>
          <input
            id="od"
            type="date"
            required
            value={order_date}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="plat">Platform</label>
          <select
            id="plat"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field col-span-2">
          <label htmlFor="ord_dno">DNO</label>
          <select
            id="ord_dno"
            required
            value={dno_id}
            onChange={(e) => setDnoId(e.target.value)}
          >
            {dnos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.dno_number} · {d.size}
              </option>
            ))}
          </select>
        </div>
        <div className="field col-span-2">
          <label htmlFor="poid">Platform order ID</label>
          <input
            id="poid"
            value={platform_order_id}
            onChange={(e) => setPlatformOrderId(e.target.value)}
            className="num"
          />
        </div>
        <div className="field">
          <label htmlFor="pcs">Pieces</label>
          <input
            id="pcs"
            type="number"
            min="1"
            step="1"
            required
            value={pieces}
            onChange={(e) => setPieces(e.target.value)}
            className="num"
          />
        </div>
        <div className="field">
          <label htmlFor="rate">Sale rate</label>
          <input
            id="rate"
            type="number"
            min="0"
            step="0.01"
            required
            value={sale_rate}
            onChange={(e) => setSaleRate(e.target.value)}
            className="num"
          />
        </div>
        <div className="field">
          <label htmlFor="buyer">Buyer name</label>
          <input
            id="buyer"
            value={buyer_name}
            onChange={(e) => setBuyerName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="state">Buyer state</label>
          <select
            id="state"
            value={buyer_state}
            onChange={(e) => setBuyerState(e.target.value)}
          >
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="courier">Courier</label>
          <input
            id="courier"
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="awb">AWB number</label>
          <input
            id="awb"
            value={awb_number}
            onChange={(e) => setAwb(e.target.value)}
            className="num"
          />
        </div>
        <div className="field">
          <label htmlFor="pay">Payment</label>
          <select
            id="pay"
            value={payment_status}
            onChange={(e) =>
              setPaymentStatus(e.target.value as PaymentStatus)
            }
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="inv">Invoice no</label>
          <input
            id="inv"
            value={invoice_no}
            onChange={(e) => setInvoiceNo(e.target.value)}
            className="num"
          />
        </div>
      </div>

      {err ? <p className="err">{err}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || blocked || !dno_id}
        >
          {busy ? 'Saving…' : 'Save order'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
