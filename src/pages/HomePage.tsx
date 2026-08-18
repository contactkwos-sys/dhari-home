import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { PageHeader } from '../components/PageHeader'
import { StripeBar } from '../components/StripeBar'
import {
  fetchDnos,
  fetchOrders,
  fetchStockMovements,
  fetchStockRows,
  formatMoney,
} from '../lib/api'
import {
  computeDashboardStats,
  enrichMovementsWithBalance,
  salesByMarketplace,
  sortLowStockWorstFirst,
  stockBySize,
  topSellingDesigns,
} from '../lib/dashboard'
import { useLowStock } from '../lib/lowStock'
import type { Order, StockMovement, StockRow } from '../types'
import { errorMessage } from '../types'
import type { DnoMaster } from '../types'

const SIZE_COLORS = ['#1f3b57', '#c98a2c', '#8b5a3c', '#2f6b4f']

export function HomePage() {
  const navigate = useNavigate()
  const { items: lowStockRaw, refresh: refreshLow } = useLowStock()
  const [dnos, setDnos] = useState<DnoMaster[]>([])
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [d, s, o, m] = await Promise.all([
          fetchDnos(),
          fetchStockRows(),
          fetchOrders(),
          fetchStockMovements(),
        ])
        if (cancelled) return
        setDnos(d)
        setStockRows(s)
        setOrders(o)
        setMovements(m)
        void refreshLow()
      } catch (e) {
        if (!cancelled) setError(errorMessage(e, 'Failed to load dashboard'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = useMemo(
    () => computeDashboardStats(dnos, stockRows, orders),
    [dnos, stockRows, orders],
  )
  const { slices, totalPcs } = useMemo(() => stockBySize(stockRows), [stockRows])
  const recentOrders = useMemo(() => orders.slice(0, 5), [orders])
  const recentMoves = useMemo(
    () => enrichMovementsWithBalance(movements).slice(0, 5),
    [movements],
  )
  const lowStock = useMemo(
    () => sortLowStockWorstFirst(lowStockRaw).slice(0, 8),
    [lowStockRaw],
  )
  const topSellers = useMemo(
    () => topSellingDesigns(dnos, orders, 5),
    [dnos, orders],
  )
  const platforms = useMemo(() => salesByMarketplace(orders), [orders])

  function openDno(id: string) {
    navigate(`/dno?id=${encodeURIComponent(id)}`)
  }

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle="Stock, orders & marketplace pulse"
      />
      <div className="mb-4 max-w-xs">
        <StripeBar />
      </div>

      {error ? <p className="err mb-3">{error}</p> : null}
      {loading ? <p className="text-muted text-sm mb-3">Loading…</p> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Stock Value"
          value={formatMoney(stats.totalStockValue)}
          to="/stock"
        />
        <StatCard
          label="Total Designs"
          value={String(stats.totalDesigns)}
          to="/dno"
        />
        <StatCard
          label="Pending Orders"
          value={String(stats.pendingOrders)}
          hint="COD Pending"
          to="/orders"
        />
        <StatCard
          label="This Month's Sales"
          value={formatMoney(stats.monthSales)}
          to="/orders"
        />
      </section>

      <section className="mt-4 flex flex-wrap gap-2">
        <Link to="/dno?add=1" className="btn btn-primary text-sm">
          Add design
        </Link>
        <Link to="/stock?add=1" className="btn btn-accent text-sm">
          Add Stock
        </Link>
        <Link to="/orders?add=1" className="btn btn-ghost text-sm">
          New Order
        </Link>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="panel panel-accent">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-lg text-indigo">Stock Summary</h2>
              <p className="text-xs text-muted">Balance split by size</p>
            </div>
            <Link to="/stock" className="text-xs font-medium text-turmeric">
              Warehouse →
            </Link>
          </div>
          <button
            type="button"
            className="mt-1 w-full text-left"
            onClick={() => navigate('/stock')}
            aria-label="Open warehouse stock"
          >
            {slices.length === 0 ? (
              <p className="mt-6 text-sm text-muted">No stock yet.</p>
            ) : (
              <div className="relative mx-auto mt-2 h-56 w-full max-w-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {slices.map((_, i) => (
                        <Cell
                          key={slices[i].name}
                          fill={SIZE_COLORS[i % SIZE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value} pcs`, 'Balance']}
                      contentStyle={{
                        borderRadius: 8,
                        borderColor: 'rgba(31,59,87,0.12)',
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="num text-2xl font-semibold text-indigo">
                    {totalPcs}
                  </p>
                  <p className="text-[0.65rem] uppercase tracking-wide text-muted">
                    total pcs
                  </p>
                </div>
              </div>
            )}
            <ul className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
              {slices.map((s, i) => (
                <li key={s.name} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: SIZE_COLORS[i % SIZE_COLORS.length] }}
                  />
                  <span className="text-muted">{s.name}</span>
                  <span className="num font-medium text-ink">{s.value}</span>
                </li>
              ))}
            </ul>
          </button>
        </section>

        <section className="panel panel-accent">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg text-indigo">Recent Orders</h2>
            <Link to="/orders" className="text-xs font-medium text-turmeric">
              View all →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {recentOrders.length === 0 ? (
              <li className="text-sm text-muted">No orders yet.</li>
            ) : (
              recentOrders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-ivory-dark/45 px-3 py-2 text-left"
                    onClick={() =>
                      o.dno_id ? openDno(o.dno_id) : navigate('/orders')
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-ivory-dark">
                        {o.dno_master?.photo_url ? (
                          <img
                            src={o.dno_master.photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[0.5rem] text-muted">
                            —
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-indigo">
                          {o.platform}
                        </p>
                        <p className="num truncate text-xs text-muted">
                          {o.dno_master?.dno_number ||
                            o.platform_order_id ||
                            o.id.slice(0, 8)}{' '}
                          · {o.order_date}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-white/80 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-indigo">
                      {o.payment_status}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="panel panel-accent">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg text-indigo">
              Recent Stock Movements
            </h2>
            <Link to="/stock" className="text-xs font-medium text-turmeric">
              Warehouse →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {recentMoves.length === 0 ? (
              <li className="text-sm text-muted">No movements yet.</li>
            ) : (
              recentMoves.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-ivory-dark/45 px-3 py-2 text-left"
                    onClick={() => openDno(m.dno_id)}
                  >
                    <div className="min-w-0">
                      <p className="num text-sm font-medium text-indigo">
                        {m.dno_master?.dno_number ?? m.dno_id.slice(0, 8)} ·{' '}
                        {m.size}
                      </p>
                      <p className="text-xs text-muted">
                        {m.date} · {m.type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={[
                          'num text-sm font-semibold',
                          m.type === 'IN' ? 'text-[#2f6b4f]' : 'text-[#9b2c2c]',
                        ].join(' ')}
                      >
                        {m.type === 'IN' ? '+' : '−'}
                        {m.qty}
                      </p>
                      <p className="text-[0.65rem] text-muted">
                        bal {m.balance_after}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="panel panel-accent">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg text-indigo">Low Stock Alerts</h2>
            <Link
              to="/stock?low=1"
              className="text-xs font-medium text-turmeric"
            >
              View All →
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-muted">All sizes above threshold.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {lowStock.map((item) => (
                <li key={`${item.dno.id}-${item.size}`}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-ivory-dark/45 px-3 py-2 text-left"
                    onClick={() => openDno(item.dno.id)}
                  >
                    <div className="min-w-0">
                      <p className="num font-medium text-[#9b2c2c]">
                        {item.dno.dno_number}
                      </p>
                      <p className="truncate text-xs text-muted">{item.size}</p>
                    </div>
                    <span className="badge-stock badge-stock-critical">
                      {item.balance} / {item.threshold}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel panel-accent">
          <h2 className="font-display text-lg text-indigo">
            Top Selling Designs
          </h2>
          <ul className="mt-3 space-y-2">
            {topSellers.length === 0 ? (
              <li className="text-sm text-muted">No sales yet.</li>
            ) : (
              topSellers.map((t) => (
                <li key={t.dno.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg bg-ivory-dark/45 px-2 py-2 text-left"
                    onClick={() => openDno(t.dno.id)}
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-ivory-dark">
                      {t.dno.photo_url ? (
                        <img
                          src={t.dno.photo_url}
                          alt={t.dno.dno_number}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[0.55rem] text-muted">
                          No photo
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="num font-medium text-indigo">
                        {t.dno.dno_number}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {t.dno.category || '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-sm font-semibold text-indigo">
                        {t.qtySold} pcs
                      </p>
                      <p className="num text-xs text-muted">
                        {formatMoney(t.revenue)}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="panel panel-accent">
          <h2 className="font-display text-lg text-indigo">
            Sales by Marketplace
          </h2>
          <ul className="mt-3 space-y-3">
            {platforms.length === 0 ? (
              <li className="text-sm text-muted">No marketplace sales yet.</li>
            ) : (
              platforms.map((p) => (
                <li key={p.platform}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-indigo">{p.platform}</span>
                    <span className="num text-muted">
                      {formatMoney(p.amount)} · {p.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ivory-dark">
                    <div
                      className="h-full rounded-full bg-turmeric transition-[width] duration-500"
                      style={{ width: `${Math.max(p.pct, 2)}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  to,
}: {
  label: string
  value: string
  hint?: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="panel panel-accent !px-3 !py-3 animate-[rise-in_360ms_ease-out] block"
    >
      <p className="text-[0.65rem] uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="num mt-1 text-lg font-semibold text-indigo lg:text-xl">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[0.65rem] text-muted">{hint}</p> : null}
    </Link>
  )
}
