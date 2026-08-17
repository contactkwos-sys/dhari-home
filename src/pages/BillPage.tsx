import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StripeBar } from '../components/StripeBar'
import { fetchOrders, formatMoney } from '../lib/api'
import type { Order } from '../types'
import { errorMessage } from '../types'

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function BillPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchOrders()
        setOrders(data)
        if (data[0]) setOrderId(data[0].id)
      } catch (e) {
        setError(errorMessage(e, 'Failed to load orders'))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const order = orders.find((o) => o.id === orderId) ?? null

  const invoice = useMemo(() => {
    if (!order) return null
    const taxable = round2(order.pieces * Number(order.sale_rate))
    const gstRate = Number(order.dno_master?.gst_rate ?? 12)
    const isGujarat =
      (order.buyer_state || '').trim().toLowerCase() === 'gujarat'
    const taxAmount = round2((taxable * gstRate) / 100)
    const half = round2(taxAmount / 2)
    const total = round2(taxable + taxAmount)
    return {
      taxable,
      gstRate,
      isGujarat,
      cgst: isGujarat ? half : 0,
      sgst: isGujarat ? half : 0,
      igst: isGujarat ? 0 : taxAmount,
      total,
      hsn: order.dno_master?.hsn_code || '—',
    }
  }, [order])

  return (
    <div className="page">
      <PageHeader
        title="GST Invoice"
        subtitle="Tax invoice from an order"
      />

      {error ? <p className="err mb-3">{error}</p> : null}
      {loading ? <p className="text-muted text-sm">Loading…</p> : null}

      <div className="field mb-4">
        <label htmlFor="bill_order">Pick order</label>
        <select
          id="bill_order"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          disabled={!orders.length}
        >
          {orders.length === 0 ? (
            <option value="">No orders</option>
          ) : (
            orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.order_date} · {o.platform} ·{' '}
                {o.dno_master?.dno_number ?? 'DNO'} · {o.size} · {o.pieces} pcs
              </option>
            ))
          )}
        </select>
      </div>

      {order && invoice ? (
        <article className="animate-[rise-in_300ms_ease-out] overflow-hidden rounded-2xl border border-[rgba(31,59,87,0.12)] bg-white/80 shadow-sm">
          <div className="bg-indigo px-4 py-4 text-ivory">
            <p className="font-display text-2xl font-semibold tracking-tight">
              DHARI Home
            </p>
            <p className="mt-0.5 text-xs text-ivory/75">Tax Invoice</p>
            <div className="mt-3">
              <StripeBar />
            </div>
          </div>

          <div className="space-y-4 px-4 py-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted">
                  Invoice
                </p>
                <p className="num font-medium">
                  {order.invoice_no || order.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted">
                  Date
                </p>
                <p className="num font-medium">{order.order_date}</p>
              </div>
              <div>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted">
                  Buyer
                </p>
                <p className="font-medium">{order.buyer_name || '—'}</p>
                <p className="text-muted">{order.buyer_state || '—'}</p>
              </div>
              <div>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted">
                  Platform
                </p>
                <p className="font-medium">{order.platform}</p>
                <p className="num text-xs text-muted">
                  {order.platform_order_id || '—'}
                </p>
              </div>
            </div>

            <StripeBar />

            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[rgba(31,59,87,0.12)] text-[0.65rem] uppercase tracking-wide text-muted">
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Rate</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 align-top">
                    <p className="num font-medium text-indigo">
                      {order.dno_master?.dno_number}
                    </p>
                    <p className="text-xs text-muted">
                      {order.size}
                      {order.dno_master?.category
                        ? ` · ${order.dno_master.category}`
                        : ''}
                    </p>
                    <p className="num text-xs text-muted">
                      HSN {invoice.hsn}
                    </p>
                  </td>
                  <td className="num py-2 text-right align-top">
                    {order.pieces}
                  </td>
                  <td className="num py-2 text-right align-top">
                    {formatMoney(order.sale_rate)}
                  </td>
                  <td className="num py-2 text-right align-top font-medium">
                    {formatMoney(invoice.taxable)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="space-y-1 border-t border-[rgba(31,59,87,0.12)] pt-3">
              <Row label="Taxable value" value={formatMoney(invoice.taxable)} />
              {invoice.isGujarat ? (
                <>
                  <Row
                    label={`CGST @ ${invoice.gstRate / 2}%`}
                    value={formatMoney(invoice.cgst)}
                  />
                  <Row
                    label={`SGST @ ${invoice.gstRate / 2}%`}
                    value={formatMoney(invoice.sgst)}
                  />
                </>
              ) : (
                <Row
                  label={`IGST @ ${invoice.gstRate}%`}
                  value={formatMoney(invoice.igst)}
                />
              )}
              <div className="flex items-center justify-between pt-2 font-display text-lg text-indigo">
                <span>Total</span>
                <span className="num font-semibold">
                  {formatMoney(invoice.total)}
                </span>
              </div>
              <p className="pt-1 text-xs text-muted">
                {invoice.isGujarat
                  ? 'Intra-state supply (Gujarat) — CGST + SGST'
                  : 'Inter-state supply — IGST'}
              </p>
            </div>
          </div>
        </article>
      ) : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}
