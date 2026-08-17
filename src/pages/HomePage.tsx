import { Link } from 'react-router-dom'
import { StripeBar } from '../components/StripeBar'
import { useLowStock } from '../lib/lowStock'

const tiles = [
  {
    to: '/dno',
    title: 'DNO Master',
    copy: 'Photos, categories & rates for each design.',
  },
  {
    to: '/stock',
    title: 'Warehouse',
    copy: 'Balances per DNO + size with live ledger.',
  },
  {
    to: '/orders',
    title: 'Orders',
    copy: 'Dispatch from Flipkart, Amazon & more.',
  },
  {
    to: '/bill',
    title: 'GST Invoice',
    copy: 'CGST+SGST for Gujarat, IGST elsewhere.',
  },
]

export function HomePage() {
  const { items } = useLowStock()

  return (
    <div className="page">
      <section className="hero-panel">
        <p className="hero-brand">DHARI Home</p>
        <p className="hero-copy">
          Inventory & dispatch for home textiles across marketplaces.
        </p>
        <div className="relative mt-5">
          <StripeBar />
        </div>
        <div className="relative mt-5 flex gap-2">
          <Link to="/orders" className="btn btn-accent text-sm">
            New order
          </Link>
          <Link to="/stock" className="btn btn-on-dark text-sm">
            Check stock
          </Link>
        </div>
      </section>

      {items.length > 0 ? (
        <section className="panel panel-accent mt-5 animate-[rise-in_360ms_ease-out]">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-indigo">
              Low Stock
            </h2>
            <span className="badge-alert">{items.length}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            At or below threshold — restock soon.
          </p>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li
                key={`${item.dno.id}-${item.size}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-ivory-dark/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="num font-medium text-indigo">
                    {item.dno.dno_number}
                  </p>
                  <p className="truncate text-xs text-muted">{item.size}</p>
                </div>
                <span
                  className={[
                    'badge-stock',
                    item.balance <= 0 ? 'badge-stock-critical' : 'badge-stock-warn',
                  ].join(' ')}
                >
                  {item.balance} / {item.threshold}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 space-y-3">
        {tiles.map((tile, i) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="panel panel-accent block animate-[rise-in_360ms_ease-out_both] transition hover:bg-white"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-indigo">
                {tile.title}
              </h2>
              <span className="text-sm text-turmeric">Open →</span>
            </div>
            <p className="mt-1 text-sm text-muted">{tile.copy}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
