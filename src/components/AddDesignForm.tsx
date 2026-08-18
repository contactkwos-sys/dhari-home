import { useMemo, useRef, useState } from 'react'
import {
  addStockInForSizes,
  createDno,
  parsePieceCount,
  todayISO,
  updateDno,
  uploadDnoPhoto,
} from '../lib/api'
import { photoUploadErrorMessage } from '../lib/compressImage'
import { nextAfterDnoNumber, normalizeDnoNumber, suggestNextDnoNumber } from '../lib/dnoNumber'
import type { DnoMaster, DnoSize, Manufacturer } from '../types'
import {
  DESIGN_QUALITY_PRESETS,
  DESIGN_SYSTEM_OPTIONS,
  extraDesignSystems,
  matchDesignSystem,
  SIZES,
  emptySizeQtyMap,
  errorMessage,
  type SizeQtyMap,
} from '../types'
import { SizePiecesFields } from './SizePiecesFields'

function systemFromCategory(
  category: string | null | undefined,
  isNew: boolean,
  extras: readonly string[],
): {
  system: string
  other: string
} {
  const known = matchDesignSystem(category, extras)
  if (known) return { system: known, other: '' }
  if (category?.trim()) return { system: 'Other', other: category.trim() }
  return { system: isNew ? '5 foot' : '', other: '' }
}

export function AddDesignForm({
  initial = null,
  existingDnos = [],
  onCancel,
  onSaved,
}: {
  initial?: DnoMaster | null
  existingDnos?: DnoMaster[]
  onCancel: () => void
  onSaved: (
    dno: DnoMaster,
    opts?: { addNext?: boolean; warning?: string | null },
  ) => Promise<void> | void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const extraSystems = useMemo(
    () => extraDesignSystems(existingDnos),
    [existingDnos],
  )
  const initialSystem = systemFromCategory(
    initial?.category,
    !initial,
    extraSystems,
  )
  const [dno_number, setDnoNumber] = useState(
    initial?.dno_number ?? suggestNextDnoNumber(existingDnos),
  )
  const [manufacturer, setManufacturer] = useState<Manufacturer>(
    initial?.manufacturer ?? 'Jaisal Fashion Weave',
  )
  const [other_manufacturer_name, setOther] = useState(
    initial?.other_manufacturer_name ?? '',
  )
  const [purchase_rate, setPurchaseRate] = useState(
    initial?.purchase_rate?.toString() ?? '',
  )
  const [system, setSystem] = useState(initialSystem.system)
  const [other_system, setOtherSystem] = useState(initialSystem.other)
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
  const [qtyBySize, setQtyBySize] = useState<SizeQtyMap>(emptySizeQtyMap())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  function categoryValue(): string | null {
    if (system === 'Other' || system === '') return other_system.trim() || null
    return system
  }

  function setSizeQty(size: DnoSize, value: string) {
    setQtyBySize((prev) => ({ ...prev, [size]: value }))
  }

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

  function resetForNext(saved: DnoMaster) {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setDnoNumber(nextAfterDnoNumber(saved.dno_number))
    setPhotoFile(null)
    setPhotoPreview(null)
    setQtyBySize(emptySizeQtyMap())
    setPurchaseRate('')
    setDate(todayISO())
    if (fileRef.current) fileRef.current.value = ''
    const extras = extraDesignSystems(
      existingDnos.some((d) => d.id === saved.id)
        ? existingDnos
        : [...existingDnos, saved],
    )
    const next = systemFromCategory(saved.category, true, extras)
    setSystem(next.system)
    setOtherSystem(next.other)
  }

  async function submit(e: { preventDefault: () => void }, addNext: boolean) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setOk(null)
    try {
      const thresholdRaw = low_stock_threshold.trim()
      const thresholdNum =
        thresholdRaw === '' ? 10 : Math.max(0, Math.floor(Number(thresholdRaw)))
      if (thresholdRaw !== '' && !Number.isFinite(thresholdNum)) {
        throw new Error('Low stock threshold must be a number')
      }
      const pieces: Partial<Record<DnoSize, number>> = {}
      for (const size of SIZES) {
        pieces[size] = parsePieceCount(qtyBySize[size], size)
      }
      const nextNumber = normalizeDnoNumber(dno_number)
      if (!nextNumber) throw new Error('DN number is required')
      const clash = existingDnos.find(
        (d) =>
          d.id !== initial?.id &&
          normalizeDnoNumber(d.dno_number).toLowerCase() ===
            nextNumber.toLowerCase(),
      )
      if (clash) {
        throw new Error(
          initial
            ? 'This DN number is already used by another design.'
            : 'This DN already exists. Open Warehouse → Add stock to add more pieces to the same DN.',
        )
      }
      const fields = {
        dno_number: nextNumber,
        manufacturer,
        other_manufacturer_name:
          manufacturer === 'Other' ? other_manufacturer_name.trim() || null : null,
        purchase_rate: purchase_rate === '' ? null : Number(purchase_rate),
        category: categoryValue(),
        hsn_code: hsn_code.trim() || null,
        gst_rate: Number(gst_rate),
        low_stock_threshold: thresholdNum,
        date_added,
      }

      let saved: DnoMaster
      if (initial) {
        saved = await updateDno(initial.id, fields)
      } else {
        saved = await createDno(fields)
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

      let stockWarning: string | null = null
      const hasPieces = SIZES.some((size) => (pieces[size] ?? 0) > 0)
      if (hasPieces) {
        try {
          await addStockInForSizes({
            dno_id: saved.id,
            qtyBySize: pieces,
            date: initial ? todayISO() : date_added,
            note: initial ? 'Added from design edit' : 'Opening stock',
          })
          setQtyBySize(emptySizeQtyMap())
        } catch (stockErr) {
          stockWarning = errorMessage(stockErr, 'Could not save pieces per size')
        }
      }

      const warnings = [photoWarning, stockWarning].filter(Boolean)
      const warningText = warnings.length
        ? `${warnings.join(' ')}. Design saved — retry photo or add stock in Warehouse.`
        : null

      if (addNext && !initial) {
        await onSaved(saved, { addNext: true, warning: warningText })
        if (warningText) setErr(warningText)
        else setOk(`Saved ${saved.dno_number}. Next DN ready.`)
        resetForNext(saved)
        return
      }

      await onSaved(saved, { addNext: false, warning: warningText })
    } catch (error) {
      setErr(errorMessage(error, 'Save failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e, false)}
      className="panel panel-accent mb-4 space-y-3"
    >
      <h2 className="font-display text-lg text-indigo">
        {initial ? `Edit ${initial.dno_number}` : 'Add design'}
      </h2>
      <p className="text-xs text-muted">
        Short DN — DN-1 to DN-21, or DN 1001. Same DN again: Warehouse → Add
        stock. New quality names typed under Others stay in the list.
      </p>
      {ok ? <p className="ok text-sm">{ok}</p> : null}

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
          <label htmlFor="dno_number">DN number</label>
          <input
            id="dno_number"
            required
            value={dno_number}
            onChange={(e) => setDnoNumber(e.target.value)}
            className="num"
            placeholder="DN-1 or DN 1001"
            autoCapitalize="characters"
          />
        </div>
        <div className="field col-span-2">
          <label htmlFor="system">System / quality</label>
          <select
            id="system"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
          >
            {initial && !initial.category ? (
              <option value="">—</option>
            ) : null}
            <optgroup label="System">
              {DESIGN_SYSTEM_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </optgroup>
            <optgroup label="Quality">
              {DESIGN_QUALITY_PRESETS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {extraSystems.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </optgroup>
            <option value="Other">Others</option>
          </select>
        </div>
        {system === 'Other' ? (
          <div className="field col-span-2">
            <label htmlFor="other_system">Quality name</label>
            <input
              id="other_system"
              value={other_system}
              onChange={(e) => setOtherSystem(e.target.value)}
              required
              placeholder="e.g. Cotton Dhari"
            />
            <p className="mt-1 text-xs text-muted">
              Saved names appear under Quality next time you add or edit a DN.
            </p>
          </div>
        ) : null}
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
        <div className="field">
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
        <SizePiecesFields
          idPrefix={initial ? 'edit_design_qty' : 'add_design_qty'}
          values={qtyBySize}
          onChange={setSizeQty}
          hint={
            initial
              ? 'Optional — adds pieces to this DN in warehouse.'
              : 'Opening stock. Leave blank for 0. Add more later in Warehouse.'
          }
        />
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
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {!initial ? (
          <button
            type="button"
            className="btn btn-accent"
            disabled={busy}
            onClick={(e) => void submit(e, true)}
          >
            {busy ? 'Saving…' : 'Save & next'}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
