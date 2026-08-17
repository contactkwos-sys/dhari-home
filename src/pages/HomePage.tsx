import { Link } from 'react-router-dom'
import { StripeBar } from '../components/StripeBar'

const tiles = [
  {
    to: '/dno',
    title: 'DNO Master',
    copy: 'Photos, manufacturer & rates for each design.',
  },
  {
    to: '/stock',
    title: 'Warehouse',
    copy: 'In / Out ledger with live balances.',
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
  return (
    <div className="page">
      <section className="relative overflow-hidden rounded-2xl bg-indigo px-5 pb-6 pt-8 text-ivory">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 85% 15%, rgba(201,138,44,0.55), transparent 40%), linear-gradient(160deg, transparent 40%, rgba(0,0,0,0.18))',
          }}
        />
        <p
          className="relative font-display text-4xl font-semibold tracking-tight animate-[fade-soft_500ms_ease-out]"
          style={{ animationDelay: '40ms' }}
        >
          DHARI Home
        </p>
        <p className="relative mt-2 max-w-[16rem] text-sm leading-relaxed text-ivory/85">
          Inventory & dispatch for home textiles across marketplaces.
        </p>
        <div className="relative mt-5">
          <StripeBar />
        </div>
        <div className="relative mt-5 flex gap-2">
          <Link to="/orders" className="btn btn-accent text-sm">
            New order
          </Link>
          <Link
            to="/stock"
            className="btn text-sm text-ivory"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            Check stock
          </Link>
        </div>
      </section>

      <div className="mt-6 space-y-3">
        {tiles.map((tile, i) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="block animate-[rise-in_360ms_ease-out_both] rounded-xl border border-[rgba(31,59,87,0.1)] bg-white/50 px-4 py-3.5 transition hover:bg-white/80"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-indigo">
                {tile.title}
              </h2>
              <span className="text-turmeric text-sm">Open →</span>
            </div>
            <p className="mt-1 text-sm text-muted">{tile.copy}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
