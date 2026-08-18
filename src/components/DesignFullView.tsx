import { useEffect } from 'react'
import type { DnoMaster, DnoSize } from '../types'

export function DesignFullView({
  dno,
  size,
  balance,
  onClose,
}: {
  dno: DnoMaster
  size?: DnoSize | string | null
  balance?: number | null
  onClose: () => void
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const manufacturer =
    dno.manufacturer === 'Other'
      ? dno.other_manufacturer_name || 'Other'
      : dno.manufacturer

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[#0f1c28]/96 animate-[fade-soft_200ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label={`Design ${dno.dno_number}`}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-ivory"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="num text-sm tracking-wide text-turmeric-soft">
            {dno.dno_number}
          </p>
          <p className="truncate font-display text-lg font-semibold">
            {dno.category || 'Design'}
          </p>
        </div>
        <button
          type="button"
          className="btn shrink-0 bg-white/10 text-sm text-ivory"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center px-3 pb-3"
        onClick={(e) => e.stopPropagation()}
      >
        {dno.photo_url ? (
          <img
            src={dno.photo_url}
            alt={dno.dno_number}
            className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
          />
        ) : (
          <div className="flex h-64 w-full max-w-sm items-center justify-center rounded-xl bg-white/10 text-sm text-ivory/70">
            No photo for this design
          </div>
        )}
      </div>

      <div
        className="space-y-1 border-t border-white/10 px-4 py-3 text-sm text-ivory/90"
        onClick={(e) => e.stopPropagation()}
      >
        <p>{manufacturer}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-ivory/75">
          {size ? <span>Size {size}</span> : null}
          {balance != null ? (
            <span className="num">
              Balance <strong className="text-ivory">{balance}</strong>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
