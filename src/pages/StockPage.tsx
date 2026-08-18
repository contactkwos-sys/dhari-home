import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import {
  addStockIn,
  deleteStockMovement,
  fetchDnos,
  fetchStockMovements,
  fetchStockRows,
  todayISO,
  updateStockMovement,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLowStock } from '../lib/lowStock'
import type { DnoMaster, DnoSize, MovementType, StockMovement, StockRow } from '../types'
import { SIZES, errorMessage } from '../types'

export function StockPage() {
  const { isOwner } = useAuth()
  const { refresh: refreshLowStock } = useLowStock()
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState<StockRow[]>([])
  const [ledger, setLedger] = useState<StockMovement[]>([])
  const [dnos, setDnos] = useState<DnoMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StockMovement | null>(null)
  const lowOnly = search.get('low') === '1'

  useEffect(() => {
    if (search.get('add') === '1') setShowForm(true)
  }, [search])

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
      void refreshLowStock()
    } catch (e) {
      setError(errorMessage(e, 'Failed to load stock'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visibleRows = useMemo(() => {
    if (!lowOnly) return rows
    return rows.filter((r) => r.balance <= (r.dno.low_stock_threshold ?? 10))
  }, [rows, lowOnly])

  async function onDeleteMovement(m: StockMovement) {
    const label = `${m.dno_master?.dno_number ?? 'DNO'} · ${m.size} · ${m.type} ${m.qty}`
    if (!window.confirm(`Delete this stock movement?\n${label}`)) return
    setError(null)
    try {
      await deleteStockMovement(m.id)
      if (editing?.id === m.id) setEditing(null)
      await load()
    } catch (e) {
      setError(errorMessage(e, 'Delete failed'))
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Warehouse"
        subtitle="Balances per DNO + size"
        action={
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => {
              setEditing(null)
              setShowForm(true)
              navigate('/stock?add=1')
            }}
          >
            Add stock
          </button>
        }
      />

      {error ? <p className="err mb-3 whitespace-pre-wrap">{error}</p> : null}
      {loading ? <p className="text-muted text-sm">Loading…</p> : null}

      {lowOnly ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-[#9b2c2c]/10 px-3 py-2 text-sm text-[#9b2c2c]">
          <span>Showing low-stock rows only</span>
          <Link to="/stock" className="font-medium underline">
            Clear filter
          </Link>
        </div>
      ) : null}

      {showForm && !editing ? (
        <AddStockForm
          dnos={dnos}
          onCancel={() => {
            setShowForm(false)
            setSearch({}, { replace: true })
          }}
          onSaved={async () => {
            setShowForm(false)
            setSearch({}, { replace: true })
            await load()
          }}
        />
      ) : null}

      {editing ? (
        <EditStockForm
          dnos={dnos}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      ) : null}

      <section className="panel panel-accent !p-0 overflow-hidden">
        <div className="px-3 pt-3">
          <h2 className="mb-2 font-display text-base text-indigo">Balances</h2>
        </div>
        <div className="overflow-hidden">
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
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-muted">
                    {lowOnly
                      ? 'No low-stock rows.'
                      : 'No stock yet — use Add stock.'}
                  </td>
                </tr>
              ) : (
                visibleRows.map((r, i) => {
                  const low = r.balance <= (r.dno.low_stock_threshold ?? 10)
                  return (
                    <tr
                      key={`${r.dno.id}-${r.size}`}
                      className={i % 2 === 0 ? 'bg-white/60' : 'bg-ivory-dark/40'}
                    >
                      <td className="px-3 py-2">
                        {isOwner ? (
                          <Link
                            to={`/dno?id=${encodeURIComponent(r.dno.id)}`}
                            className="num font-medium text-indigo hover:underline"
                          >
                            {r.dno.dno_number}
                          </Link>
                        ) : (
                          <div className="num font-medium text-indigo">
                            {r.dno.dno_number}
                          </div>
                        )}
                        <div className="text-xs text-muted">{r.size}</div>
                      </td>
                      <td className="num px-2 py-2 text-right text-muted">
                        {r.inbound}
                      </td>
                      <td className="num px-2 py-2 text-right text-muted">
                        {r.outbound}
                      </td>
                      <td
                        className={[
                          'num px-3 py-2 text-right font-semibold',
                          low ? 'text-[#9b2c2c]' : 'text-indigo',
                        ].join(' ')}
                      >
                        {r.balance}
                        {low ? (
                          <span className="ml-1 text-[0.65rem] font-medium text-[#c45c1a]">
                            LOW
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })
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
                <div className="min-w-0">
                  <p className="num text-sm font-medium text-indigo">
                    {m.dno_master?.dno_number ?? m.dno_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted">
                    {m.size} · {m.date}
                    {m.note ? ` · ${m.note}` : ''}
                  </p>
                  <div className="mt-1 flex gap-3">
                    <button
                      type="button"
                      className="text-xs font-medium text-turmeric"
                      onClick={() => {
                        setShowForm(false)
                        setEditing(m)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-[#9b2c2c]"
                      onClick={() => void onDeleteMovement(m)}
                    >
                      Delete
                    </button>
                  </div>
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
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const n = Number(qty)
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error('Enter a quantity greater than 0')
      }
      await addStockIn({
        dno_id,
        size,
        qty: n,
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
    <form onSubmit={submit} className="panel panel-accent mb-4 space-y-3">
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
            placeholder="Enter qty"
            onChange={(e) => setQty(e.target.value)}
            className="num"
          />
        </div>
      </div>
      {err ? <p className="err whitespace-pre-wrap">{err}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !dno_id}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function EditStockForm({
  dnos,
  initial,
  onCancel,
  onSaved,
}: {
  dnos: DnoMaster[]
  initial: StockMovement
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [dno_id, setDnoId] = useState(initial.dno_id)
  const [size, setSize] = useState<DnoSize>(initial.size)
  const [type, setType] = useState<MovementType>(initial.type)
  const [qty, setQty] = useState(String(initial.qty))
  const [date, setDate] = useState(initial.date)
  const [note, setNote] = useState(initial.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await updateStockMovement(initial.id, {
        dno_id,
        size,
        type,
        qty: Number(qty),
        date,
        note: note.trim() || null,
      })
      await onSaved()
    } catch (error) {
      setErr(errorMessage(error, 'Failed to save'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="panel panel-accent mb-4 space-y-3">
      <h2 className="font-display text-lg text-indigo">Edit movement</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="field col-span-2">
          <label htmlFor="edit_dno">DNO</label>
          <select
            id="edit_dno"
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
          <label htmlFor="edit_size">Size</label>
          <select
            id="edit_size"
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
          <label htmlFor="edit_type">Type</label>
          <select
            id="edit_type"
            value={type}
            onChange={(e) => setType(e.target.value as MovementType)}
          >
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="edit_qty">Quantity</label>
          <input
            id="edit_qty"
            type="number"
            min="1"
            step="1"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="num"
          />
        </div>
        <div className="field">
          <label htmlFor="edit_date">Date</label>
          <input
            id="edit_date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field col-span-2">
          <label htmlFor="edit_note">Note</label>
          <input
            id="edit_note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      {err ? <p className="err whitespace-pre-wrap">{err}</p> : null}
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
