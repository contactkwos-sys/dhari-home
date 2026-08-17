import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StripeBar } from '../components/StripeBar'
import {
  createDno,
  fetchDnos,
  todayISO,
  updateDno,
  uploadDnoPhoto,
  formatMoney,
} from '../lib/api'
import type { DnoMaster, Manufacturer } from '../types'
import { errorMessage } from '../types'

export function DnoPage() {
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
      if (detail) {
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

  if (detail && !showAdd && !editing) {
    return (
      <DnoDetail
        dno={detail}
        uploading={uploadingId === detail.id}
        onBack={() => setDetail(null)}
        onEdit={() => {
          setEditing(detail)
          setShowAdd(false)
        }}
        onPhoto={() => fileRefs.current[detail.id]?.click()}
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
            }}
          >
            Add DNO
          </button>
        }
      />

      {error ? <p className="err mb-3">{error}</p> : null}
      {loading ? <p className="text-muted text-sm">Loading…</p> : null}

      {(showAdd || editing) && (
        <DnoForm
          initial={editing}
          onCancel={() => {
            setShowAdd(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setShowAdd(false)
            setEditing(null)
            await load()
          }}
        />
      )}

      <ul className="mt-2 space-y-3">
        {rows.map((dno) => (
          <li key={dno.id}>
            <button
              type="button"
              className="panel panel-accent flex w-full gap-3 text-left"
              onClick={() => setDetail(dno)}
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ivory-dark">
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
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="num font-medium text-indigo">{dno.dno_number}</p>
                  <span className="text-xs font-medium text-turmeric">View</span>
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
                </div>
              </div>
            </button>
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
  onPhoto,
  fileInput,
}: {
  dno: DnoMaster
  uploading: boolean
  onBack: () => void
  onEdit: () => void
  onPhoto: () => void
  fileInput: ReactNode
}) {
  return (
    <div className="page animate-[rise-in_280ms_ease-out]">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="btn btn-ghost text-sm" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary text-sm" onClick={onEdit}>
          Edit
        </button>
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
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center text-sm text-muted">
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

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <DetailField label="Purchase rate" value={formatMoney(dno.purchase_rate)} />
            <DetailField label="GST" value={`${dno.gst_rate}%`} />
            <DetailField label="HSN" value={dno.hsn_code || '—'} />
            <DetailField
              label="Low stock alert"
              value={`≤ ${dno.low_stock_threshold ?? 10}`}
            />
            <DetailField label="Date added" value={dno.date_added} />
            <DetailField
              label="Sizes"
              value="Set in Stock (5ft / 7ft)"
            />
          </dl>
        </div>
      </article>
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
