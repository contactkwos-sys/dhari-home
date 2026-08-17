import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import {
  addStockIn,
  fetchDnos,
  fetchStockMovements,
  fetchStockRows,
  todayISO,
} from '../lib/api'
import type { DnoMaster, DnoSize, StockMovement, StockRow } from '../types'
import { SIZES, errorMessage } from '../types'

export function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [ledger, setLedger] = useState<StockMovement[]>([])
  const [dnos, setDnos] = useState<DnoMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [stock, movements, allDnos] = await Promise.all([
        fetchStockRows(),
        fetchStockMovements(),
        fetchDnos(),
      ])
      setRows(stock)
      setLedger(movements)
      setDnos(allDnos)
    } catch (e) {
      setError(errorMessage(e, 'Failed to load stock'))
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
        title="Warehouse"
        subtitle="Balances per DNO + size"
        action={
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => setShowForm(true)}
          >
            Add stock
          </button>
        }
      />

      {error ? <p className="err mb-3">{error}</p> : null}
      {loading ? <p className="text-muted text-sm">Loading…</p> : null}

      {showForm ? (
        <AddStockForm
          dnos={dnos}
          onCancel={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false)
            await load()
          }}
        />
      ) : null}

      <section>
        <h2 className="mb-2 font-display text-base text-indigo">Balances</h2>
        <div className="overflow-hidden rounded-xl border border-[rgba(31,59,87,0.1)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-indigo text-ivory">
              <tr>
                <th className="px-3 py-2 font-medium">DNO / Size</th>
                <th className="px-2 py-2 text-right font-medium">In</th>
                <th className="px-2 py-2 text-right font-medium">Out</th>
                <th className="px-3 py-2 text-right font-medium">Bal</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-muted">
                    No stock yet — use Add stock.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={`${r.dno.id}-${r.size}`}
                    className={i % 2 === 0 ? 'bg-white/60' : 'bg-ivory-dark/40'}
                  >
                    <td className="px-3 py-2">
                      <div className="num font-medium text-indigo">
                        {r.dno.dno_number}
                      </div>
                      <div className="text-xs text-muted">{r.size}</div>
                    </td>
                    <td className="num px-2 py-2 text-right text-muted">
                      {r.inbound}
                    </td>
                    <td className="num px-2 py-2 text-right text-muted">
                      {r.outbound}
                    </td>
                    <td className="num px-3 py-2 text-right font-semibold text-indigo">
                      {r.balance}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-display text-base text-indigo">
          Movement ledger
        </h2>
        <ul className="space-y-2">
          {ledger.length === 0 ? (
            <li className="text-sm text-muted">No movements yet.</li>
          ) : (
            ledger.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[rgba(31,59,87,0.08)] bg-white/50 px-3 py-2"
              >
                <div>
                  <p className="num text-sm font-medium text-indigo">
                    {m.dno_master?.dno_number ?? m.dno_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted">
                    {m.size} · {m.date}
                    {m.note ? ` · ${m.note}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={[
                      'num text-sm font-semibold',
                      m.type === 'IN' ? 'text-[#2f6b4f]' : 'text-[#9b2c2c]',
                    ].join(' ')}
                  >
                    {m.type === 'IN' ? '+' : '−'}
                    {m.qty}
                  </span>
                  <p className="text-[0.65rem] uppercase tracking-wide text-muted">
                    {m.type}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}

function AddStockForm({
  dnos,
  onCancel,
  onSaved,
}: {
  dnos: DnoMaster[]
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [dno_id, setDnoId] = useState(dnos[0]?.id ?? '')
  const [size, setSize] = useState<DnoSize>('5ft x 4ft')
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await addStockIn({
        dno_id,
        size,
        qty: Number(qty),
        date: todayISO(),
        note: 'Purchase / receipt',
      })
      await onSaved()
    } catch (error) {
      setErr(errorMessage(error, 'Failed to save'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="panel mb-4 space-y-3">
      <h2 className="font-display text-lg text-indigo">Add stock</h2>
      <p className="text-xs text-muted">
        Adds an IN movement — balances accumulate per DNO + size.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="field col-span-2">
          <label htmlFor="mv_dno">DNO</label>
          <select
            id="mv_dno"
            required
            value={dno_id}
            onChange={(e) => setDnoId(e.target.value)}
          >
            {dnos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.dno_number}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mv_size">Size</label>
          <select
            id="mv_size"
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
          <label htmlFor="mv_qty">Quantity</label>
          <input
            id="mv_qty"
            type="number"
            min="1"
            step="1"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="num"
          />
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
