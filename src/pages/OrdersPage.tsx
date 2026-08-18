import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GatePassPanel } from '../components/GatePassPanel'
import { GatePassScanner } from '../components/GatePassScanner'
import { PageHeader } from '../components/PageHeader'
import { DnoPicker } from '../components/DnoPicker'
import {
  createOrder,
  fetchDnos,
  fetchOrders,
  formatMoney,
  getStockBalance,
  todayISO,
} from '../lib/api'
import { openWhatsAppPack, type PackDispatchPayload } from '../lib/whatsapp'
import type { DnoMaster, DnoSize, Order, PaymentStatus, Platform } from '../types'
import {
  INDIAN_STATES,
  PAYMENT_STATUSES,
  PLATFORMS,
  SIZES,
  errorMessage,
} from '../types'

export function OrdersPage() {
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [dnos, setDnos] = useState<DnoMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [packPrompt, setPackPrompt] = useState<PackDispatchPayload | null>(null)
  const [gatePassOrderId, setGatePassOrderId] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  useEffect(() => {
    if (search.get('add') === '1') setShowForm(true)
  }, [search])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [o, d] = await Promise.all([fetchOrders(), fetchDnos()])
      setOrders(o)
      setDnos(d)
    } catch (e) {
      setError(errorMessage(e, 'Failed to load orders'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function packPayloadFromOrder(o: Order): PackDispatchPayload {
    return {
      dnoNumber: o.dno_master?.dno_number ?? '—',
      size: o.size,
      pieces: o.pieces,
      platform: o.platform,
      platformOrderId: o.platform_order_id,
      buyerName: o.buyer_name,
      photoUrl: o.dno_master?.photo_url ?? null,
    }
  }

  function upsertOrder(updated: Order) {
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === updated.id)
      if (idx < 0) return [updated, ...prev]
      const next = [...prev]
      next[idx] = { ...prev[idx], ...updated }
      return next
    })
  }

  const gatePassOrder = useMemo(
    () => orders.find((o) => o.id === gatePassOrderId) ?? null,
    [orders, gatePassOrderId],
  )

  return (
    <div className="page">
      <PageHeader
        title="Orders"
        subtitle="Pick DN, WhatsApp pack, gate pass"
        action={
          <div className="flex flex-col items-end gap-1.5 sm:flex-row">
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() => {
                setShowScanner(true)
                setGatePassOrderId(null)
                setShowForm(false)
                setPackPrompt(null)
              }}
            >
              Scan Gate Pass
            </button>
            <button
              type="button"
              className="btn btn-primary text-sm"
              onClick={() => {
                setShowForm(true)
                setPackPrompt(null)
                setShowScanner(false)
                setGatePassOrderId(null)
                navigate('/orders?add=1')
              }}
            >
              Add order
            </button>
          </div>
        }
      />

      {error ? <p className="err mb-3 whitespace-pre-wrap">{error}</p> : null}
      {loading ? <p className="text-muted text-sm">Loading…</p> : null}

      {showScanner ? (
        <GatePassScanner
          onClose={() => setShowScanner(false)}
          onReceived={(updated) => {
            upsertOrder(updated)
          }}
        />
      ) : null}

      {gatePassOrder ? (
        <GatePassPanel
          order={gatePassOrder}
          onClose={() => setGatePassOrderId(null)}
          onIssued={(updated) => {
            upsertOrder(updated)
          }}
        />
      ) : null}

      {packPrompt ? (
        <PackDispatchBanner
          payload={packPrompt}
          onClose={() => setPackPrompt(null)}
        />
      ) : null}

      {showForm ? (
        <OrderForm
          dnos={dnos}
          onCancel={() => {
            setShowForm(false)
            setSearch({}, { replace: true })
          }}
          onSaved={async (payload) => {
            setShowForm(false)
            setSearch({}, { replace: true })
            setPackPrompt(payload)
            await load()
          }}
        />
      ) : null}

      <ul className="space-y-3">
        {orders.length === 0 && !loading ? (
          <li className="text-sm text-muted">No orders yet.</li>
        ) : (
          orders.map((o) => (
            <li key={o.id} className="panel panel-accent">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory-dark">
                  {o.dno_master?.photo_url ? (
                    <img
                      src={o.dno_master.photo_url}
                      alt={o.dno_master.dno_number}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[0.55rem] text-muted">
                      No photo
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
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
                      DN{' '}
                      <Link
                        to="/stock"
                        className="num font-medium text-indigo hover:underline"
                      >
                        {o.dno_master?.dno_number ?? '—'}
                      </Link>
                    </span>
                    <span>
                      Size <span className="font-medium">{o.size}</span>
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
                  {o.gate_pass_issued_at ? (
                    <p className="mt-1 text-xs text-muted">
                      Gate pass issued
                      {o.gate_pass_received_at
                        ? ' · received back ✓'
                        : ' · awaiting return'}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-accent !px-2.5 !py-1 text-xs"
                      onClick={() => openWhatsAppPack(packPayloadFromOrder(o))}
                    >
                      Send to packing on WhatsApp
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost !px-2.5 !py-1 text-xs"
                      onClick={() => {
                        setShowScanner(false)
                        setGatePassOrderId(o.id)
                        setPackPrompt(null)
                        setShowForm(false)
                      }}
                    >
                      Gate Pass
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

function PackDispatchBanner({
  payload,
  onClose,
}: {
  payload: PackDispatchPayload
  onClose: () => void
}) {
  return (
    <div className="panel panel-accent mb-4 border border-turmeric/40 bg-[#c98a2c]/10">
      <h2 className="font-display text-lg text-indigo">Issued to warehouse</h2>
      <p className="mt-1 text-sm text-muted">
        Stock deducted. Send packing details (with design photo link) to staff on
        WhatsApp / WhatsApp Business.
      </p>
      <p className="mt-2 num text-sm text-ink">
        {payload.dnoNumber} · {payload.size} · {payload.pieces} pcs ·{' '}
        {payload.platform}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary text-sm"
          onClick={() => openWhatsAppPack(payload)}
        >
          Send to packing on WhatsApp
        </button>
        <button type="button" className="btn btn-ghost text-sm" onClick={onClose}>
          Dismiss
        </button>
      </div>
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
  onSaved: (pack: PackDispatchPayload) => Promise<void>
}) {
  const [order_date, setOrderDate] = useState(todayISO())
  const [dno_id, setDnoId] = useState(dnos[0]?.id ?? '')
  const [size, setSize] = useState<DnoSize>('5ft x 4ft')
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

  const selected = useMemo(
    () => dnos.find((d) => d.id === dno_id) ?? null,
    [dnos, dno_id],
  )

  useEffect(() => {
    if (!dno_id || !size) {
      setAvailable(null)
      return
    }
    let cancelled = false
    void getStockBalance(dno_id, size)
      .then((bal) => {
        if (!cancelled) setAvailable(bal)
      })
      .catch(() => {
        if (!cancelled) setAvailable(null)
      })
    return () => {
      cancelled = true
    }
  }, [dno_id, size])

  const piecesNum = Number(pieces) || 0
  const blocked = useMemo(() => {
    if (available == null) return false
    return piecesNum > available
  }, [available, piecesNum])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (blocked) {
      setErr(
        `Only ${available} in stock for ${size} — cannot save ${piecesNum} pieces.`,
      )
      return
    }
    if (!selected) {
      setErr('Select a DN from the list.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await createOrder({
        order_date,
        dno_id,
        size,
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
      await onSaved({
        dnoNumber: selected.dno_number,
        size,
        pieces: piecesNum,
        platform,
        platformOrderId: platform_order_id.trim() || null,
        buyerName: buyer_name.trim() || null,
        photoUrl: selected.photo_url ?? null,
      })
    } catch (error) {
      setErr(errorMessage(error, 'Failed to create order'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="panel panel-accent mb-4 space-y-3">
      <h2 className="font-display text-lg text-indigo">Add order</h2>
      <p className="text-xs text-muted">
        Pick DN from the list, check warehouse stock, issue, then WhatsApp /
        WhatsApp Business to pack.
      </p>

      <DnoPicker
        id="ord_dno"
        label="DN number"
        dnos={dnos}
        value={dno_id}
        onChange={setDnoId}
        viewTo="/stock"
      />

      <div className="rounded-lg bg-indigo/5 px-3 py-2 text-sm">
        Stock for {size}:{' '}
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
        <div className="field">
          <label htmlFor="ord_size">Size</label>
          <select
            id="ord_size"
            required
            value={size}
            onChange={(e) => setSize(e.target.value as DnoSize)}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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

      {err ? <p className="err whitespace-pre-wrap">{err}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || blocked || !dno_id}
        >
          {busy ? 'Issuing…' : 'Issue & save'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
