import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StripeBar } from '../components/StripeBar'
import {
  createDno,
  clearDnoPhoto,
  deleteDno,
  fetchDnos,
  fetchOrders,
  fetchStockMovements,
  formatMoney,
  todayISO,
  updateDno,
  uploadDnoPhoto,
} from '../lib/api'
import { enrichMovementsWithBalance } from '../lib/dashboard'
import type {
  DnoMaster,
  DnoSize,
  Manufacturer,
  Order,
  StockMovement,
} from '../types'
import { SIZES, errorMessage } from '../types'

export function DnoPage() {
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState<DnoMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<DnoMaster | null>(null)
  const [detail, setDetail] = useState<DnoMaster | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchDnos()
      setRows(data)
      const id = search.get('id')
      if (id) {
        setDetail(data.find((d) => d.id === id) ?? null)
      } else if (detail) {
        setDetail(data.find((d) => d.id === detail.id) ?? null)
      }
    } catch (e) {
      setError(errorMessage(e, 'Failed to load DNOs'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (search.get('add') === '1') {
      setShowAdd(true)
      setEditing(null)
      setDetail(null)
    }
    const id = search.get('id')
    if (id && rows.length) {
      const found = rows.find((d) => d.id === id) ?? null
      setDetail(found)
      setShowAdd(false)
      setEditing(null)
    }
  }, [search, rows])

  function clearQuery() {
    if ([...search.keys()].length) setSearch({}, { replace: true })
  }

  async function onPhotoPick(dno: DnoMaster, file: File | undefined) {
    if (!file) return
    setUploadingId(dno.id)
    setError(null)
    try {
      const url = await uploadDnoPhoto(dno.id, dno.dno_number, file)
      setRows((prev) =>
        prev.map((r) => (r.id === dno.id ? { ...r, photo_url: url } : r)),
      )
      setDetail((prev) =>
        prev && prev.id === dno.id ? { ...prev, photo_url: url } : prev,
      )
    } catch (e) {
      setError(errorMessage(e, 'Upload failed'))
    } finally {
      setUploadingId(null)
    }
  }

  async function onClearPhoto(dno: DnoMaster) {
    if (!dno.photo_url) return
    if (!window.confirm(`Remove photo for ${dno.dno_number}?`)) return
    setError(null)
    try {
      const updated = await clearDnoPhoto(dno.id)
      setRows((prev) => prev.map((r) => (r.id === dno.id ? updated : r)))
      setDetail((prev) => (prev && prev.id === dno.id ? updated : prev))
    } catch (e) {
      setError(errorMessage(e, 'Could not remove photo'))
    }
  }

  async function onDeleteDno(dno: DnoMaster) {
    if (
      !window.confirm(
        `Delete ${dno.dno_number}? Related stock movements will also be removed.`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await deleteDno(dno.id)
      setRows((prev) => prev.filter((r) => r.id !== dno.id))
      if (detail?.id === dno.id) {
        setDetail(null)
        clearQuery()
      }
      if (editing?.id === dno.id) setEditing(null)
    } catch (e) {
      setError(errorMessage(e, 'Delete failed'))
    }
  }

  if (detail && !showAdd && !editing) {
    return (
      <DnoDetail
        dno={detail}
        uploading={uploadingId === detail.id}
        onBack={() => {
          setDetail(null)
          clearQuery()
        }}
        onEdit={() => {
          setEditing(detail)
          setShowAdd(false)
        }}
        onDelete={() => void onDeleteDno(detail)}
        onPhoto={() => fileRefs.current[detail.id]?.click()}
        onClearPhoto={() => void onClearPhoto(detail)}
        fileInput={
          <input
            ref={(el) => {
              fileRefs.current[detail.id] = el
            }}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onPhotoPick(detail, e.target.files?.[0])
              e.target.value = ''
            }}
          />
        }
      />
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="DNO Master"
        subtitle="Design numbers, photos & rates"
        action={
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => {
              setShowAdd(true)
              setEditing(null)
              setDetail(null)
              navigate('/dno?add=1')
            }}
          >
            Add DNO
          </button>
        }
      />

      {error ? <p className="err mb-3 whitespace-pre-wrap">{error}</p> : null}
      {loading ? <p className="text-muted text-sm">Loading…</p> : null}

      {(showAdd || editing) && (
        <DnoForm
          initial={editing}
          onCancel={() => {
            setShowAdd(false)
            setEditing(null)
            clearQuery()
          }}
          onSaved={async () => {
            setShowAdd(false)
            setEditing(null)
            clearQuery()
            await load()
          }}
        />
      )}

      <ul className="mt-2 space-y-3">
        {rows.map((dno) => (
          <li key={dno.id} className="panel panel-accent flex gap-3">
            <button
              type="button"
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ivory-dark"
              onClick={() => fileRefs.current[dno.id]?.click()}
              aria-label={`Change photo for ${dno.dno_number}`}
            >
              {dno.photo_url ? (
                <img
                  src={dno.photo_url}
                  alt={dno.dno_number}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center px-1 text-center text-[0.65rem] text-muted">
                  No photo
                </span>
              )}
            </button>
            <input
              ref={(el) => {
                fileRefs.current[dno.id] = el
              }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onPhotoPick(dno, e.target.files?.[0])
                e.target.value = ''
              }}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <button
                  type="button"
                  className="num font-medium text-indigo hover:underline"
                  onClick={() => {
                    setDetail(dno)
                    setSearch({ id: dno.id }, { replace: true })
                  }}
                >
                  {dno.dno_number}
                </button>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-turmeric"
                    onClick={() => {
                      setEditing(dno)
                      setShowAdd(false)
                      setDetail(null)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#9b2c2c]"
                    onClick={() => void onDeleteDno(dno)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-0.5 truncate text-sm text-muted">
                {dno.manufacturer === 'Other'
                  ? dno.other_manufacturer_name || 'Other'
                  : dno.manufacturer}
              </p>
              {dno.category ? (
                <p className="text-xs text-ink">{dno.category}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>
                  Rate{' '}
                  <span className="num text-ink">
                    {formatMoney(dno.purchase_rate)}
                  </span>
                </span>
                <span>
                  Alert{' '}
                  <span className="num text-ink">
                    ≤{dno.low_stock_threshold ?? 10}
                  </span>
                </span>
                {dno.photo_url ? (
                  <button
                    type="button"
                    className="font-medium text-[#9b2c2c]"
                    onClick={() => void onClearPhoto(dno)}
                  >
                    Remove photo
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DnoDetail({
  dno,
  uploading,
  onBack,
  onEdit,
  onDelete,
  onPhoto,
  onClearPhoto,
  fileInput,
}: {
  dno: DnoMaster
  uploading: boolean
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onPhoto: () => void
  onClearPhoto: () => void
  fileInput: ReactNode
}) {
  const [tab, setTab] = useState<'ledger' | 'orders'>('ledger')
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setErr(null)
      try {
        const [allMoves, allOrders] = await Promise.all([
          fetchStockMovements(),
          fetchOrders(),
        ])
        if (cancelled) return
        setMovements(allMoves.filter((m) => m.dno_id === dno.id))
        setOrders(allOrders.filter((o) => o.dno_id === dno.id))
      } catch (e) {
        if (!cancelled) setErr(errorMessage(e, 'Failed to load DNO history'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dno.id])

  const stockBySize = useMemo(() => {
    const map = new Map<
      DnoSize,
      { opening: number; inbound: number; outbound: number; current: number }
    >()
    for (const size of SIZES) {
      map.set(size, { opening: 0, inbound: 0, outbound: 0, current: 0 })
    }
    const chrono = [...movements].reverse()
    for (const m of chrono) {
      const row = map.get(m.size as DnoSize)
      if (!row) continue
      if (m.type === 'IN') {
        if (row.inbound === 0 && row.outbound === 0 && row.current === 0) {
          // first IN acts as opening receipt for display
        }
        row.inbound += m.qty
        row.current += m.qty
      } else {
        row.outbound += m.qty
        row.current -= m.qty
      }
    }
    for (const size of SIZES) {
      const row = map.get(size)!
      // Opening = first chronological balance basis: inbound before any out, simplified as
      // opening stock implied 0; show inbound as "In"
      row.opening = 0
    }
    return SIZES.map((size) => ({ size, ...map.get(size)! }))
  }, [movements])

  const ledger = useMemo(
    () => enrichMovementsWithBalance(movements),
    [movements],
  )

  return (
    <div className="page animate-[rise-in_280ms_ease-out]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" className="btn btn-ghost text-sm" onClick={onBack}>
          ← Back
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary text-sm" onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm text-[#9b2c2c]"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>

      <article className="panel panel-accent overflow-hidden !p-0">
        <button
          type="button"
          className="relative block w-full bg-ivory-dark"
          onClick={onPhoto}
          aria-label={`Upload photo for ${dno.dno_number}`}
        >
          {dno.photo_url ? (
            <img
              src={dno.photo_url}
              alt={dno.dno_number}
              className="aspect-[4/3] w-full object-cover lg:aspect-[21/9]"
            />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center text-sm text-muted lg:aspect-[21/9]">
              Tap to add photo
            </div>
          )}
          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
              Uploading…
            </span>
          ) : null}
        </button>
        {fileInput}
        {dno.photo_url ? (
          <div className="flex justify-end border-b border-[rgba(31,59,87,0.08)] px-4 py-2">
            <button
              type="button"
              className="text-xs font-medium text-[#9b2c2c]"
              onClick={onClearPhoto}
            >
              Remove photo
            </button>
          </div>
        ) : null}

        <div className="space-y-4 px-4 py-4">
          <div>
            <p className="num text-sm tracking-wide text-turmeric">
              {dno.dno_number}
            </p>
            <h1 className="font-display text-2xl font-semibold text-indigo">
              {dno.category || 'Uncategorized'}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {dno.manufacturer === 'Other'
                ? dno.other_manufacturer_name || 'Other'
                : dno.manufacturer}
            </p>
          </div>

          <StripeBar />

          <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            <DetailField label="Category" value={dno.category || '—'} />
            <DetailField label="HSN" value={dno.hsn_code || '—'} />
            <DetailField label="GST" value={`${dno.gst_rate}%`} />
            <DetailField
              label="Manufacturer"
              value={
                dno.manufacturer === 'Other'
                  ? dno.other_manufacturer_name || 'Other'
                  : dno.manufacturer
              }
            />
            <DetailField label="Purchase rate" value={formatMoney(dno.purchase_rate)} />
            <DetailField
              label="Low stock alert"
              value={`≤ ${dno.low_stock_threshold ?? 10}`}
            />
            <DetailField label="Date added" value={dno.date_added} />
          </dl>
        </div>
      </article>

      <section className="panel panel-accent mt-4">
        <h2 className="font-display text-lg text-indigo">Stock Summary</h2>
        <p className="text-xs text-muted">Opening / In / Out / Current per size</p>
        <div className="mt-3 overflow-hidden rounded-lg border border-[rgba(31,59,87,0.08)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-indigo text-ivory">
              <tr>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-2 py-2 text-right font-medium">Open</th>
                <th className="px-2 py-2 text-right font-medium">In</th>
                <th className="px-2 py-2 text-right font-medium">Out</th>
                <th className="px-3 py-2 text-right font-medium">Now</th>
              </tr>
            </thead>
            <tbody>
              {stockBySize.map((r, i) => (
                <tr
                  key={r.size}
                  className={i % 2 === 0 ? 'bg-white/60' : 'bg-ivory-dark/40'}
                >
                  <td className="px-3 py-2 text-indigo">{r.size}</td>
                  <td className="num px-2 py-2 text-right text-muted">
                    {r.opening}
                  </td>
                  <td className="num px-2 py-2 text-right text-[#2f6b4f]">
                    {r.inbound}
                  </td>
                  <td className="num px-2 py-2 text-right text-[#9b2c2c]">
                    {r.outbound}
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold text-indigo">
                    {r.current}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            className={[
              'btn text-sm',
              tab === 'ledger' ? 'btn-primary' : 'btn-ghost',
            ].join(' ')}
            onClick={() => setTab('ledger')}
          >
            Stock Ledger
          </button>
          <button
            type="button"
            className={[
              'btn text-sm',
              tab === 'orders' ? 'btn-primary' : 'btn-ghost',
            ].join(' ')}
            onClick={() => setTab('orders')}
          >
            Order History
          </button>
        </div>

        {err ? <p className="err mb-2">{err}</p> : null}
        {loading ? <p className="text-sm text-muted">Loading…</p> : null}

        {tab === 'ledger' ? (
          <ul className="space-y-2">
            {ledger.length === 0 && !loading ? (
              <li className="text-sm text-muted">No stock movements for this DNO.</li>
            ) : (
              ledger.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[rgba(31,59,87,0.08)] bg-white/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-indigo">
                      {m.type} · {m.size}
                    </p>
                    <p className="text-xs text-muted">
                      {m.date}
                      {m.note ? ` · ${m.note}` : ''}
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
                </li>
              ))
            )}
          </ul>
        ) : (
          <ul className="space-y-2">
            {orders.length === 0 && !loading ? (
              <li className="text-sm text-muted">No orders for this DNO.</li>
            ) : (
              orders.map((o) => (
                <li key={o.id} className="panel panel-accent !py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-indigo">{o.platform}</p>
                      <p className="num text-xs text-muted">
                        {o.platform_order_id || '—'} · {o.order_date}
                      </p>
                    </div>
                    <span className="rounded-md bg-ivory-dark px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-indigo">
                      {o.payment_status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {o.size} · {o.pieces} pcs · {formatMoney(o.sale_rate)}
                  </p>
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="num mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  )
}

function DnoForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: DnoMaster | null
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [dno_number, setDnoNumber] = useState(initial?.dno_number ?? '')
  const [manufacturer, setManufacturer] = useState<Manufacturer>(
    initial?.manufacturer ?? 'Jaisal Fashion Weave',
  )
  const [other_manufacturer_name, setOther] = useState(
    initial?.other_manufacturer_name ?? '',
  )
  const [purchase_rate, setPurchaseRate] = useState(
    initial?.purchase_rate?.toString() ?? '',
  )
  const [category, setCategory] = useState(initial?.category ?? '')
  const [hsn_code, setHsn] = useState(initial?.hsn_code ?? '6304')
  const [gst_rate, setGst] = useState(initial?.gst_rate?.toString() ?? '12')
  const [low_stock_threshold, setThreshold] = useState(
    (initial?.low_stock_threshold ?? 10).toString(),
  )
  const [date_added, setDate] = useState(initial?.date_added ?? todayISO())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const fields = {
        manufacturer,
        other_manufacturer_name:
          manufacturer === 'Other' ? other_manufacturer_name.trim() || null : null,
        purchase_rate: purchase_rate === '' ? null : Number(purchase_rate),
        category: category.trim() || null,
        hsn_code: hsn_code.trim() || null,
        gst_rate: Number(gst_rate),
        low_stock_threshold: Number(low_stock_threshold) || 10,
        date_added,
      }
      if (initial) {
        await updateDno(initial.id, fields)
      } else {
        await createDno({
          dno_number: dno_number.trim(),
          ...fields,
        })
      }
      await onSaved()
    } catch (error) {
      setErr(errorMessage(error, 'Save failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="panel panel-accent mb-4 space-y-3">
      <h2 className="font-display text-lg text-indigo">
        {initial ? `Edit ${initial.dno_number}` : 'Add DNO'}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="field col-span-2">
          <label htmlFor="dno_number">DNO number</label>
          <input
            id="dno_number"
            required
            value={dno_number}
            onChange={(e) => setDnoNumber(e.target.value)}
            className="num"
            disabled={!!initial}
          />
        </div>
        <div className="field col-span-2">
          <label htmlFor="manufacturer">Manufacturer</label>
          <select
            id="manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value as Manufacturer)}
          >
            <option value="Jaisal Fashion Weave">Jaisal Fashion Weave</option>
            <option value="Other">Other</option>
          </select>
        </div>
        {manufacturer === 'Other' ? (
          <div className="field col-span-2">
            <label htmlFor="other_mfr">Other manufacturer</label>
            <input
              id="other_mfr"
              value={other_manufacturer_name}
              onChange={(e) => setOther(e.target.value)}
              required
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="purchase_rate">Purchase rate</label>
          <input
            id="purchase_rate"
            type="number"
            step="0.01"
            min="0"
            value={purchase_rate}
            onChange={(e) => setPurchaseRate(e.target.value)}
            className="num"
          />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="hsn">HSN code</label>
          <input
            id="hsn"
            value={hsn_code}
            onChange={(e) => setHsn(e.target.value)}
            className="num"
          />
        </div>
        <div className="field">
          <label htmlFor="gst">GST rate %</label>
          <input
            id="gst"
            type="number"
            step="0.01"
            min="0"
            value={gst_rate}
            onChange={(e) => setGst(e.target.value)}
            className="num"
            required
          />
        </div>
        <div className="field col-span-2">
          <label htmlFor="threshold">Low stock threshold</label>
          <input
            id="threshold"
            type="number"
            min="0"
            step="1"
            required
            value={low_stock_threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="num"
          />
        </div>
        {!initial ? (
          <div className="field col-span-2">
            <label htmlFor="date_added">Date added</label>
            <input
              id="date_added"
              type="date"
              value={date_added}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        ) : null}
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
