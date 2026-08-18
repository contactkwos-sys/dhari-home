import { useRef, useState, type FormEvent } from 'react'
import { createDno, todayISO, updateDno, uploadDnoPhoto } from '../lib/api'
import { photoUploadErrorMessage } from '../lib/compressImage'
import type { DnoMaster, Manufacturer } from '../types'
import { errorMessage } from '../types'

export function AddDesignForm({
  initial = null,
  onCancel,
  onSaved,
}: {
  initial?: DnoMaster | null
  onCancel: () => void
  onSaved: (dno: DnoMaster, photoWarning?: string | null) => Promise<void> | void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
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
    initial ? String(initial.low_stock_threshold ?? '') : '',
  )
  const [date_added, setDate] = useState(initial?.date_added ?? todayISO())
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initial?.photo_url ?? null,
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function onPickPhoto(file: File | undefined) {
    if (!file) return
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function clearPickedPhoto() {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(initial?.photo_url ?? null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const thresholdRaw = low_stock_threshold.trim()
      const thresholdNum =
        thresholdRaw === '' ? 10 : Math.max(0, Math.floor(Number(thresholdRaw)))
      if (thresholdRaw !== '' && !Number.isFinite(thresholdNum)) {
        throw new Error('Low stock threshold must be a number')
      }
      const fields = {
        manufacturer,
        other_manufacturer_name:
          manufacturer === 'Other' ? other_manufacturer_name.trim() || null : null,
        purchase_rate: purchase_rate === '' ? null : Number(purchase_rate),
        category: category.trim() || null,
        hsn_code: hsn_code.trim() || null,
        gst_rate: Number(gst_rate),
        low_stock_threshold: thresholdNum,
        date_added,
      }

      let saved: DnoMaster
      if (initial) {
        saved = await updateDno(initial.id, fields)
      } else {
        saved = await createDno({
          dno_number: dno_number.trim(),
          ...fields,
        })
      }

      let photoWarning: string | null = null
      if (photoFile) {
        try {
          const url = await uploadDnoPhoto(saved.id, saved.dno_number, photoFile)
          saved = { ...saved, photo_url: url }
          setPhotoFile(null)
        } catch (photoErr) {
          photoWarning = photoUploadErrorMessage(photoErr)
        }
      }

      await onSaved(saved, photoWarning)
      if (photoWarning) {
        // Parent closes the form; warning is shown on the DNO list.
        return
      }
    } catch (error) {
      setErr(errorMessage(error, 'Save failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="panel panel-accent mb-4 space-y-3">
      <h2 className="font-display text-lg text-indigo">
        {initial ? `Edit ${initial.dno_number}` : 'Add design'}
      </h2>
      <p className="text-xs text-muted">
        Design number (DNO), photo, rates — used in warehouse stock and orders.
      </p>

      <div className="field">
        <label htmlFor="design_photo">Design photo</label>
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-ivory-dark"
            onClick={() => fileRef.current?.click()}
            aria-label="Upload design photo"
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center px-1 text-center text-[0.65rem] text-muted">
                Tap to add photo
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <button
              type="button"
              className="btn btn-ghost !px-2.5 !py-1 text-xs"
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? 'Change photo' : 'Upload photo'}
            </button>
            {photoFile || (photoPreview && !initial?.photo_url) ? (
              <button
                type="button"
                className="btn btn-ghost !px-2.5 !py-1 text-xs text-[#9b2c2c]"
                onClick={clearPickedPhoto}
              >
                Clear
              </button>
            ) : null}
            <p className="text-[0.65rem] text-muted">
              JPEG, PNG or WebP. Shown in Orders design view.
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          id="design_photo"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPickPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

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
            placeholder="e.g. DH-0022"
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
            value={low_stock_threshold}
            placeholder="Leave blank if not needed"
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
          {busy ? 'Saving…' : 'Save design'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
